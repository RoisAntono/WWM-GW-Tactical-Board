import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'node:crypto';

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

type ShareSnapshotRecord = {
  id: string;
  ciphertext: string;
  iv: string;
  compression: 'gzip' | 'none';
  createdAt: string;
  expiresAt?: string;
};

type ShareSnapshotRow = {
  id: string;
  payload_ciphertext: string;
  iv: string;
  compression: string;
  created_at: string | Date;
  expires_at: string | Date | null;
};

const maxCiphertextLength = 4_000_000;
const idPattern = /^[A-Za-z0-9_-]{8,64}$/;

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
  const ciphertext = body.ciphertext;
  const iv = body.iv;
  const compression = body.compression;
  if (!ciphertext || !iv || !compression) {
    response.status(400).json({ error: 'Encrypted share payload is incomplete.' });
    return;
  }
  const record = await createShareSnapshot({
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
  if (!idPattern.test(id)) {
    response.status(404).json({ error: 'Share link was not found or has expired.' });
    return;
  }

  const record = await findShareSnapshot(id);
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

function readCreateBody(body: unknown): ShareCreateBody {
  if (typeof body === 'string') {
    try {
      return readCreateBody(JSON.parse(body) as unknown);
    } catch {
      return { ciphertext: undefined, iv: undefined, compression: undefined, ttlDays: undefined };
    }
  }

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
  return randomBytes(12).toString('base64url');
}

async function createShareSnapshot(input: ShareSnapshotRecord): Promise<ShareSnapshotRecord> {
  if (!idPattern.test(input.id)) {
    throw new Error('Share snapshot id must be 8-64 URL-safe characters.');
  }

  const rows = await queryNeon<ShareSnapshotRow>(
    `
      insert into share_snapshots (
        id,
        payload_ciphertext,
        iv,
        compression,
        created_at,
        expires_at
      )
      values ($1, $2, $3, $4, $5, $6)
      returning
        id,
        payload_ciphertext,
        iv,
        compression,
        created_at,
        expires_at
    `,
    [input.id, input.ciphertext, input.iv, input.compression, input.createdAt, input.expiresAt ?? null],
  );

  const row = rows[0];
  if (!row) {
    throw new Error('Share snapshot was not created.');
  }

  return rowToRecord(row);
}

async function findShareSnapshot(id: string): Promise<ShareSnapshotRecord | undefined> {
  const now = new Date().toISOString();
  const rows = await queryNeon<ShareSnapshotRow>(
    `
      select
        id,
        payload_ciphertext,
        iv,
        compression,
        created_at,
        expires_at
      from share_snapshots
      where id = $1
        and (expires_at is null or expires_at > $2)
      limit 1
    `,
    [id, now],
  );
  const row = rows[0];
  if (!row) {
    return undefined;
  }

  await queryNeon(
    `
      update share_snapshots
      set opened_at = $2,
          open_count = open_count + 1
      where id = $1
    `,
    [id, now],
  );

  return rowToRecord(row);
}

async function queryNeon<Row extends Record<string, unknown>>(
  query: string,
  params: readonly unknown[] = [],
): Promise<readonly Row[]> {
  const databaseUrl = process.env.NEON_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('NEON_DATABASE_URL is not configured.');
  }

  const sql = neon(databaseUrl);
  const rows = await sql.query(query, [...params]);
  return rows as readonly Row[];
}

function rowToRecord(row: ShareSnapshotRow): ShareSnapshotRecord {
  return {
    id: row.id,
    ciphertext: row.payload_ciphertext,
    iv: row.iv,
    compression: row.compression === 'none' ? 'none' : 'gzip',
    createdAt: toIsoString(row.created_at),
    expiresAt: row.expires_at ? toIsoString(row.expires_at) : undefined,
  };
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
