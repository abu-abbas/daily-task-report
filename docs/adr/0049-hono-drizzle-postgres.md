# ADR-0049: Hono, Drizzle, dan PostgreSQL secara bertahap

- Status: diterima (PR #1 di-merge 2026-10-09). Tahap 1, 2, dan 3 dikerjakan.
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

### Catatan pelaksanaan tahap 3 (2026-10-09)

- **Driver: `Bun.sql`** (client Postgres bawaan Bun) lewat `drizzle-orm/bun-sql`, bukan `postgres.js`: tanpa dependency tambahan, dan rollback transaksi async, `RETURNING`, serta kode error UNIQUE sudah dicoba langsung sebelum dipilih. Koneksi dari `DATABASE_URL`.
- **Migration**: `schema.ts` (pg-core) menjadi sumber skema. `bun run db:generate` (drizzle-kit) menulis migration ke `docs/schema/postgres/`, dimulai dari `0000_baseline.sql`; `bun run migrate` dan startup server menjalankannya lewat migrator Drizzle (tabel `drizzle.__drizzle_migrations`). Migration SQLite `0001`–`0009` dipindah ke `docs/schema/sqlite-arsip/` dan tidak dijalankan lagi.
- **Tipe kolom**: id `GENERATED ALWAYS AS IDENTITY`; waktu teknis `timestamptz`; tanggal bisnis `date` yang dibaca/ditulis sebagai string `YYYY-MM-DD` (tidak lewat konversi zona waktu). CHECK constraint dari SQLite dipertahankan.
- **Menyimpang dari rencana: flag 0/1 tetap `integer`, bukan `boolean`.** `is_active`, `is_extra`, `belum_direkonsiliasi` dipakai sebagai angka 0/1 di API, frontend, dan kode laporan; mengubahnya ke `boolean` menambah perubahan di semua lapisan tanpa manfaat fungsional. CHECK `IN (0, 1)` menjaga nilainya. Bisa diubah lewat migration terpisah bila nanti diperlukan.
- **Transaksi menjadi async** (`await db.transaction(async (tx) => ...)`) di semua 7 transaksi tahap 2. `activateMembership` (tambah anggota/gabung project) sekarang satu upsert `ON CONFLICT (user_id, project_id) DO UPDATE`, karena cek-lalu-tulis di Postgres (READ COMMITTED) tidak lagi otomatis berurutan seperti di SQLite.
- Filter bulan di laporan memakai rentang tanggal (`BETWEEN 'YYYY-MM-01' AND akhir bulan`), bukan `LIKE 'YYYY-MM%'` yang tidak berlaku untuk kolom `date`.
- **Folder data** dipisah dari lokasi database: `DATA_DIR` (default `data/`) untuk attachment, template Word, dan log.
- **Salin data**: `bun --cwd=server run salin-data` menyalin `data/app.db` (atau `SQLITE_PATH`) ke Postgres yang masih kosong dalam satu transaksi, mempertahankan id, menyesuaikan sequence identity, menandai timestamp SQLite sebagai UTC, lalu membandingkan jumlah baris per tabel.
- **PGlite untuk lokal (tambahan 2026-10-09, setelah PR #4):** pengguna tidak punya Postgres di laptop. Daripada kembali ke SQLite untuk lokal (dua skema `sqlite-core`/`pg-core`, dua set migration, perilaku tanggal/UNIQUE/transaksi berbeda dari server), `DATABASE_URL` kosong sekarang berarti PGlite: PostgreSQL asli versi WASM yang jalan di dalam proses Bun, data di `DATA_DIR/pglite`. Skema, migration, dan query tetap satu; `db.ts` hanya memilih driver (`drizzle-orm/pglite` atau `drizzle-orm/bun-sql`). Server tetap memakai Postgres lewat `DATABASE_URL`. Batasannya: satu folder PGlite hanya bisa dibuka satu proses sekaligus.
- **Test** memakai database Postgres terpisah (`TEST_DATABASE_URL`, wajib berakhiran `_test`), atau secara default PGlite baru di folder sementara sehingga `bun test` jalan tanpa server Postgres. `tests/setup.ts` (preload `bunfig.toml`) menyiapkan database dan menjalankan migration sekali per run; seeding memakai helper `tests/raw-db.ts` yang berbentuk mirip `bun:sqlite` supaya isi test lama tetap terbaca. `tests/schema.test.ts` sekarang membandingkan `schema.ts` dengan hasil migration lewat `information_schema` (menjaga agar `db:generate` tidak terlupa).

## Konsekuensi

- Menambah dependency: `hono`, `drizzle-orm`, `drizzle-kit`, driver Postgres. Ini sengaja menyimpang dari prinsip minimum [ADR-0035](0035-backend-framework.md), karena tiga kebutuhan di atas sudah nyata, bukan perkiraan.
- Tahap 2 adalah pekerjaan terbesar (perubahan sinkron ke async di ±127 pemanggilan query). Tahap 1 dan 3 relatif kecil.
- Selama tahap 2 berlangsung, kode boleh berisi campuran query `bun:sqlite` lama dan Drizzle (pada praktiknya tahap 2 selesai dalam satu PR, jadi campuran ini tidak pernah masuk `main`). Ini dapat diterima selama tiap PR menjaga test tetap hijau; tahap 3 baru dimulai setelah tidak ada lagi pemanggilan `bun:sqlite` langsung di luar inisialisasi driver.
- Deployment membutuhkan server PostgreSQL. Backup/restore di [Stage 8](../stages/08-verifikasi-lokal.md) beralih dari salin file `app.db` ke `pg_dump`/`pg_restore`.
- Selama belum tahap 3, fitur baru tidak boleh memakai fitur khusus SQLite (`json_*`, `strftime`, `INSERT OR ...`, dll) supaya beban migrasi tidak bertambah.

## Rincian terbuka

- Apakah semua route dipasang validasi `@hono/zod-validator`, atau bertahap saat route itu disentuh.
- Lingkungan Postgres untuk produksi dan backup terjadwal (`pg_dump`) dibahas di [Stage 8](../stages/08-verifikasi-lokal.md). Pengembangan lokal dan test memakai PGlite secara default (lihat README); Docker tidak diperlukan.
- Pilihan driver (`Bun.sql`) dan lingkungan test sudah diputuskan di tahap 3 (lihat catatan di atas).
