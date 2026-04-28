import type { GuildDatabase, TacticalPlan, WorkspaceSnapshot } from '../types/domain';

export type WorkspaceSharePayload = WorkspaceSnapshot & {
  version: 1;
  createdAt: string;
};

export type WorkspaceShareCompression = 'g' | 'n';

type ShareHashParts = {
  compression: WorkspaceShareCompression;
  key: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
};

const shareHashKey = 'wwm-share';
const shareVersion = 'v1';
const encryptionAlgorithm = 'AES-GCM';
const keyLengthBytes = 32;
const ivLengthBytes = 12;

export class WorkspaceShareLinkError extends Error {
  constructor(message = 'Unable to open shared workspace link.') {
    super(message);
    this.name = 'WorkspaceShareLinkError';
  }
}

export function createWorkspaceSharePayload(
  plan: TacticalPlan,
  guild: GuildDatabase,
  activePhaseId: string,
  createdAt = new Date().toISOString(),
): WorkspaceSharePayload {
  return {
    version: 1,
    createdAt,
    plan,
    guild,
    activePhaseId,
  };
}

export async function createWorkspaceShareHash(
  payload: WorkspaceSharePayload,
  options: { compression?: WorkspaceShareCompression } = {},
): Promise<string> {
  const cryptoApi = getCryptoApi();
  const encodedPayload = textToBytes(JSON.stringify(toSerializableSharePayload(payload)));
  const compression = options.compression ?? (supportsCompressionStream() ? 'g' : 'n');
  const plaintext = compression === 'g' ? await gzipBytes(encodedPayload) : encodedPayload;
  const key = cryptoApi.getRandomValues(new Uint8Array(keyLengthBytes));
  const iv = cryptoApi.getRandomValues(new Uint8Array(ivLengthBytes));
  const cryptoKey = await cryptoApi.subtle.importKey('raw', toArrayBuffer(key), encryptionAlgorithm, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await cryptoApi.subtle.encrypt({ name: encryptionAlgorithm, iv: toArrayBuffer(iv) }, cryptoKey, toArrayBuffer(plaintext)),
  );

  return `#${shareHashKey}=${[
    shareVersion,
    compression,
    bytesToBase64Url(key),
    bytesToBase64Url(iv),
    bytesToBase64Url(ciphertext),
  ].join('.')}`;
}

function toSerializableSharePayload(payload: WorkspaceSharePayload): WorkspaceSharePayload {
  return {
    version: 1,
    createdAt: payload.createdAt,
    plan: payload.plan,
    guild: payload.guild,
    activePhaseId: payload.activePhaseId,
  };
}

export async function decryptWorkspaceShareHash(hash: string): Promise<WorkspaceSharePayload> {
  const token = readWorkspaceShareToken(hash);
  if (!token) {
    throw new WorkspaceShareLinkError('No shared workspace link was found.');
  }

  const parts = parseShareHashParts(token);
  const cryptoApi = getCryptoApi();

  try {
    const cryptoKey = await cryptoApi.subtle.importKey('raw', toArrayBuffer(parts.key), encryptionAlgorithm, false, ['decrypt']);
    const decrypted = new Uint8Array(
      await cryptoApi.subtle.decrypt(
        { name: encryptionAlgorithm, iv: toArrayBuffer(parts.iv) },
        cryptoKey,
        toArrayBuffer(parts.ciphertext),
      ),
    );
    const payloadBytes = parts.compression === 'g' ? await gunzipBytes(decrypted) : decrypted;
    return parseSharePayload(bytesToText(payloadBytes));
  } catch (error) {
    if (error instanceof WorkspaceShareLinkError) {
      throw error;
    }
    throw new WorkspaceShareLinkError('The shared workspace link is invalid or has been changed.');
  }
}

export function readWorkspaceShareToken(hash: string): string | undefined {
  const trimmedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmedHash);
  return params.get(shareHashKey)?.trim() || undefined;
}

export function hasWorkspaceShareHash(hash: string): boolean {
  return Boolean(readWorkspaceShareToken(hash));
}

export function buildWorkspaceShareUrl(hash: string, href = globalThis.location?.href ?? ''): string {
  const url = new URL(href || globalThis.location?.origin || 'http://localhost/');
  url.hash = hash.startsWith('#') ? hash.slice(1) : hash;
  return url.toString();
}

function parseShareHashParts(token: string): ShareHashParts {
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== shareVersion) {
    throw new WorkspaceShareLinkError('The shared workspace link format is not supported.');
  }

  const compression = parts[1];
  if (compression !== 'g' && compression !== 'n') {
    throw new WorkspaceShareLinkError('The shared workspace compression mode is not supported.');
  }

  const key = base64UrlToBytes(parts[2]);
  const iv = base64UrlToBytes(parts[3]);
  const ciphertext = base64UrlToBytes(parts[4]);

  if (key.length !== keyLengthBytes || iv.length !== ivLengthBytes || ciphertext.length === 0) {
    throw new WorkspaceShareLinkError('The shared workspace link format is invalid.');
  }

  return { compression, key, iv, ciphertext };
}

function parseSharePayload(json: string): WorkspaceSharePayload {
  try {
    const parsed = JSON.parse(json) as Partial<WorkspaceSharePayload>;
    if (
      parsed.version !== 1 ||
      !parsed.plan ||
      !parsed.guild ||
      typeof parsed.activePhaseId !== 'string' ||
      typeof parsed.createdAt !== 'string'
    ) {
      throw new WorkspaceShareLinkError('The shared workspace data is incomplete.');
    }

    return parsed as WorkspaceSharePayload;
  } catch (error) {
    if (error instanceof WorkspaceShareLinkError) {
      throw error;
    }
    throw new WorkspaceShareLinkError('The shared workspace data could not be read.');
  }
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (!supportsCompressionStream()) {
    return bytes;
  }

  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new CompressionStream('gzip'));
  return streamToBytes(stream);
}

async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (!supportsDecompressionStream()) {
    throw new WorkspaceShareLinkError('This browser cannot decompress shared workspace links.');
  }

  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return streamToBytes(stream);
}

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value);
      totalLength += value.length;
    }
  }

  const output = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function supportsCompressionStream(): boolean {
  return typeof CompressionStream !== 'undefined';
}

function supportsDecompressionStream(): boolean {
  return typeof DecompressionStream !== 'undefined';
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new WorkspaceShareLinkError('The shared workspace link format is invalid.');
  }

  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToText(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function getCryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new WorkspaceShareLinkError('This browser cannot create or open encrypted share links.');
  }

  return globalThis.crypto;
}
