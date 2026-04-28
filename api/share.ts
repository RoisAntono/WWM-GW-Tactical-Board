type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

type ShareCreateBody = {
  ciphertext?: string;
  iv?: string;
  compression?: 'gzip' | 'none';
  ttlDays?: unknown;
};

const maxCiphertextLength = 4_000_000;

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  try {
    if (request.method === 'POST') {
      await createShare(request, response);
      return;
    }

    if (request.method === 'GET') {
      await readShare(request, response);
      return;
    }

    response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Share API failed.' });
  }
}

async function createShare(request: ApiRequest, response: ApiResponse) {
  const body = readCreateBody(request.body);
  const validationError = validateCreateBody(body);
  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  const ttlDays = readTtlDays(body.ttlDays);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const store = await createConfiguredStore();
  const ciphertext = body.ciphertext;
  const iv = body.iv;
  const compression = body.compression;
  if (!ciphertext || !iv || !compression) {
    response.status(400).json({ error: 'Encrypted share payload is incomplete.' });
    return;
  }
  const record = await store.create({
    id: await createShareId(),
    ciphertext,
    iv,
    compression,
    createdAt: now.toISOString(),
    expiresAt,
  });

  response.status(201).json({
    id: record.id,
    expiresAt: record.expiresAt,
  });
}

async function readShare(request: ApiRequest, response: ApiResponse) {
  const id = readQueryString(request.query, 'id');
  if (!id) {
    response.status(400).json({ error: 'Share id is required.' });
    return;
  }

  const store = await createConfiguredStore();
  const record = await store.findById(id);
  if (!record) {
    response.status(404).json({ error: 'Share link was not found or has expired.' });
    return;
  }

  response.status(200).json({
    id: record.id,
    ciphertext: record.ciphertext,
    iv: record.iv,
    compression: record.compression === 'gzip' ? 'gzip' : 'none',
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  });
}

async function createConfiguredStore() {
  const databaseUrl = process.env.NEON_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('NEON_DATABASE_URL is not configured.');
  }

  const [{ createShareSnapshotStore }, { createNeonSqlExecutor }] = await Promise.all([
    import('../src/server/database'),
    import('../src/server/database/neon/client'),
  ]);

  return createShareSnapshotStore({
    provider: 'neon',
    neon: {
      sql: createNeonSqlExecutor(databaseUrl),
    },
  });
}

function readCreateBody(body: unknown): ShareCreateBody {
  if (!body || typeof body !== 'object') {
    return { ciphertext: undefined, iv: undefined, compression: undefined, ttlDays: undefined };
  }

  const value = body as ShareCreateBody;
  return {
    ciphertext: typeof value.ciphertext === 'string' ? value.ciphertext : undefined,
    iv: typeof value.iv === 'string' ? value.iv : undefined,
    compression: value.compression === 'gzip' || value.compression === 'none' ? value.compression : undefined,
    ttlDays: value.ttlDays,
  };
}

function validateCreateBody(body: ReturnType<typeof readCreateBody>): string | undefined {
  if (!body.ciphertext) {
    return 'Encrypted payload is required.';
  }
  if (body.ciphertext.length > maxCiphertextLength) {
    return 'Encrypted payload is too large.';
  }
  if (!body.iv) {
    return 'Encryption IV is required.';
  }
  if (!body.compression) {
    return 'Compression mode is required.';
  }
  return undefined;
}

function readTtlDays(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 90;
  }
  return Math.max(1, Math.min(365, Math.round(numeric)));
}

function readQueryString(query: ApiRequest['query'], key: string): string | undefined {
  const value = query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

async function createShareId(): Promise<string> {
  const { randomBytes } = await import('node:crypto');
  return randomBytes(12).toString('base64url');
}
