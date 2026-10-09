# ADR-0049: Hono, Drizzle, dan PostgreSQL secara bertahap

- Status: diterima (PR #1 di-merge 2026-10-09). Tahap 1 dan 2 dikerjakan; tahap 3 belum.
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

### Catatan pelaksanaan tahap 2 (2026-10-09)

- `server/src/schema.ts` ditulis tangan, bukan hasil `drizzle-kit pull` (perintah itu butuh `better-sqlite3`/`@libsql/client` yang tidak dipakai proyek ini). Supaya tidak menyimpang dari migration, `tests/schema.test.ts` membandingkan setiap tabel dan kolom (nama, NOT NULL, primary key) dengan database hasil migration. `drizzle-kit` baru dipasang di tahap 3, saat migration pindah ke Drizzle.
- Nama properti di `schema.ts` sengaja sama dengan nama kolom (snake_case), supaya baris hasil query tetap cocok dengan tipe yang sudah ada (`types.ts`, tipe row di tiap route).
- Semua query aplikasi sudah lewat Drizzle; `bun:sqlite` langsung (`sqlite` di `db.ts`) tinggal dipakai migration dan seeding data di test.
- **Transaksi tetap memakai callback sinkron** (`.get()/.all()/.run()` di dalam `db.transaction((tx) => ...)`). Transaksi driver bun:sqlite tidak boleh diselingi `await`: query sesudah `await` akan jatuh di luar transaksi, dan request lain bisa menyelip masuk ke transaksi yang sedang terbuka. Ada 7 transaksi seperti ini (`users` ×2, `leaves`, `tasks`, `projects` ×2, `task-logs`) plus helper `activateMembership`, `upsertTaskLog`, `deleteAttachmentsByTaskLogIds` yang menerima `tx`. Di tahap 3 semuanya diubah ke `await db.transaction(async (tx) => ...)`; `tests/db.test.ts` menjaga rollback tetap utuh.
- Pelanggaran UNIQUE dideteksi lewat `isUniqueViolation` di `db.ts` (Drizzle membungkus error driver; fungsi ini juga sudah mengenali kode Postgres `23505`).
- `INSERT OR IGNORE` diganti `onConflictDoNothing()`, `LIKE ? || '%'` diganti ``like(kolom, `${bulan}%`)``, dan `lastInsertRowid` diganti `RETURNING`, sehingga tidak ada lagi SQL khusus SQLite di kode aplikasi.

### Tahap 3: ganti ke PostgreSQL

- Driver Drizzle diganti ke Postgres (`Bun.sql` atau `postgres.js`, dipilih saat implementasi).
- **Baseline migration baru** khusus Postgres menggantikan rangkaian `0001`–`0009` SQLite (yang disimpan sebagai arsip). Migration berikutnya dikelola `drizzle-kit generate`.
- Tipe kolom disesuaikan: id menjadi `GENERATED ALWAYS AS IDENTITY`, kolom waktu `created_at`/`expires_at`/dst menjadi `timestamptz`, kolom tanggal bisnis (`tanggal`, `tanggal_mulai`, dst) menjadi `date`, boolean 0/1 menjadi `boolean`. Tanggal bisnis tetap mengikuti Asia/Jakarta ([ADR-0032](0032-tanggal-bisnis.md)).
- Skrip sekali jalan untuk menyalin data dari `data/app.db` ke Postgres, dengan pemeriksaan jumlah baris per tabel sebelum dan sesudah.
- Test memakai database Postgres (database/schema terpisah per run).
- Attachment dan template Word tetap di disk (`data/attachments/`, `data/laporan-template/`); hanya metadata yang ada di database.

### Catatan pelaksanaan tahap 1 (2026-10-09)

- Route didaftarkan di `server/src/app.ts`; `server/src/index.ts` tinggal menjalankan migration, pruning log, dan `Bun.serve({ fetch: app.fetch })`.
- Guard `loginRequired`/`adminOnly` dipasang per route. Handler tetap memanggil `requireLogin`/`requireAdmin` (`server/src/authz.ts`) sebagai pertahanan berlapis dan supaya 184 test unit yang memanggil handler langsung tetap berlaku tanpa ditulis ulang. Sesi tetap cuma di-query sekali per request karena hasilnya di-cache per objek `Request`.
- Pola tiga baris `parseCookie` + `getAuthContext` + 401 yang diulang di 29 handler diganti satu panggilan `requireLogin(req)`.
- Logger ADR-0048 ada di `server/src/logger.ts`; middleware mencatat response 5xx dan `app.onError` mencatat exception tak tertangani beserta stack trace.
- Validasi `@hono/zod-validator` belum dipasang; validasi zod di dalam handler tetap seperti sebelumnya.

## Konsekuensi

- Menambah dependency: `hono`, `drizzle-orm`, `drizzle-kit`, driver Postgres. Ini sengaja menyimpang dari prinsip minimum [ADR-0035](0035-backend-framework.md), karena tiga kebutuhan di atas sudah nyata, bukan perkiraan.
- Tahap 2 adalah pekerjaan terbesar (perubahan sinkron ke async di ±127 pemanggilan query). Tahap 1 dan 3 relatif kecil.
- Selama tahap 2 berlangsung, kode boleh berisi campuran query `bun:sqlite` lama dan Drizzle (pada praktiknya tahap 2 selesai dalam satu PR, jadi campuran ini tidak pernah masuk `main`). Ini dapat diterima selama tiap PR menjaga test tetap hijau; tahap 3 baru dimulai setelah tidak ada lagi pemanggilan `bun:sqlite` langsung di luar inisialisasi driver.
- Deployment membutuhkan server PostgreSQL. Backup/restore di [Stage 8](../stages/08-verifikasi-lokal.md) beralih dari salin file `app.db` ke `pg_dump`/`pg_restore`.
- Selama belum tahap 3, fitur baru tidak boleh memakai fitur khusus SQLite (`json_*`, `strftime`, `INSERT OR ...`, dll) supaya beban migrasi tidak bertambah.

## Rincian terbuka

- Pilihan driver Postgres (`Bun.sql` vs `postgres.js`), diputuskan di awal tahap 3 berdasarkan dukungan Drizzle saat itu.
- Apakah semua route langsung dipasang validasi zod di tahap 1, atau bertahap saat route itu disentuh.
- Lingkungan Postgres untuk pengembangan lokal dan test (Docker atau instalasi lokal).
