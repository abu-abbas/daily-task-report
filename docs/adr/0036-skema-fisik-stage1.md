# ADR-0036: Skema fisik minimum SQLite untuk Stage 1

- Status: diterima; rincian implementasi (validasi role hierarki, kebijakan koreksi pasca keluar project) tetap dirinci saat Stage 1/2/4. Tabel kalender direvisi dari `work_calendar` menjadi `holidays` mengikuti revisi [ADR-0026](0026-kalender-kerja-tahunan.md); tidak ada perubahan lain pada DDL Stage 1.
- Tanggal: 2026-09-05 (revisi tabel kalender: 2026-09-05).
- Stage utama: [01](../stages/01-fondasi-akses.md), [02](../stages/02-user-project.md).
- Melengkapi: [ADR-0002](0002-database-sqlite.md), [ADR-0026](0026-kalender-kerja-tahunan.md), [ADR-0031](0031-hierarki-supervisi.md), [ADR-0033](0033-rangkap-peran.md), [ADR-0034](0034-akses-histori.md).
- Menutup: [Q-03](../open-decisions.md).

## Konteks

[Bahan review Stage 0](../stages/00-review.md) sudah menjelaskan usulan perubahan skema minimum, tapi DDL fisik belum ditulis. ADR ini mengunci DDL yang dipakai migration awal (Stage 1), mengikuti [ADR-0035](0035-backend-framework.md) (Bun native + `bun:sqlite`, tanpa ORM).

## Keputusan

DDL lengkap ada di [`schema/0001_initial.sql`](../schema/0001_initial.sql). Ringkasan tiap tabel terhadap spec awal:

| Tabel | Perubahan dari spec awal | Alasan |
| --- | --- | --- |
| `users` | Tambah `password_hash`, `atasan_id`, `supervisi_id` | Login email/password ([ADR-0003](0003-login-session.md)); dua hubungan hierarki langsung pada akun ([ADR-0031](0031-hierarki-supervisi.md)) — atasan_id dipakai akun supervisi, supervisi_id dipakai akun tenaga ahli. |
| `user_roles` (baru) | `user_id` + `role`, primary key gabungan | Rangkap peran ([ADR-0033](0033-rangkap-peran.md)); tidak perlu tabel katalog permission. |
| `sessions` (baru) | `token_hash` unik, `user_id`, `expires_at` | Session dapat dicabut saat logout ([ADR-0003](0003-login-session.md)). |
| `user_project` | Tambah `ended_at` nullable | Keanggotaan berakhir tanpa menghapus baris, karena histori realisasi tetap terbaca setelah keluar project ([ADR-0034](0034-akses-histori.md)); akses baca tetap lewat `task_logs.user_id`, bukan lewat baris ini. |
| `tasks` | Tambah `deskripsi_penutupan` nullable | Deskripsi penutupan opsional, terpisah dari catatan hasil realisasi ([ADR-0012](0012-penutupan-task.md)). |
| `task_logs` | Tidak ada perubahan struktur; **tidak** ditambah unique constraint pada kombinasi task/tanggal/user/jenis | Kolaborasi banyak user pada task/tanggal sama tetap harus mungkin ([ADR-0011](0011-kolaborasi-task.md)); duplikasi item milik user yang sama masih terbuka ([Q-05](../open-decisions.md)). |
| `attachments` | `file_url` → `file_path` | Operasi lokal dahulu ([ADR-0020](0020-operasional-lokal.md)): path relatif di disk, bukan URL publik. Validasi JPG/PNG, maks 5 file/5 MB per file tetap di level aplikasi ([ADR-0016](0016-attachment.md)), bukan CHECK constraint. |
| `leaves` | Tidak ada perubahan struktur | ([ADR-0032](0032-tanggal-bisnis.md)); larangan izin+realisasi tanggal sama ([ADR-0014](0014-izin-realisasi.md)) divalidasi di aplikasi, lintas tabel `leaves`/`task_logs`. |
| `holidays` (baru) | `id`, `nama`, `tanggal_mulai`, `tanggal_akhir` (rentang inklusif) | Daftar libur/cuti bersama sebagai pengecualian dari aturan default Senin–Jumat kerja/Sabtu–Minggu libur ([ADR-0026](0026-kalender-kerja-tahunan.md) revisi, [ADR-0028](0028-pengelolaan-kalender.md)); bentuk rentang mengikuti tabel yang sudah dipakai pengguna ([referensi](../references/holiday-settings.md)). Tidak ada lagi tabel satu baris per tanggal. |

Foreign key SQLite aktif (`PRAGMA foreign_keys = ON`) sesuai [ADR-0002](0002-database-sqlite.md).

## Konsekuensi

- Validasi role target `atasan_id`/`supervisi_id` (harus mengarah ke user dengan role yang sesuai) dan larangan siklus dilakukan di kode aplikasi saat Stage 1/2 — SQLite `CHECK` tidak bisa memvalidasi lintas tabel. DDL hanya mencegah self-reference langsung.
- Hak koreksi laporan sendiri setelah keluar project ([Stage 4](../stages/04-koreksi-izin-penutupan.md)) tidak berubah oleh ADR ini; `ended_at` pada `user_project` baru dipakai untuk itu saat Stage 4 dirinci.
- Migration berikutnya (Stage 2+: kolom rincian kalender, dsb.) memakai file `000N_*.sql` baru, bukan mengedit `0001_initial.sql` setelah dijalankan di data nyata.
- Framework backend/ORM ditetapkan terpisah pada [ADR-0035](0035-backend-framework.md).
