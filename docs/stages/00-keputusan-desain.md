# Stage 00 — Keputusan dan desain layar

- Status: Dokumentasi keputusan tersedia; desain layar dan rincian terbuka belum selesai.
- Prasyarat: Tidak ada.
- Keputusan: [ADR-0001](../adr/0001-stack-typescript.md), [ADR-0002](../adr/0002-database-sqlite.md), [ADR-0003](../adr/0003-login-session.md), [ADR-0004](../adr/0004-hak-akses.md), [ADR-0006](../adr/0006-hari-kerja.md), [ADR-0007](../adr/0007-tanggal-realisasi.md), [ADR-0012](../adr/0012-penutupan-task.md), [ADR-0019](../adr/0019-word-per-tipe.md), [ADR-0021](../adr/0021-komponen-ui.md), [ADR-0022](../adr/0022-arah-visual.md), [ADR-0023](../adr/0023-mobile-first.md), [ADR-0024](../adr/0024-tema.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0026](../adr/0026-kalender-kerja-tahunan.md).

## Cakupan

- Kunci ADR yang diterima dan pisahkan rincian terbuka dari keputusan final.
- Rancang Input Harian, Riwayat, dan Dashboard mobile-first dengan shadcn-vue, light/dark mode, dan referensi visual pengguna.
- Tetapkan rincian penggunaan kalender kerja tahunan yang sudah disetujui: pengisian, timezone, tanggal kosong, perubahan histori, dan batas bulan/tahun; rinci cakupan tim atasan.
- Jelaskan kebutuhan perubahan skema: kredensial/session, peran/cakupan tim, deskripsi penutupan, dan tabel kalender kerja yang diminta pengguna. Pemetaan tipe programmer menunggu Stage 7.

## Kriteria selesai dan pemeriksaan

- [ ] Rancangan layar dapat direview pada mobile dan laptop, mencakup kedua tema serta empty/error/loading state.
- [ ] Tidak ada perubahan skema yang diasumsikan sudah disetujui hanya karena tercantum sebagai kebutuhan.
- [ ] Q-01, Q-02, dan bagian relevan Q-03 sudah diselesaikan sebelum implementasi yang bergantung padanya.

## Dependensi terbuka

Keputusan tanggal/cakupan tim dan rancangan layar; template Word tidak menghalangi tahap lain. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

Belum ada implementasi atau pemeriksaan aplikasi. Isi hasil pemeriksaan dan keterbatasan aktual saat tahap dikerjakan. Berhenti setelah kriteria tahap terpenuhi; jangan menambahkan fitur di luar cakupan.
