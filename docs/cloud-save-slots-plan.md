# Cloud Save Slots Plan

## Summary
Tambahkan fitur **Save to Cloud** berbasis Neon dengan maksimal **3 slot per device**. Setiap device memakai anonymous `deviceId` di `localStorage`, tiap slot menyimpan encrypted workspace snapshot seperti mekanisme share saat ini. Link share tidak lagi otomatis mengganti workspace lokal; user memilih slot tujuan lebih dulu.

## Key Changes
- Tambahkan model cloud slot:
  - `deviceId`: random URL-safe id, disimpan lokal.
  - `slotIndex`: hanya `1 | 2 | 3`.
  - encrypted payload: reuse format `WorkspaceSharePayload` (`plan`, `guild`, `activePhaseId`) dengan AES-GCM seperti share.
  - metadata aman: `slotName`, `updatedAt`, `createdAt`, payload size, optional `snapshotTitle`.
- Tambahkan Neon migration baru untuk tabel cloud slots:
  - primary key gabungan `device_id + slot_index`.
  - constraint slot hanya 1 sampai 3.
  - simpan `payload_ciphertext`, `iv`, `compression`, metadata, timestamps.
- Tambahkan API baru `/api/cloud-slots`:
  - `GET ?deviceId=...`: list slot metadata tanpa ciphertext penuh.
  - `GET ?deviceId=...&slot=1`: load encrypted slot.
  - `PUT`: upsert slot tertentu.
  - `DELETE`: clear slot.
  - validasi size mengikuti batas share payload.
- Tambahkan client module cloud slot:
  - generate/read anonymous device id.
  - encrypt workspace untuk save slot.
  - decrypt slot untuk load.
  - call API dan normalize response.
- Tambahkan UI:
  - Top bar action `Cloud Saves`.
  - Dialog slot 1-3 dengan state `empty`, `saved`, `loading`, `error`.
  - Actions per slot: `Save Current`, `Load`, `Rename`, `Clear`.
  - Share preview dialog menampilkan pilihan slot 1-3 sebelum `Save Copy`.
  - Setelah save share ke slot, user bisa langsung load slot tersebut ke workspace aktif.

## UX Behavior
- Local workspace tetap ada seperti sekarang, tapi cloud slot menjadi pilihan eksplisit.
- Save ke slot yang sudah berisi data harus menampilkan confirm overwrite.
- Load slot mengganti workspace aktif setelah confirm jika workspace lokal berbeda.
- Opening share link:
  - preview tetap read-only.
  - user memilih slot tujuan.
  - `Save Copy` menyimpan encrypted snapshot ke slot tersebut.
  - setelah berhasil, app memuat snapshot dari slot yang baru disimpan.
- Kalau API/Neon gagal, app tetap bisa dipakai lokal dan menampilkan error di dialog.

## Implementation Order
- Tambahkan migration Neon dan tipe/store server untuk cloud slots.
- Tambahkan endpoint `/api/cloud-slots`.
- Tambahkan client cloud slot helpers dan tests.
- Tambahkan dialog UI cloud saves di app.
- Integrasikan share preview dengan pemilihan slot.
- Tambahkan E2E untuk save/load/overwrite/share-to-slot.

## Test Plan
- Unit tests:
  - device id generation stable.
  - slot index validation hanya 1-3.
  - encrypt/decrypt cloud payload roundtrip.
  - API body validation.
  - Neon store upsert/list/load/delete.
- E2E:
  - save current workspace ke Slot 1.
  - load Slot 1 mengganti workspace aktif.
  - overwrite slot menampilkan confirmation.
  - clear slot membuatnya empty.
  - open share link, pilih Slot 2, save, lalu load Slot 2.
  - mobile dialog slot tidak overflow.
- Regression:
  - existing share link tetap berjalan.
  - existing local storage persistence tetap berjalan.
  - `npm run build`, `npm run test`, dan Playwright smoke/visual tetap hijau.

## Assumptions
- Identitas device memakai anonymous random id di `localStorage`, tanpa login.
- Data cloud slot disimpan encrypted blob di Neon; server tidak perlu membaca isi strategi/guild.
- Batas 3 slot berlaku per `deviceId`, bukan per akun.
- Share preview memakai flow **choose slot first** sebelum save.
