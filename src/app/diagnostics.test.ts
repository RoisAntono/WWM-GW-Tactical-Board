import { describe, expect, it } from 'vitest';
import type { GuildDatabase } from '../types/domain';
import { estimateStorageBytes, formatBytes, getAppDiagnostics } from './diagnostics';
import { persistStorageName, persistVersion } from './persistenceConfig';

describe('app diagnostics', () => {
  it('reports storage status, counts, and formatted storage size', () => {
    const storage = new MemoryStorage({
      [persistStorageName]: JSON.stringify({ version: persistVersion, state: { plan: { title: 'Plan' } } }),
      extra: 'abc',
    });
    const diagnostics = getAppDiagnostics(
      {
        members: [{ id: 'member-1' } as never],
        matches: [{ id: 'match-1' } as never],
        performances: [{ id: 'performance-1' } as never],
        importBatches: [{ id: 'batch-1' } as never],
        updatedAt: '2026-04-28T00:00:00.000Z',
      },
      storage,
    );

    expect(diagnostics).toMatchObject({
      persistVersion,
      storedVersion: persistVersion,
      storageKey: persistStorageName,
      storageStatus: `Current v${persistVersion}`,
      memberCount: 1,
      matchCount: 1,
      performanceCount: 1,
      importBatchCount: 1,
      mapFormat: 'webp',
    });
    expect(diagnostics.storageSizeLabel).toMatch(/\d/);
  });

  it('formats migration status for older persisted versions', () => {
    const diagnostics = getAppDiagnostics(emptyGuild(), new MemoryStorage({ [persistStorageName]: JSON.stringify({ version: 8 }) }));

    expect(diagnostics.storageStatus).toBe(`Migrated from v8 to v${persistVersion}`);
  });

  it('estimates localStorage bytes from keys and values', () => {
    expect(estimateStorageBytes(new MemoryStorage({ a: 'bc' }))).toBe(6);
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

function emptyGuild(): GuildDatabase {
  return {
    members: [],
    matches: [],
    performances: [],
    importBatches: [],
    updatedAt: '2026-04-28T00:00:00.000Z',
  };
}

class MemoryStorage implements Storage {
  private values: Record<string, string>;

  constructor(values: Record<string, string>) {
    this.values = { ...values };
  }

  get length() {
    return Object.keys(this.values).length;
  }

  clear(): void {
    this.values = {};
  }

  getItem(key: string): string | null {
    return this.values[key] ?? null;
  }

  key(index: number): string | null {
    return Object.keys(this.values)[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.values[key];
  }

  setItem(key: string, value: string): void {
    this.values[key] = value;
  }
}
