# ADR-0049: Hono, Drizzle, dan PostgreSQL secara bertahap

- Status: diusulkan; menunggu review pengguna sebelum tahap 1 dikerjakan.
- Tanggal: 2026-10-09.
- Stage utama: lintas stage (infrastruktur backend), tidak terikat satu stage fitur.
- Merevisi: [ADR-0035](0035-backend-framework.md) (tanpa framework/ORM) dan [ADR-0002](0002-database-sqlite.md) (SQLite, "PostgreSQL bukan cakupan saat ini").
- Melengkapi: [ADR-0048](0048-logging-aplikasi.md) (logging dipasang sebagai middleware Hono, bukan hook `Bun.serve`).

## Konteks

[ADR-0035](0035-backend-framework.md) memilih `Bun.serve()` + `bun:sqlite` tanpa framework/ORM, dengan catatan boleh ditinjau ulang lewat ADR baru bila biaya pendekatan manual mulai nyata. Tiga kebutuhan sekarang muncul bersamaan:

1. **Migrasi ke PostgreSQL** untuk operasional tim, dengan ORM supaya skema dan query bertipe.
2. **Logging aplikasi** ([ADR-0048](0048-logging-aplikasi.md)) yang butuh satu titik pencatatan per request/error.
3. **Cek login dan hak akses** yang sekarang diulang manual di tiap handler (`requireAdmin` dipanggil di 12 tempat, `getAuthContext` di handler lain).

Kondisi kode per 2026-10-09 (diperiksa langsung, bukan asumsi):

- Routing: semua ±40 endpoint didaftarkan di satu file `server/src/index.ts` (92 baris). Handler sudah berbentuk Web standard (`Request` masuk, `Response` keluar), sama dengan yang dipakai Hono.
- Database: `bun:sqlite` bersifat **sinkron**. Ada ±127 pemanggilan `.all()/.get()/.run()` di 13 file dan 7 blok `db.transaction(...)`. Semua driver Postgres (termasuk `Bun.sql`) bersifat **async**, jadi perpindahan ke Postgres berarti mengubah handler dan helper yang kini sinkron menjadi async.
- SQL khusus SQLite yang perlu diganti: `AUTOINCREMENT` (13 tabel), `lastInsertRowid` (9 tempat), `INSERT OR IGNORE` (3 tempat), `PRAGMA`. Tanggal disimpan sebagai `TEXT DEFAULT CURRENT_TIMESTAMP`, boolean sebagai `INTEGER` 0/1.
- Test membuat file SQLite sementara per file test lewat `DATABASE_PATH`.

## Keputusan

- **HTTP: Hono** menggantikan routing `Bun.serve({ routes })`. Tetap dijalankan di atas Bun (`Bun.serve({ fetch: app.fetch })`).
- **ORM: Drizzle**, bukan Prisma. Alasannya: gaya query Drizzle dekat dengan SQL polos yang sudah dipakai, tidak butuh proses/engine terpisah, dan mendukung SQLite maupun Postgres sehingga perpindahan ORM dan perpindahan database bisa dipisah.
- **Database: PostgreSQL** menjadi target akhir menggantikan SQLite.
- **Dikerjakan tiga tahap terpisah**, masing-masing satu PR yang bisa diverifikasi sendiri dan aplikasi tetap jalan di antara tahap:

### Tahap 1: Hono + middleware

- Pindahkan pendaftaran route di `server/src/index.ts` ke Hono. Isi handler tidak ditulis ulang; cukup penyesuaian cara membaca parameter path.
- Middleware **logging** sesuai [ADR-0048](0048-logging-aplikasi.md) (format, lokasi, rotasi, retensi tetap seperti ADR itu). `app.onError` menggantikan hook `error` milik `Bun.serve` sebagai jaring pengaman terakhir.
- Middleware **autentikasi/otorisasi** (`requireLogin`, `requireRole`) menggantikan pemanggilan `requireAdmin`/`getAuthContext` berulang di handler.
- Validasi zod per route (`@hono/zod-validator`) boleh dipakai untuk route yang disentuh, tidak wajib menyisir semua route di tahap ini.
- Database tidak berubah sama sekali di tahap ini.

### Tahap 2: Drizzle di atas SQLite

- Tarik skema yang ada dengan `drizzle-kit pull` menjadi `server/src/schema.ts`; skema hasil tarikan dicek terhadap `docs/schema/*.sql`, bukan dipercaya mentah.
- Pindahkan query per modul route ke Drizzle **dengan gaya async** (`await`), walau driver SQLite masih sinkron, supaya tahap 3 cukup mengganti driver.
- Helper bersama (`kendalaByTaskLogId`, `attachmentsByTaskLogId`, `aggregateMonthlyReport`, dll) ikut menjadi async.
- Test tetap memakai SQLite sementara seperti sekarang, sehingga setiap modul yang dipindah langsung terverifikasi oleh test yang ada.
- Migration tetap file SQL di `docs/schema/` sampai tahap 3; Drizzle dipakai untuk query dan tipe, belum untuk migration.

### Tahap 3: ganti ke PostgreSQL

- Driver Drizzle diganti ke Postgres (`Bun.sql` atau `postgres.js`, dipilih saat implementasi).
- **Baseline migration baru** khusus Postgres menggantikan rangkaian `0001`–`0009` SQLite (yang disimpan sebagai arsip). Migration berikutnya dikelola `drizzle-kit generate`.
- Tipe kolom disesuaikan: id menjadi `GENERATED ALWAYS AS IDENTITY`, kolom waktu `created_at`/`expires_at`/dst menjadi `timestamptz`, kolom tanggal bisnis (`tanggal`, `tanggal_mulai`, dst) menjadi `date`, boolean 0/1 menjadi `boolean`. Tanggal bisnis tetap mengikuti Asia/Jakarta ([ADR-0032](0032-tanggal-bisnis.md)).
- Skrip sekali jalan untuk menyalin data dari `data/app.db` ke Postgres, dengan pemeriksaan jumlah baris per tabel sebelum dan sesudah.
- Test memakai database Postgres (database/schema terpisah per run).
- Attachment dan template Word tetap di disk (`data/attachments/`, `data/laporan-template/`); hanya metadata yang ada di database.

## Konsekuensi

- Menambah dependency: `hono`, `drizzle-orm`, `drizzle-kit`, driver Postgres. Ini sengaja menyimpang dari prinsip minimum [ADR-0035](0035-backend-framework.md), karena tiga kebutuhan di atas sudah nyata, bukan perkiraan.
- Tahap 2 adalah pekerjaan terbesar (perubahan sinkron ke async di ±127 pemanggilan query). Tahap 1 dan 3 relatif kecil.
- Selama tahap 2 berlangsung, kode berisi campuran query `bun:sqlite` lama dan Drizzle. Ini dapat diterima selama tiap PR menjaga test tetap hijau; tahap 3 baru dimulai setelah tidak ada lagi pemanggilan `bun:sqlite` langsung di luar inisialisasi driver.
- Deployment membutuhkan server PostgreSQL. Backup/restore di [Stage 8](../stages/08-verifikasi-lokal.md) beralih dari salin file `app.db` ke `pg_dump`/`pg_restore`.
- Selama belum tahap 3, fitur baru tidak boleh memakai fitur khusus SQLite (`json_*`, `strftime`, `INSERT OR ...`, dll) supaya beban migrasi tidak bertambah.

## Rincian terbuka

- Pilihan driver Postgres (`Bun.sql` vs `postgres.js`), diputuskan di awal tahap 3 berdasarkan dukungan Drizzle saat itu.
- Apakah semua route langsung dipasang validasi zod di tahap 1, atau bertahap saat route itu disentuh.
- Lingkungan Postgres untuk pengembangan lokal dan test (Docker atau instalasi lokal).
