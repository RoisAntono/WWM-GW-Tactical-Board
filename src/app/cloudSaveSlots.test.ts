import { afterEach, describe, expect, test, vi } from 'vitest';
import { createDefaultPlan } from '../features/strategy/defaultPlan';
import type { GuildDatabase } from '../types/domain';
import {
  getCloudDeviceId,
  loadCloudSlot,
  readCloudSlotIndex,
  saveCloudSlot,
} from './cloudSaveSlots';
import { createWorkspaceSharePayload } from './workspaceShareLink';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const guild: GuildDatabase = {
  members: [],
  matches: [],
  performances: [],
  importBatches: [],
  updatedAt: '2026-04-28T00:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cloud save slots', () => {
  test('creates and reuses an anonymous device id', () => {
    const storage = new MemoryStorage();
    const first = getCloudDeviceId(storage);
    const second = getCloudDeviceId(storage);

    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{12,80}$/);
  });

  test('validates slot indexes', () => {
    expect(readCloudSlotIndex(1)).toBe(1);
    expect(readCloudSlotIndex('2')).toBe(2);
    expect(readCloudSlotIndex(4)).toBeUndefined();
    expect(readCloudSlotIndex('x')).toBeUndefined();
  });

  test('saves and loads an encrypted slot payload', async () => {
    const storage = new MemoryStorage();
    const deviceId = getCloudDeviceId(storage);
    vi.stubGlobal('localStorage', storage);

    let stored: Record<string, unknown> | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'PUT') {
          const body = JSON.parse(String(init.body)) as Record<string, string | number>;
          stored = body;
          return jsonResponse({
            deviceId: body.deviceId,
            slotIndex: body.slotIndex,
            slotName: body.slotName,
            snapshotTitle: body.snapshotTitle,
            compression: body.compression,
            payloadSize: String(body.ciphertext).length,
            createdAt: '2026-04-28T00:00:00.000Z',
            updatedAt: '2026-04-28T00:00:00.000Z',
          });
        }

        if (url.includes('/api/cloud-slots') && url.includes('slot=1')) {
          return jsonResponse({
            deviceId,
            slotIndex: 1,
            slotName: 'Slot 1',
            snapshotTitle: 'Cloud Roundtrip',
            compression: stored?.compression,
            payloadSize: String(stored?.ciphertext).length,
            createdAt: '2026-04-28T00:00:00.000Z',
            updatedAt: '2026-04-28T00:00:00.000Z',
            ciphertext: stored?.ciphertext,
            iv: stored?.iv,
          });
        }

        return jsonResponse({}, 404);
      }),
    );

    const plan = createDefaultPlan();
    plan.title = 'Cloud Roundtrip';
    const payload = createWorkspaceSharePayload(plan, guild, plan.phases[0].id, '2026-04-28T00:00:00.000Z');

    await saveCloudSlot(1, payload, { deviceId, slotName: 'Slot 1' });
    const loaded = await loadCloudSlot(1, deviceId);

    expect(loaded.payload.plan.title).toBe('Cloud Roundtrip');
    expect(loaded.payload.activePhaseId).toBe(plan.phases[0].id);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
