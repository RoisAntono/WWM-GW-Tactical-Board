# Board Flexibility Roadmap

Last updated: 2026-04-30

## Summary
Roadmap ini menyimpan rencana bertahap untuk membuat tactical board lebih fleksibel seperti tool canvas modern. Fokus utamanya adalah mengurangi friksi saat membuat plan, terutama di mode Focus, tanpa membuat UI utama terlalu penuh.

## Goals
- Board tetap menjadi area kerja utama di desktop dan mobile.
- User bisa membuat plan dari mode Focus tanpa sering keluar-masuk panel.
- Squad, Inspector, Phases, layer visibility, export, dan save/share workflow terasa modular.
- Perubahan dilakukan bertahap agar tidak merusak mobile responsiveness dan performa low-end device.

## Non-Goals
- Tidak membangun ulang seluruh UI dari nol.
- Tidak membuat sistem akun penuh dalam roadmap ini.
- Tidak mengganti local-first behavior yang sudah ada.
- Tidak menambahkan library drag-drop besar sebelum terbukti perlu.

## Phase 1 - Focus Layout Presets
Status: Done.

Tambahkan preset tampilan untuk mode Focus agar user tidak hanya punya satu mode generic.

### Scope
- Tambahkan state layout focus:
  - `board-only`
  - `board-squad`
  - `board-inspector`
  - `board-phases`
  - optional `board-squad-inspector` untuk desktop lebar.
- Dock bawah menjadi pengontrol layout, bukan sekadar toggle panel.
- Panel yang aktif tidak boleh memblokir klik map di area kosong.
- Simpan preferensi layout terakhir di local storage ringan atau store persist.

### UX
- Masuk Focus memakai layout terakhir.
- Tombol Squad/Inspector/Phases men-switch preset.
- Klik tombol aktif lagi menutup panel dan kembali ke `board-only`.
- Desktop boleh menampilkan panel sebagai overlay samping.
- Mobile tetap memakai panel slide-in yang lebih ketat.

### Acceptance Criteria
- Board tetap bisa diklik saat Squad/Inspector terbuka di Focus.
- Toolbar focus selalu terlihat dan tidak tertutup panel.
- Exit Focus selalu terlihat di desktop dan mobile.
- Tidak ada overlay backdrop di Focus desktop yang memblokir map.

## Phase 2 - Compact Squad Picker
Status: Done.

Buat versi Squad yang lebih kecil untuk workflow place player.

### Scope
- Tambahkan `CompactSquadPicker` untuk Focus mode.
- Tampilkan:
  - search member/squad
  - row compact dengan IGN, role dot, status `On Map`/`No Dot`
  - quick add member ke plan jika belum ada di squad
  - selected player highlight.
- Panel compact bisa berada di kiri atas/kiri bawah tanpa memenuhi tinggi layar.
- Full `RosterPanel` tetap tersedia untuk editing lengkap.

### UX
- Di Focus, tombol Squad membuka compact picker secara default.
- Ada action untuk membuka full squad panel kalau user perlu edit roster detail.
- Setelah memilih player, tool otomatis bisa diarahkan ke `place-player` jika marker belum ada.

### Acceptance Criteria
- User bisa pilih player lalu klik map tanpa menutup picker.
- Picker tidak menutupi toolbar focus.
- Scroll list tidak membuat board ikut scroll.
- Mobile tetap cukup besar untuk tap target.

## Phase 3 - Faster Place Player Flow
Status: Done globally for click-to-place in Focus and the main Board Squad panel. Optional drag-to-map remains deferred.

Kurangi langkah mode-based untuk menaruh player di map.

### Scope
- Tambahkan click-to-place flow:
  - pilih player dari Squad/Compact Picker
  - jika player belum punya marker, tampilkan prompt state `Click map to place`
  - klik map menaruh marker, lalu tetap di select atau kembali ke picker sesuai setting.
- Tambahkan optional drag-to-map untuk desktop:
  - drag player row ke canvas
  - drop position menjadi marker.
- Keyboard shortcut tetap ada sebagai fallback.

### UX
- Tidak wajib memilih tool `Place Player` secara manual untuk kasus umum.
- Jika marker sudah ada, memilih player fokus ke marker yang ada.
- Jika user sedang memakai tool lain, app tidak mengubah tool diam-diam kecuali user memilih quick-place action.

### Acceptance Criteria
- Player baru bisa ditempatkan dari Squad dengan maksimal dua aksi: select player, click map.
- Existing marker tidak terduplikasi.
- Drag-to-map tidak mengganggu scroll panel.
- Touch device tetap memakai click-to-place, bukan drag yang sulit.

## Phase 4 - Layer Visibility Presets
Status: Done.

Layer visibility perlu lebih fleksibel untuk planning, review, screenshot, dan clean-map.

### Scope
- Tambahkan preset visual:
  - `Planning`: players, routes, objectives, zones, notes aktif.
  - `Review`: players, routes, objectives aktif.
  - `Clean Map`: hanya map/objectives.
  - `Screenshot`: layer pilihan terakhir untuk export.
- Tambahkan custom saved visibility preset opsional.
- Preset mempengaruhi `layerVisibility` dan `objectiveCategoryVisibility`.

### UX
- Preset muncul di toolbar atau focus dock sebagai compact menu.
- User tetap bisa override manual setelah memilih preset.
- Export PNG bisa memakai visibility aktif atau memilih preset export.

### Acceptance Criteria
- Memilih preset langsung mengubah layer terlihat.
- Override manual tidak rusak setelah pindah phase.
- Preset tidak menghapus data, hanya mengubah visibility.

## Phase 5 - Phase Workflow Upgrade
Status: Done for inline rename, duplicate modes, destructive delete guard, and reorder controls. Drag reorder remains deferred.

Phase saat ini linear. Buat lebih mudah untuk banyak variasi strategi.

### Scope
- Drag reorder phases.
- Rename phase inline.
- Duplicate phase dengan opsi:
  - duplicate all
  - duplicate only players
  - duplicate only objectives
  - duplicate empty board with same briefing.
- Optional compare mode:
  - pilih dua phase untuk melihat ringkasan perbedaan count marker/routes/objectives.

### UX
- Phase panel di Focus bisa dipakai untuk edit cepat.
- Delete phase tetap butuh guard saat destructive.
- Reorder tidak mengubah active phase secara tidak terduga.

### Acceptance Criteria
- Reorder tersimpan di plan.
- Duplicate options menghasilkan data sesuai pilihan.
- Active phase tetap valid setelah reorder/delete.

## Phase 6 - Cloud Workspace Flexibility
Status: Not started.

Cloud slot saat ini berbasis device. Buat lebih fleksibel tanpa langsung membangun auth penuh.

### Scope
- Pertahankan 3 slot per device.
- Tambahkan optional workspace/team key:
  - user bisa memasukkan key untuk membuka 3 slot bersama.
  - key tetap anonymous.
  - payload tetap encrypted.
- Share link bisa memilih target:
  - save to local active workspace
  - save to device slot
  - save to team/workspace slot jika key aktif.

### UX
- Default tetap local/device supaya ringan.
- Team key tersembunyi di dialog Cloud Saves advanced section.
- Jangan memaksa login.

### Acceptance Criteria
- Device slot lama tetap kompatibel.
- Team key tidak membuka payload plaintext di server.
- Error Neon/API tidak merusak local workspace.

## Phase 7 - Unified Export Dialog
Status: Done for unified workspace export dialog, map PNG, plan JSON, workspace backup, objective coordinates, member CSV, and member XLSX. All-phases ZIP remains deferred.

Export saat ini tersebar di banyak tombol. Satukan agar lebih jelas.

### Scope
- Tambahkan dialog `Export`.
- Pilihan export:
  - Map PNG current phase
  - Map PNG all phases zip, optional
  - Plan JSON
  - Workspace backup JSON
  - Member data CSV/XLSX
  - Objective coordinates JSON
- Export map punya opsi:
  - current visibility
  - clean map preset
  - include/exclude notes
  - current phase/all phases.

### UX
- Topbar cukup punya satu tombol Export.
- Member Data tetap boleh punya quick CSV/XLSX karena itu workflow database.
- Dialog export tidak boleh berat saat dibuka; generate file hanya saat user klik action.

### Acceptance Criteria
- Existing export functionality tetap tersedia.
- Export map tetap full map, bukan viewport.
- XLSX/CSV tetap bekerja dari Member Data.
- Tidak ada regression pada build chunk yang signifikan.

## Phase 8 - Desktop And Mobile Focus Split
Status: Done for desktop/mobile Focus layout split, dock positioning, panel offsets, toolbar collision avoidance, and mobile portrait/landscape reachability.

Pisahkan tuning Focus desktop dan mobile agar masing-masing optimal.

### Scope
- Desktop:
  - dock bawah center.
  - panels overlay kiri/kanan.
  - toolbar bisa berpindah agar tidak tertutup panel.
  - optional mini map/zoom indicator.
- Mobile:
  - dock kanan bawah.
  - panels slide-in.
  - compact tools with horizontal scroll.
  - focus exit always visible.

### Acceptance Criteria
- iPhone portrait/landscape tidak kehilangan tombol Exit Focus.
- Desktop 1366/1440/1559 width tidak overlap top-left toolbar dengan Squad.
- Board remains clickable whenever visible.

## Implementation Order
1. Phase 1: Focus layout presets.
2. Phase 2: Compact Squad Picker.
3. Phase 3: Faster Place Player Flow.
4. Phase 4: Layer Visibility Presets.
5. Phase 5: Phase Workflow Upgrade.
6. Phase 7: Unified Export Dialog.
7. Phase 8: Desktop/Mobile Focus Split polish.
8. Phase 6: Cloud Workspace Flexibility, after current cloud slots are stable.

## Test Plan
- Unit tests:
  - focus layout state transitions.
  - layer preset reducers.
  - phase reorder/duplicate helpers.
  - export option normalization.
- Component/UI tests where practical:
  - compact squad picker filtering and selection.
  - click-to-place state.
- Playwright smoke:
  - desktop focus board-only, squad, inspector, phases.
  - click map while Squad is open in Focus.
  - mobile portrait focus exit remains visible.
  - mobile landscape focus controls remain reachable.
  - export dialog opens and downloads map PNG.
- Regression:
  - `npm run build`.
  - `npm run test`.
  - existing share/cloud save flows.
  - existing local persistence migration.

## Risks
- Drag-to-map can conflict with canvas pan/zoom and panel scrolling; keep it optional after click-to-place works.
- Too many focus controls can recreate toolbar clutter; prefer menus/presets over many permanent buttons.
- Persisting layout state can create confusing recovery if viewport changes; reset invalid layouts per breakpoint.
- Unified export can accidentally pull large dependencies into initial bundle; keep heavy generation lazy.

## Current Recommendation
Start with **Phase 1 + Phase 2 + Phase 3**. Those directly address the current planning friction: user wants to keep Squad open, pick players, and place them on the board without fighting layers or closing panels.
