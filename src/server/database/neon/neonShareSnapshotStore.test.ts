import { describe, expect, it } from 'vitest';
import { ShareSnapshotStoreError } from '../../share/shareSnapshotStore';
import { createNeonShareSnapshotStore, type NeonSqlExecutor, type NeonSqlRow } from './neonShareSnapshotStore';

describe('neon share snapshot store', () => {
  it('creates and reads share snapshots through the provider-neutral store', async () => {
    const calls: Array<{ query: string; params: readonly unknown[] }> = [];
    const sql: NeonSqlExecutor = async <Row extends NeonSqlRow>(query: string, params: readonly unknown[] = []) => {
      calls.push({ query, params });
      if (query.includes('insert into share_snapshots')) {
        return [
          {
            id: params[0],
            payload_ciphertext: params[1],
            iv: params[2],
            compression: params[3],
            created_at: params[4],
            expires_at: params[5],
            opened_at: null,
            open_count: 0,
          } as unknown as Row,
        ];
      }
      if (query.includes('from share_snapshots') && query.includes('where id = $1')) {
        return [
          {
            id: params[0],
            payload_ciphertext: 'ciphertext',
            iv: 'iv',
            compression: 'gzip',
            created_at: '2026-04-28T00:00:00.000Z',
            expires_at: null,
            opened_at: null,
            open_count: 0,
          } as unknown as Row,
        ];
      }
      return [] as Row[];
    };
    const store = createNeonShareSnapshotStore(sql);

    const created = await store.create({
      id: 'share_123',
      ciphertext: 'ciphertext',
      iv: 'iv',
      compression: 'gzip',
      createdAt: '2026-04-28T00:00:00.000Z',
    });
    const found = await store.findById('share_123', { now: new Date('2026-04-28T00:00:01.000Z') });

    expect(created).toMatchObject({ id: 'share_123', ciphertext: 'ciphertext', compression: 'gzip' });
    expect(found).toMatchObject({ id: 'share_123', ciphertext: 'ciphertext', compression: 'gzip' });
    expect(calls.some((call) => call.query.includes('open_count = open_count + 1'))).toBe(true);
  });

  it('rejects invalid share ids before writing', async () => {
    const store = createNeonShareSnapshotStore(async () => []);

    await expect(
      store.create({
        id: '../bad',
        ciphertext: 'ciphertext',
        iv: 'iv',
        compression: 'gzip',
      }),
    ).rejects.toMatchObject(new ShareSnapshotStoreError('Share snapshot id must be 8-64 URL-safe characters.', 'invalid-input'));
  });
});
