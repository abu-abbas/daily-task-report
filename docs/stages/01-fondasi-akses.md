# Stage 01 — Fondasi aplikasi dan akses

- Status: Selesai; seluruh kriteria wajib terpenuhi.
- Prasyarat: Stage 0 untuk stack, rancangan skema, dan akses.
- Keputusan: [ADR-0001](../adr/0001-stack-typescript.md), [ADR-0002](../adr/0002-database-sqlite.md), [ADR-0003](../adr/0003-login-session.md), [ADR-0004](../adr/0004-hak-akses.md), [ADR-0021](../adr/0021-komponen-ui.md), [ADR-0023](../adr/0023-mobile-first.md), [ADR-0024](../adr/0024-tema.md), [ADR-0025](../adr/0025-metode-ponytail.md).

## Cakupan

- Setup Bun, Vue 3, Vite, TypeScript, dan SQLite; gunakan ponytail untuk memilih tooling minimum.
- Buat migration berdasarkan spec dan penyesuaian yang sudah dijelaskan; aktifkan foreign key SQLite.
- Implementasikan login email/password, session, logout, serta otorisasi tenaga ahli/supervisi/atasan/admin menurut [ADR-0031](../adr/0031-hierarki-supervisi.md).
- Bangun layout dasar mobile-first, navigasi, dan light/dark mode.

## Kriteria selesai dan pemeriksaan

- [x] Aplikasi berjalan lokal; migration berhasil pada database baru dan data bertahan setelah restart.
- [x] Login/logout bekerja; kredensial salah ditolak; API tidak menerima identitas user dari input klien sebagai otoritas.
- [x] Akses tanpa login ditolak; typecheck backend/frontend lolos. Cakupan lintas kewenangan (role-based) belum bisa diuji karena belum ada endpoint bisnis yang dibatasi peran — menyusul saat Stage 2 menambah fitur pertama yang butuh otorisasi peran.
- [x] Layout dasar dapat digunakan pada mobile dan laptop dalam kedua tema.

## Dependensi terbuka

Q-02 rincian provisioning/validasi siklus hierarki (lihat [ADR-0036](../adr/0036-skema-fisik-stage1.md)) tetap dirinci saat implementasi fitur akun di Stage 2. Rancangan schema/session pada Q-03 sudah selesai. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

- **Stack**: `frontend/` (Bun + Vue 3 + Vite + TS + Tailwind v4 + shadcn-vue, alias `@/*`), `server/` (Bun native `Bun.serve()` + `bun:sqlite`, tanpa framework/ORM sesuai [ADR-0035](../adr/0035-backend-framework.md)).
- **Migration**: `bun run migrate` di `server/` menjalankan `docs/schema/0001_initial.sql`, tercatat di tabel `_migrations` sehingga idempoten. Diverifikasi: migration pada database kosong berhasil, seluruh 12 tabel skema ([ADR-0036](../adr/0036-skema-fisik-stage1.md)) terbentuk, dan data (user yang di-seed) tetap ada setelah proses server dihentikan dan dijalankan ulang.
- **Login/session**: `POST /api/login`, `POST /api/logout`, `GET /api/me` diuji end-to-end lewat proxy Vite (`localhost:5173/api/...` → backend `localhost:3001`) memakai curl: password salah → 401, tanpa cookie session → 401, login benar → 200 + cookie `HttpOnly`, `GET /api/me` dengan cookie → 200, setelah logout → 401 lagi. Identitas user berasal dari token session tersimpan di database (`sessions.token_hash`), bukan dari body/header yang dikirim klien. Password di-hash dengan `Bun.password.hash` (argon2id bawaan Bun); waktu verifikasi tetap dijalankan meski email tidak terdaftar untuk mengurangi timing-based enumeration.
- **Test otomatis**: `server/tests/auth.test.ts` (5 test, `bun test`) — login benar, password salah, email tak terdaftar, token acak, dan efek logout.
- **Typecheck**: `vue-tsc -b --noEmit` (frontend) dan `tsc --noEmit` (server) keduanya lolos tanpa error.
- **Frontend**: routing `/login` (publik), `/input`, `/riwayat` dengan route guard yang mengecek sesi lewat TanStack Query sebelum masuk halaman terproteksi; form login pakai vee-validate + `@vee-validate/zod` (schema zod v3 — versi yang kompatibel dengan `@vee-validate/zod@4.15.1`; backend memakai `zod/v4` secara terpisah, lihat komentar di kode) sesuai [ADR-0037](../adr/0037-library-frontend-tambahan.md); layout dasar (`AppShell.vue`) memuat nav Input/Riwayat, toggle tema, dan menu akun/logout.
- **Pemeriksaan visual**: diverifikasi dengan Playwright (Chromium headless) terhadap `dev:server`+`dev:frontend` lokal — viewport mobile (390×844) dan laptop (1440×900), light dan dark, pada `/login` serta `AppShell` (`/input`, `/riwayat`) setelah login memakai user sementara yang dihapus setelah pemeriksaan. Hasil: form login dan AppShell (nav Input/Riwayat, toggle tema, menu akun) tertata rapi tanpa overflow di kedua viewport; kontras teks/tombol memadai di kedua tema; navigasi keyboard (Tab) memindahkan fokus email → password → submit dengan ring fokus terlihat jelas (box-shadow 3px), terpisah dari state error validasi (border merah "Required" saat field kosong ditinggalkan — perilaku vee-validate yang disengaja, bukan bug); tidak ada error console/page selain 401 yang diharapkan dari cek sesi tamu. Screenshot disimpan sementara di scratchpad sesi, tidak masuk repo.
- **Belum diperiksa**: otorisasi lintas peran (menyusul Stage 2, karena belum ada endpoint bisnis yang dibatasi peran); halaman Input Harian/Riwayat masih placeholder, isi bisnisnya menyusul Stage 3/5.
