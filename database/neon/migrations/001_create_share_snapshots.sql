create table if not exists share_snapshots (
  id text primary key,
  payload_ciphertext text not null,
  iv text not null,
  compression text not null default 'gzip',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  opened_at timestamptz,
  open_count integer not null default 0,
  constraint share_snapshots_id_format check (id ~ '^[A-Za-z0-9_-]{8,64}$'),
  constraint share_snapshots_compression check (compression in ('gzip', 'none')),
  constraint share_snapshots_open_count_nonnegative check (open_count >= 0)
);

create index if not exists share_snapshots_expires_at_idx
  on share_snapshots (expires_at)
  where expires_at is not null;

create index if not exists share_snapshots_created_at_idx
  on share_snapshots (created_at);
