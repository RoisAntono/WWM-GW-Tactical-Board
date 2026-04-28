import {
  createWorkspaceShareEncryptedSnapshot,
  decryptWorkspaceShareStoredSnapshot,
  type WorkspaceSharePayload,
  type WorkspaceShareStoredSnapshot,
} from './workspaceShareLink';

export type CloudSlotIndex = 1 | 2 | 3;

export type CloudSlotMetadata = {
  deviceId: string;
  slotIndex: CloudSlotIndex;
  slotName: string;
  snapshotTitle?: string;
  compression: 'gzip' | 'none';
  payloadSize: number;
  createdAt: string;
  updatedAt: string;
};

export type CloudSlotRecord = CloudSlotMetadata & {
  ciphertext: string;
  iv: string;
};

type CloudSlotListResponse = {
  deviceId?: string;
  slots?: Partial<CloudSlotMetadata>[];
};

const deviceIdStorageKey = 'wwm-cloud-device-id';
const deviceIdPattern = /^[A-Za-z0-9_-]{12,80}$/;

export const cloudSlotIndexes = [1, 2, 3] as const;

export function getCloudDeviceId(storage: Storage = getLocalStorage()): string {
  const existing = storage.getItem(deviceIdStorageKey);
  if (existing && deviceIdPattern.test(existing)) {
    return existing;
  }

  const next = createDeviceId();
  storage.setItem(deviceIdStorageKey, next);
  return next;
}

export function readCloudSlotIndex(value: unknown): CloudSlotIndex | undefined {
  const numeric = Number(value);
  return numeric === 1 || numeric === 2 || numeric === 3 ? numeric : undefined;
}

export async function listCloudSlots(deviceId = getCloudDeviceId()): Promise<CloudSlotMetadata[]> {
  const response = await fetch(`/api/cloud-slots?deviceId=${encodeURIComponent(deviceId)}`);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load cloud save slots.'));
  }

  const body = (await response.json()) as CloudSlotListResponse;
  return (body.slots ?? []).map(readCloudSlotMetadata).filter(Boolean) as CloudSlotMetadata[];
}

export async function loadCloudSlot(slotIndex: CloudSlotIndex, deviceId = getCloudDeviceId()): Promise<{
  metadata: CloudSlotMetadata;
  payload: WorkspaceSharePayload;
}> {
  const response = await fetch(`/api/cloud-slots?deviceId=${encodeURIComponent(deviceId)}&slot=${slotIndex}`);
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load cloud save slot.'));
  }

  const record = readCloudSlotRecord((await response.json()) as Partial<CloudSlotRecord>);
  const storedSnapshot: WorkspaceShareStoredSnapshot = {
    version: 1,
    compression: record.compression === 'gzip' ? 'g' : 'n',
    ciphertext: record.ciphertext,
    iv: record.iv,
  };
  const keyHash = createCloudSlotKeyHash(storedSnapshot.compression, record.slotIndex);
  const payload = await decryptWorkspaceShareStoredSnapshot(storedSnapshot, keyHash);
  return { metadata: toMetadata(record), payload };
}

export async function saveCloudSlot(
  slotIndex: CloudSlotIndex,
  payload: WorkspaceSharePayload,
  options: { slotName?: string; deviceId?: string } = {},
): Promise<CloudSlotMetadata> {
  const deviceId = options.deviceId ?? getCloudDeviceId();
  const encrypted = await createWorkspaceShareEncryptedSnapshot(payload);
  const response = await fetch('/api/cloud-slots', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      slotIndex,
      slotName: options.slotName || `Slot ${slotIndex}`,
      snapshotTitle: payload.plan.title,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      compression: encrypted.compression === 'g' ? 'gzip' : 'none',
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to save cloud slot.'));
  }

  const saved = readCloudSlotMetadata((await response.json()) as Partial<CloudSlotMetadata>);
  if (!saved) {
    throw new Error('Cloud save API returned an incomplete slot.');
  }

  storeCloudSlotKey(slotIndex, encrypted.key);
  return saved;
}

export async function deleteCloudSlot(slotIndex: CloudSlotIndex, deviceId = getCloudDeviceId()): Promise<void> {
  const response = await fetch('/api/cloud-slots', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, slotIndex }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to clear cloud slot.'));
  }

  getLocalStorage().removeItem(getSlotKeyStorageKey(slotIndex));
}

export async function renameCloudSlot(
  slotIndex: CloudSlotIndex,
  slotName: string,
  deviceId = getCloudDeviceId(),
): Promise<CloudSlotMetadata> {
  const response = await fetch('/api/cloud-slots', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, slotIndex, slotName }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to rename cloud slot.'));
  }

  const renamed = readCloudSlotMetadata((await response.json()) as Partial<CloudSlotMetadata>);
  if (!renamed) {
    throw new Error('Cloud save API returned an incomplete slot.');
  }
  return renamed;
}

export function storeCloudSlotKey(slotIndex: CloudSlotIndex, key: string, storage: Storage = getLocalStorage()): void {
  storage.setItem(getSlotKeyStorageKey(slotIndex), key);
}

function createCloudSlotKeyHash(compression: 'g' | 'n', slotIndex: CloudSlotIndex): string {
  const key = getLocalStorage().getItem(getSlotKeyStorageKey(slotIndex));
  if (!key) {
    throw new Error('This cloud slot is missing its local decryption key. Save it again on this device.');
  }

  return `#wwm-share-key=v1.${compression}.${key}`;
}

function getLocalStorage(): Storage {
  if (!globalThis.localStorage) {
    throw new Error('Local storage is not available.');
  }
  return globalThis.localStorage;
}

function createDeviceId(): string {
  const bytes = new Uint8Array(18);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToBase64Url(bytes);
}

function getSlotKeyStorageKey(slotIndex: CloudSlotIndex): string {
  return `${deviceIdStorageKey}:slot-key:${slotIndex}`;
}

function readCloudSlotMetadata(value: Partial<CloudSlotMetadata>): CloudSlotMetadata | undefined {
  const slotIndex = readCloudSlotIndex(value.slotIndex);
  if (!value.deviceId || !slotIndex || !value.slotName || !value.createdAt || !value.updatedAt) {
    return undefined;
  }

  return {
    deviceId: value.deviceId,
    slotIndex,
    slotName: value.slotName,
    snapshotTitle: value.snapshotTitle,
    compression: value.compression === 'none' ? 'none' : 'gzip',
    payloadSize: Number(value.payloadSize ?? 0),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function readCloudSlotRecord(value: Partial<CloudSlotRecord>): CloudSlotRecord {
  const metadata = readCloudSlotMetadata(value);
  if (!metadata || !value.ciphertext || !value.iv) {
    throw new Error('Cloud save API returned an incomplete slot.');
  }

  return {
    ...metadata,
    ciphertext: value.ciphertext,
    iv: value.iv,
  };
}

function toMetadata(record: CloudSlotRecord): CloudSlotMetadata {
  const { ciphertext: _ciphertext, iv: _iv, ...metadata } = record;
  return metadata;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' && body.error.trim() ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
