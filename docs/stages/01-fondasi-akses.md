# Stage 01 — Fondasi aplikasi dan akses

- Status: Belum dimulai.
- Prasyarat: Stage 0 untuk stack, rancangan skema, dan akses.
- Keputusan: [ADR-0001](../adr/0001-stack-typescript.md), [ADR-0002](../adr/0002-database-sqlite.md), [ADR-0003](../adr/0003-login-session.md), [ADR-0004](../adr/0004-hak-akses.md), [ADR-0021](../adr/0021-komponen-ui.md), [ADR-0023](../adr/0023-mobile-first.md), [ADR-0024](../adr/0024-tema.md), [ADR-0025](../adr/0025-metode-ponytail.md).

## Cakupan

- Setup Bun, Vue 3, Vite, TypeScript, dan SQLite; gunakan ponytail untuk memilih tooling minimum.
- Buat migration berdasarkan spec dan penyesuaian yang sudah dijelaskan; aktifkan foreign key SQLite.
- Implementasikan login email/password, session, logout, serta otorisasi tenaga ahli/atasan/admin.
- Bangun layout dasar mobile-first, navigasi, dan light/dark mode.

## Kriteria selesai dan pemeriksaan

- [ ] Aplikasi berjalan lokal; migration berhasil pada database baru dan data bertahan setelah restart.
- [ ] Login/logout bekerja; kredensial salah ditolak; API tidak menerima identitas user dari input klien sebagai otoritas.
- [ ] Akses tanpa login dan lintas kewenangan ditolak; typecheck backend/frontend lolos.
- [ ] Layout dasar dapat digunakan pada mobile dan laptop dalam kedua tema.

## Dependensi terbuka

Q-02 dan rancangan schema/session pada Q-03. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

Belum ada implementasi atau pemeriksaan aplikasi. Isi hasil pemeriksaan dan keterbatasan aktual saat tahap dikerjakan. Berhenti setelah kriteria tahap terpenuhi; jangan menambahkan fitur di luar cakupan.
