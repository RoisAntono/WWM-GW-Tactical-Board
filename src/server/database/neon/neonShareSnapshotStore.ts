import type { ShareSnapshotStore } from '../../share/shareSnapshotStore';
import { ShareSnapshotStoreError } from '../../share/shareSnapshotStore';
import type { CreateShareSnapshotInput, FindShareSnapshotOptions, ShareSnapshotRecord } from '../../share/shareSnapshotTypes';

export type NeonSqlRow = Record<string, unknown>;

export type NeonSqlExecutor = <Row extends NeonSqlRow = NeonSqlRow>(
  query: string,
  params?: readonly unknown[],
) => Promise<readonly Row[]>;

type ShareSnapshotRow = {
  id: string;
  payload_ciphertext: string;
  iv: string;
  compression: string;
  created_at: string | Date;
  expires_at: string | Date | null;
  opened_at: string | Date | null;
  open_count: number;
};

const idPattern = /^[A-Za-z0-9_-]{8,64}$/;

export function createNeonShareSnapshotStore(sql: NeonSqlExecutor): ShareSnapshotStore {
  return {
    async create(input) {
      validateCreateInput(input);
      const createdAt = input.createdAt ?? new Date().toISOString();
      const rows = await sql<ShareSnapshotRow>(
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
            expires_at,
            opened_at,
            open_count
        `,
        [input.id, input.ciphertext, input.iv, input.compression, createdAt, input.expiresAt ?? null],
      );

      const row = rows[0];
      if (!row) {
        throw new ShareSnapshotStoreError('Share snapshot was not created.', 'storage-error');
      }

      return rowToRecord(row);
    },

    async findById(id, options) {
      if (!idPattern.test(id)) {
        return undefined;
      }

      const now = toIsoString(options?.now ?? new Date());
      const rows = await sql<ShareSnapshotRow>(
        `
          select
            id,
            payload_ciphertext,
            iv,
            compression,
            created_at,
            expires_at,
            opened_at,
            open_count
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

      if (options?.touch !== false) {
        await sql(
          `
            update share_snapshots
            set opened_at = $2,
                open_count = open_count + 1
            where id = $1
          `,
          [id, now],
        );
      }

      return rowToRecord(row);
    },

    async deleteExpired(now = new Date()) {
      const rows = await sql<{ deleted_count: number }>(
        `
          with deleted as (
            delete from share_snapshots
            where expires_at is not null
              and expires_at <= $1
            returning id
          )
          select count(*)::int as deleted_count
          from deleted
        `,
        [toIsoString(now)],
      );

      return Number(rows[0]?.deleted_count ?? 0);
    },
  };
}

function validateCreateInput(input: CreateShareSnapshotInput): void {
  if (!idPattern.test(input.id)) {
    throw new ShareSnapshotStoreError('Share snapshot id must be 8-64 URL-safe characters.', 'invalid-input');
  }
  if (!input.ciphertext.trim()) {
    throw new ShareSnapshotStoreError('Share snapshot ciphertext is required.', 'invalid-input');
  }
  if (!input.iv.trim()) {
    throw new ShareSnapshotStoreError('Share snapshot IV is required.', 'invalid-input');
  }
  if (input.compression !== 'gzip' && input.compression !== 'none') {
    throw new ShareSnapshotStoreError('Unsupported share snapshot compression mode.', 'invalid-input');
  }
}

function rowToRecord(row: ShareSnapshotRow): ShareSnapshotRecord {
  return {
    id: row.id,
    ciphertext: row.payload_ciphertext,
    iv: row.iv,
    compression: row.compression === 'none' ? 'none' : 'gzip',
    createdAt: toIsoString(row.created_at),
    expiresAt: row.expires_at ? toIsoString(row.expires_at) : undefined,
    openedAt: row.opened_at ? toIsoString(row.opened_at) : undefined,
    openCount: Number(row.open_count ?? 0),
  };
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
