import { assets } from '../shared/assets';
import type { GuildDatabase } from '../types/domain';
import { persistStorageName, persistVersion } from './persistenceConfig';

export type AppDiagnostics = {
  persistVersion: number;
  storedVersion?: number;
  storageKey: string;
  storageSizeLabel: string;
  storageStatus: string;
  memberCount: number;
  matchCount: number;
  performanceCount: number;
  importBatchCount: number;
  mapUrl: string;
  mapFormat: string;
  mapAssetLabel: string;
  backupReminder: string;
};

const optimizedMapAssetLabel = '5792x4344 WebP, 0.48 MB source output';

export function getAppDiagnostics(guild: GuildDatabase, storage: Storage | undefined = getBrowserLocalStorage()): AppDiagnostics {
  const storedValue = readStoredValue(storage, persistStorageName);
  const storedVersion = readStoredVersion(storedValue);

  return {
    persistVersion,
    storedVersion,
    storageKey: persistStorageName,
    storageSizeLabel: formatBytes(estimateStorageBytes(storage)),
    storageStatus: formatStorageStatus(storedVersion),
    memberCount: guild.members.length,
    matchCount: guild.matches.length,
    performanceCount: guild.performances.length,
    importBatchCount: guild.importBatches.length,
    mapUrl: assets.map,
    mapFormat: assets.mapFormat,
    mapAssetLabel: optimizedMapAssetLabel,
    backupReminder: 'Export a workspace backup after major roster, match, or board changes.',
  };
}

export function estimateStorageBytes(storage: Storage | undefined): number {
  if (!storage) {
    return 0;
  }

  let total = 0;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index) ?? '';
    const value = storage.getItem(key) ?? '';
    total += (key.length + value.length) * 2;
  }

  return total;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${Math.round(bytes)} B`;
}

function formatStorageStatus(storedVersion: number | undefined): string {
  if (storedVersion === undefined) {
    return 'No local workspace saved yet';
  }

  if (storedVersion === persistVersion) {
    return `Current v${persistVersion}`;
  }

  if (storedVersion < persistVersion) {
    return `Migrated from v${storedVersion} to v${persistVersion}`;
  }

  return `Stored v${storedVersion}, app v${persistVersion}`;
}

function readStoredValue(storage: Storage | undefined, key: string): string | undefined {
  try {
    return storage?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function readStoredVersion(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as { version?: unknown };
    return typeof parsed.version === 'number' && Number.isFinite(parsed.version) ? parsed.version : undefined;
  } catch {
    return undefined;
  }
}

function getBrowserLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
