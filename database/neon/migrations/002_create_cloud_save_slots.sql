create table if not exists cloud_save_slots (
  device_id text not null,
  slot_index integer not null,
  slot_name text not null,
  snapshot_title text,
  payload_ciphertext text not null,
  iv text not null,
  compression text not null default 'gzip',
  payload_size integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (device_id, slot_index),
  constraint cloud_save_slots_device_id_format check (device_id ~ '^[A-Za-z0-9_-]{12,80}$'),
  constraint cloud_save_slots_slot_index_range check (slot_index between 1 and 3),
  constraint cloud_save_slots_compression check (compression in ('gzip', 'none')),
  constraint cloud_save_slots_payload_size_nonnegative check (payload_size >= 0),
  constraint cloud_save_slots_slot_name_nonempty check (length(trim(slot_name)) between 1 and 80)
);

create index if not exists cloud_save_slots_updated_at_idx
  on cloud_save_slots (updated_at);
