import {
  buildWorkspaceShareUrl,
  createWorkspaceShareEncryptedSnapshot,
  createWorkspaceShareKeyHash,
  decryptWorkspaceShareStoredSnapshot,
  hasWorkspaceShareKeyHash,
  type WorkspaceSharePayload,
  type WorkspaceShareStoredSnapshot,
} from './workspaceShareLink';

type CreateShortShareResponse = {
  id: string;
  expiresAt?: string;
};

type ReadShortShareResponse = {
  id: string;
  ciphertext: string;
  iv: string;
  compression: 'gzip' | 'none';
  createdAt: string;
  expiresAt?: string;
};

const shortSharePathPattern = /^\/s\/([A-Za-z0-9_-]{8,64})\/?$/;

export async function createWorkspaceShortShareUrl(payload: WorkspaceSharePayload, href = window.location.href): Promise<string> {
  const encrypted = await createWorkspaceShareEncryptedSnapshot(payload);
  const response = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      compression: encrypted.compression === 'g' ? 'gzip' : 'none',
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to create short share link.'));
  }

  const body = (await response.json()) as Partial<CreateShortShareResponse>;
  if (!body.id) {
    throw new Error('Short share API returned an incomplete response.');
  }

  return buildWorkspaceShortShareUrl(body.id, createWorkspaceShareKeyHash(encrypted), href);
}

export async function openWorkspaceShortShare(location: Location = window.location): Promise<WorkspaceSharePayload> {
  const id = readWorkspaceShortShareId(location.pathname);
  if (!id) {
    throw new Error('No short share id was found.');
  }
  if (!hasWorkspaceShareKeyHash(location.hash)) {
    throw new Error('The short share link is missing its decryption key.');
  }

  const response = await fetch(`/api/share?id=${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load short share link.'));
  }

  const body = (await response.json()) as Partial<ReadShortShareResponse>;
  const storedSnapshot = readStoredSnapshot(body);
  return decryptWorkspaceShareStoredSnapshot(storedSnapshot, location.hash);
}

export function hasWorkspaceShortShare(location: Location = window.location): boolean {
  return Boolean(readWorkspaceShortShareId(location.pathname)) && hasWorkspaceShareKeyHash(location.hash);
}

export function readWorkspaceShortShareId(pathname: string): string | undefined {
  return pathname.match(shortSharePathPattern)?.[1];
}

export function buildWorkspaceShortShareUrl(id: string, hash: string, href = window.location.href): string {
  const url = new URL(href);
  url.pathname = `/s/${id}`;
  url.search = '';
  url.hash = hash.startsWith('#') ? hash.slice(1) : hash;
  return url.toString();
}

function readStoredSnapshot(body: Partial<ReadShortShareResponse>): WorkspaceShareStoredSnapshot {
  if (!body.ciphertext || !body.iv || (body.compression !== 'gzip' && body.compression !== 'none')) {
    throw new Error('Short share API returned incomplete encrypted data.');
  }

  return {
    version: 1,
    compression: body.compression === 'gzip' ? 'g' : 'n',
    ciphertext: body.ciphertext,
    iv: body.iv,
  };
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' && body.error.trim() ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export { buildWorkspaceShareUrl };
