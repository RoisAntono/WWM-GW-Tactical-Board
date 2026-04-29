# Performance Diagnostics

Internal tooling untuk menemukan bottleneck performa tanpa menambahkan UI frontend.

## Cara Pakai

```bash
npm run build
npm run diagnose:perf
```

Script akan:

- menjalankan dev server lokal jika belum ada server di `http://127.0.0.1:5173`;
- membuka board di viewport desktop, MacBook Air, mobile portrait, dan mobile landscape;
- mengukur navigation timing, frame pacing idle, frame pacing saat drag map, canvas bitmap size, long tasks, resource size, DOM count, dan localStorage size;
- membaca ukuran file dari `dist/`;
- menulis hasil ke:
  - `reports/performance-diagnostics.json`
  - `reports/performance-diagnostics.md`

## Environment

Opsional:

```bash
PERF_URL=http://127.0.0.1:4173 npm run diagnose:perf
PERF_PORT=5177 npm run diagnose:perf
```

Gunakan `PERF_URL` jika ingin mengukur server tertentu, misalnya preview build.

## Interpretasi

Finding `high` biasanya perlu diprioritaskan:

- canvas bitmap terlalu besar;
- p95 frame saat drag di atas 34ms;
- long task besar;
- resource/bundle terlalu besar.

Finding `medium` biasanya perlu dipantau:

- total canvas pixel tinggi;
- load lambat;
- asset build besar.

Tool ini sengaja bukan test pass/fail utama. Jika finding `high` muncul, script akan keluar dengan exit code non-zero agar mudah dipakai di CI/manual audit.
