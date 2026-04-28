import { neon } from '@neondatabase/serverless';

type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

type CloudSlotCompression = 'gzip' | 'none';

type CloudSlotBody = {
  deviceId?: string;
  slotIndex?: unknown;
  slotName?: string;
  snapshotTitle?: string;
  ciphertext?: string;
  iv?: string;
  compression?: CloudSlotCompression;
};

type CloudSlotRow = {
  device_id: string;
  slot_index: number;
  slot_name: string;
  snapshot_title: string | null;
  payload_ciphertext: string;
  iv: string;
  compression: string;
  payload_size: number;
  created_at: string | Date;
  updated_at: string | Date;
};

const deviceIdPattern = /^[A-Za-z0-9_-]{12,80}$/;
const maxCiphertextLength = 4_000_000;
const maxSlotNameLength = 80;
const maxSnapshotTitleLength = 160;

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  try {
    if (request.method === 'GET') {
      await handleGet(request, response);
      return;
    }

    if (request.method === 'PUT') {
      await handlePut(request, response);
      return;
    }

    if (request.method === 'PATCH') {
      await handlePatch(request, response);
      return;
    }

    if (request.method === 'DELETE') {
      await handleDelete(request, response);
      return;
    }

    response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Cloud save API failed.' });
  }
}

async function handleGet(request: ApiRequest, response: ApiResponse) {
  const deviceId = readQueryString(request.query, 'deviceId');
  const deviceError = validateDeviceId(deviceId);
  if (deviceError) {
    response.status(400).json({ error: deviceError });
    return;
  }

  const slotValue = readQueryString(request.query, 'slot');
  if (slotValue) {
    const slotIndex = readSlotIndex(slotValue);
    if (!slotIndex) {
      response.status(400).json({ error: 'Slot must be 1, 2, or 3.' });
      return;
    }

    const record = await findSlot(deviceId!, slotIndex);
    if (!record) {
      response.status(404).json({ error: 'Cloud save slot is empty.' });
      return;
    }

    response.status(200).json(rowToRecord(record, true));
    return;
  }

  const slots = await listSlots(deviceId!);
  response.status(200).json({ deviceId, slots: slots.map((slot) => rowToRecord(slot, false)) });
}

async function handlePut(request: ApiRequest, response: ApiResponse) {
  const body = readBody(request.body);
  const error = validateUpsertBody(body);
  if (error) {
    response.status(400).json({ error });
    return;
  }

  const now = new Date().toISOString();
  const slot = await upsertSlot({
    deviceId: body.deviceId!,
    slotIndex: readSlotIndex(body.slotIndex)!,
    slotName: clampText(body.slotName, maxSlotNameLength) || `Slot ${body.slotIndex}`,
    snapshotTitle: clampText(body.snapshotTitle, maxSnapshotTitleLength) || undefined,
    ciphertext: body.ciphertext!,
    iv: body.iv!,
    compression: body.compression!,
    payloadSize: body.ciphertext!.length,
    now,
  });

  response.status(200).json(rowToRecord(slot, false));
}

async function handleDelete(request: ApiRequest, response: ApiResponse) {
  const body = readBody(request.body);
  const deviceError = validateDeviceId(body.deviceId);
  if (deviceError) {
    response.status(400).json({ error: deviceError });
    return;
  }
  const slotIndex = readSlotIndex(body.slotIndex);
  if (!slotIndex) {
    response.status(400).json({ error: 'Slot must be 1, 2, or 3.' });
    return;
  }

  await deleteSlot(body.deviceId!, slotIndex);
  response.status(200).json({ ok: true });
}

async function handlePatch(request: ApiRequest, response: ApiResponse) {
  const body = readBody(request.body);
  const deviceError = validateDeviceId(body.deviceId);
  if (deviceError) {
    response.status(400).json({ error: deviceError });
    return;
  }
  const slotIndex = readSlotIndex(body.slotIndex);
  if (!slotIndex) {
    response.status(400).json({ error: 'Slot must be 1, 2, or 3.' });
    return;
  }
  const slotName = clampText(body.slotName, maxSlotNameLength);
  if (!slotName) {
    response.status(400).json({ error: 'Slot name is required.' });
    return;
  }

  const slot = await renameSlot(body.deviceId!, slotIndex, slotName, new Date().toISOString());
  if (!slot) {
    response.status(404).json({ error: 'Cloud save slot is empty.' });
    return;
  }

  response.status(200).json(rowToRecord(slot, false));
}

function readBody(body: unknown): CloudSlotBody {
  if (typeof body === 'string') {
    try {
      return readBody(JSON.parse(body) as unknown);
    } catch {
      return {};
    }
  }
  if (!body || typeof body !== 'object') {
    return {};
  }
  const value = body as CloudSlotBody;
  return {
    deviceId: typeof value.deviceId === 'string' ? value.deviceId : undefined,
    slotIndex: value.slotIndex,
    slotName: typeof value.slotName === 'string' ? value.slotName : undefined,
    snapshotTitle: typeof value.snapshotTitle === 'string' ? value.snapshotTitle : undefined,
    ciphertext: typeof value.ciphertext === 'string' ? value.ciphertext : undefined,
    iv: typeof value.iv === 'string' ? value.iv : undefined,
    compression: value.compression === 'gzip' || value.compression === 'none' ? value.compression : undefined,
  };
}

function validateUpsertBody(body: CloudSlotBody): string | undefined {
  const deviceError = validateDeviceId(body.deviceId);
  if (deviceError) {
    return deviceError;
  }
  if (!readSlotIndex(body.slotIndex)) {
    return 'Slot must be 1, 2, or 3.';
  }
  if (!body.ciphertext) {
    return 'Encrypted payload is required.';
  }
  if (body.ciphertext.length > maxCiphertextLength) {
    return 'Encrypted payload is too large.';
  }
  if (!body.iv) {
    return 'Encryption IV is required.';
  }
  if (!body.compression) {
    return 'Compression mode is required.';
  }
  return undefined;
}

function validateDeviceId(deviceId?: string): string | undefined {
  if (!deviceId) {
    return 'Device id is required.';
  }
  if (!deviceIdPattern.test(deviceId)) {
    return 'Device id is invalid.';
  }
  return undefined;
}

function readSlotIndex(value: unknown): 1 | 2 | 3 | undefined {
  const numeric = Number(value);
  if (numeric === 1 || numeric === 2 || numeric === 3) {
    return numeric;
  }
  return undefined;
}

function readQueryString(query: ApiRequest['query'], key: string): string | undefined {
  const value = query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function clampText(value: string | undefined, maxLength: number): string {
  return (value ?? '').trim().slice(0, maxLength);
}

async function listSlots(deviceId: string): Promise<readonly CloudSlotRow[]> {
  return queryNeon<CloudSlotRow>(
    `
      select
        device_id,
        slot_index,
        slot_name,
        snapshot_title,
        payload_ciphertext,
        iv,
        compression,
        payload_size,
        created_at,
        updated_at
      from cloud_save_slots
      where device_id = $1
      order by slot_index asc
    `,
    [deviceId],
  );
}

async function findSlot(deviceId: string, slotIndex: number): Promise<CloudSlotRow | undefined> {
  const rows = await queryNeon<CloudSlotRow>(
    `
      select
        device_id,
        slot_index,
        slot_name,
        snapshot_title,
        payload_ciphertext,
        iv,
        compression,
        payload_size,
        created_at,
        updated_at
      from cloud_save_slots
      where device_id = $1
        and slot_index = $2
      limit 1
    `,
    [deviceId, slotIndex],
  );
  return rows[0];
}

async function upsertSlot(input: {
  deviceId: string;
  slotIndex: number;
  slotName: string;
  snapshotTitle?: string;
  ciphertext: string;
  iv: string;
  compression: CloudSlotCompression;
  payloadSize: number;
  now: string;
}): Promise<CloudSlotRow> {
  const rows = await queryNeon<CloudSlotRow>(
    `
      insert into cloud_save_slots (
        device_id,
        slot_index,
        slot_name,
        snapshot_title,
        payload_ciphertext,
        iv,
        compression,
        payload_size,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      on conflict (device_id, slot_index)
      do update set
        slot_name = excluded.slot_name,
        snapshot_title = excluded.snapshot_title,
        payload_ciphertext = excluded.payload_ciphertext,
        iv = excluded.iv,
        compression = excluded.compression,
        payload_size = excluded.payload_size,
        updated_at = excluded.updated_at
      returning
        device_id,
        slot_index,
        slot_name,
        snapshot_title,
        payload_ciphertext,
        iv,
        compression,
        payload_size,
        created_at,
        updated_at
    `,
    [
      input.deviceId,
      input.slotIndex,
      input.slotName,
      input.snapshotTitle ?? null,
      input.ciphertext,
      input.iv,
      input.compression,
      input.payloadSize,
      input.now,
    ],
  );
  const row = rows[0];
  if (!row) {
    throw new Error('Cloud save slot was not saved.');
  }
  return row;
}

async function deleteSlot(deviceId: string, slotIndex: number): Promise<void> {
  await queryNeon(
    `
      delete from cloud_save_slots
      where device_id = $1
        and slot_index = $2
    `,
    [deviceId, slotIndex],
  );
}

async function renameSlot(deviceId: string, slotIndex: number, slotName: string, now: string): Promise<CloudSlotRow | undefined> {
  const rows = await queryNeon<CloudSlotRow>(
    `
      update cloud_save_slots
      set slot_name = $3,
          updated_at = $4
      where device_id = $1
        and slot_index = $2
      returning
        device_id,
        slot_index,
        slot_name,
        snapshot_title,
        payload_ciphertext,
        iv,
        compression,
        payload_size,
        created_at,
        updated_at
    `,
    [deviceId, slotIndex, slotName, now],
  );
  return rows[0];
}

async function queryNeon<Row extends Record<string, unknown>>(
  query: string,
  params: readonly unknown[] = [],
): Promise<readonly Row[]> {
  const databaseUrl = process.env.NEON_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('NEON_DATABASE_URL is not configured.');
  }

  const sql = neon(databaseUrl);
  const rows = await sql.query(query, [...params]);
  return rows as readonly Row[];
}

function rowToRecord(row: CloudSlotRow, includePayload: boolean) {
  return {
    deviceId: row.device_id,
    slotIndex: Number(row.slot_index),
    slotName: row.slot_name,
    snapshotTitle: row.snapshot_title ?? undefined,
    compression: row.compression === 'none' ? 'none' : 'gzip',
    payloadSize: Number(row.payload_size ?? 0),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    ...(includePayload
      ? {
          ciphertext: row.payload_ciphertext,
          iv: row.iv,
        }
      : {}),
  };
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
