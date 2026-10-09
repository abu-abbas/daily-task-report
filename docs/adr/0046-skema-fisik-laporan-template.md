# ADR-0046: Skema fisik untuk laporan bulanan PDF lengkap — DIGANTIKAN, lihat ADR-0019

- Status: **digantikan** (2026-09-11, hari yang sama dengan diterimanya ADR ini) — lihat [ADR-0019 bagian "Word via template mail-merge milik tenaga ahli sendiri"](0019-word-per-tipe.md#word-via-template-mail-merge-milik-tenaga-ahli-sendiri-final-2026-09-11). Setelah dicoba nyata, Cover/Pendahuluan(BAB I)/Ruang Lingkup(BAB II) ternyata cukup statis di template Word masing-masing tenaga ahli — seluruh tabel di bawah ini (`jabatan`, `kontrak`, `ppk_saat_ini`, `ruang_lingkup_jabatan`, `ruang_lingkup_override`, `pendahuluan_bulanan`) **sudah di-DROP** lewat [`schema/sqlite-arsip/0007_hapus_kontrak_ruang_lingkup_pendahuluan.sql`](../schema/sqlite-arsip/0007_hapus_kontrak_ruang_lingkup_pendahuluan.sql) — halaman admin "Kelola Jabatan"/"Kelola Kontrak" dan tab self-fill di Detail Laporan ikut dihapus dari frontend. `saran_bulanan` TIDAK ikut di-drop, masih dipakai. Sisa dokumen ini dibiarkan apa adanya sebagai jejak keputusan (bukan dihapus), bukan rujukan skema yang berlaku sekarang.

- Status lama (sudah tidak berlaku): diterima.
- Tanggal: 2026-09-11.
- Stage utama: [07](../stages/07-ekspor-word.md).
- Melengkapi: [ADR-0019](0019-word-per-tipe.md), [ADR-0002](0002-database-sqlite.md), [ADR-0035](0035-backend-framework.md).
- Menutup sebagian: [Q-06](../open-decisions.md).

## Konteks

[ADR-0019](0019-word-per-tipe.md) (section "Model konten rinci per BAB") sudah mengunci struktur dan sumber data tiap bagian laporan (Jabatan, Kontrak, PPK, Ruang Lingkup default+override, Pendahuluan, Saran & Rekomendasi) lewat diskusi bertahap dengan pengguna. ADR ini menuliskan DDL fisiknya, mengikuti pola [ADR-0036](0036-skema-fisik-stage1.md).

## Keputusan

DDL lengkap ada di [`schema/sqlite-arsip/0005_laporan_template.sql`](../schema/sqlite-arsip/0005_laporan_template.sql).

| Tabel | Isi | Alasan |
| --- | --- | --- |
| `jabatan` (baru) | `id`, `nama` unik | Master jabatan tenaga ahli untuk laporan (Programmer, dst) — beda dari `user_roles` (hak akses); dikelola admin. |
| `kontrak` (baru) | `user_id`, `jabatan_id`, `sub_kegiatan`, `paket_pekerjaan`, `nama_kegiatan` (TEXT baris "Key: Value"), `mulai`/`berakhir`, `perlu_review` | Satu paket data resmi per penugasan berjangka waktu; jabatan bisa beda antar kontrak (regulasi/Kepgub). PPK sengaja **tidak** ikut di sini. `perlu_review` menandai kontrak yang diisi tenaga ahli sendiri (bukan admin) — lihat "Self-fill saat data belum ada" di bawah. |
| `ppk_saat_ini` (baru) | `nama`, `berlaku_sejak`, riwayat multi-baris | PPK bisa mutasi di tengah kontrak berjalan dan berlaku sama untuk semua tenaga ahli — dipisah dari `kontrak` supaya ganti PPK tidak perlu menutup/bikin kontrak baru. Laporan bulan lama tetap pakai PPK yang berlaku waktu itu (histori, bukan overwrite). |
| `ruang_lingkup_jabatan` (baru) | `jabatan_id` (PK), `deskripsi_singkat`, `bullet_list` | Default BAB II per jabatan, dikelola admin, berlaku ke semua tenaga ahli jabatan itu yang belum override. |
| `ruang_lingkup_override` (baru) | `user_id` (PK), `deskripsi_singkat`, `bullet_list` | Override BAB II per user (opsional), dikelola tenaga ahli sendiri; dipakai gantiin default jabatan hanya untuk laporan dia — salah edit tidak berdampak ke tenaga ahli lain jabatan yang sama. |
| `pendahuluan_bulanan` (baru) | `user_id`+`bulan` (PK), `deskripsi`, `maksud_tujuan`, `sasaran` | BAB I narasi (bukan Nama Kegiatan — itu dari `kontrak`+`ppk_saat_ini`), per user per bulan; prefill dari bulan sebelumnya dilakukan di aplikasi saat baris belum ada. Tidak digembok ke unduh. |
| `saran_bulanan` (baru) | `user_id`+`bulan` (PK), `isi` | BAB V, wajib diisi sebelum tombol unduh aktif — validasi "tidak kosong" di endpoint unduh, bukan `CHECK` DDL. |

Daftar/bullet (Ruang Lingkup, Saran, Nama Kegiatan) disimpan sebagai **TEXT satu-item-per-baris**, mengikuti pola `task_logs.catatan` yang sudah ada di [`0001_initial.sql`](../schema/sqlite-arsip/0001_initial.sql) — bukan child table dengan kolom `urutan`, karena tidak ada tempat lain di aplikasi yang butuh baca item-nya satu per satu (parsing "Key: Value" atau daftar bullet cukup di kode aplikasi/frontend, sama seperti `MiniMarkdownText.vue` yang sudah dipakai untuk `catatan`).

`ON DELETE RESTRICT` dipakai untuk semua referensi ke `users`/`jabatan` di tabel-tabel ini (bukan `CASCADE`), mengikuti pola `leaves`/`task_logs`/`attachments` di [ADR-0036](0036-skema-fisik-stage1.md) — data laporan histori tidak boleh hilang diam-diam kalau user/jabatan dihapus.

## Self-fill saat data belum ada (2026-09-11)

Kontrak/PPK/Jabatan diberi label "dikelola admin" di [ADR-0019](0019-word-per-tipe.md), tapi kalau admin belum sempat input dan tenaga ahli butuh laporan mendadak, dia terhambat. Pola yang dipakai **sama persis dengan usulan project "Lainnya"** ([ADR-0042](0042-project-lainnya-usulan.md)): tenaga ahli tidak diblokir, mengisi sendiri, admin merekonsiliasi belakangan — bukan gembok berlapis di atas gembok Saran & Rekomendasi (BAB V) yang memang sengaja wajib.

- Saat generate laporan bulan X: kalau tidak ada baris `kontrak` milik user itu yang rentangnya mencakup bulan X, tenaga ahli disuguhi form isi sendiri (jabatan — pilih dari master `jabatan` atau tambah baru, `sub_kegiatan`, `paket_pekerjaan`, `nama_kegiatan`). Baris yang dihasilkan diberi `perlu_review = 1`. Laporan tetap langsung bisa diunduh.
- `ppk_saat_ini` kosong (belum pernah diisi siapa pun) → tenaga ahli juga boleh mengisi baris pertama; wajar karena PPK memang informasi yang diketahui bersama sejak awal kontrak, bukan rahasia admin.
- Ruang Lingkup (BAB II) sudah otomatis tidak memblokir — `ruang_lingkup_override` per user memang didesain bisa diisi tenaga ahli sendiri (lihat "Model konten rinci per BAB" di ADR-0019).
- Admin dapat halaman "Kontrak perlu direview" (mirip breakdown "Project Lainnya" Stage 02) untuk melihat/mengoreksi baris `perlu_review = 1` — tidak ada tenggat, sekadar visibilitas.
- Permission: endpoint tulis `kontrak`/`ppk_saat_ini`/`jabatan` dibuka untuk role `tenaga_ahli` (bukan admin-only) tapi tenaga ahli hanya bisa membuat/mengubah kontrak miliknya sendiri (`user_id` = dirinya); admin bisa mengubah kontrak siapa pun dan mengubah `perlu_review` jadi 0 setelah dicek.

## Konsekuensi

- Endpoint generate laporan (BAB IV existing + BAB I/II/V/Cover baru) perlu query tambahan: kontrak aktif per bulan (`mulai <= akhir_bulan AND (berakhir IS NULL OR berakhir >= awal_bulan)`), PPK aktif (`berlaku_sejak` terbesar yang `<=` akhir bulan), Ruang Lingkup (override user, fallback default jabatan), Pendahuluan+Saran per (user, bulan).
- CRUD `jabatan`/`kontrak`/`ppk_saat_ini`/`ruang_lingkup_jabatan` (admin) wajar ditaruh di halaman admin yang sudah ada (Stage 02), bukan halaman Laporan baru.
- Perlu pesan jelas di endpoint unduh kalau kontrak aktif tidak ditemukan untuk bulan yang diminta — bukan diam-diam pakai kontrak lain atau data kosong.
- Migration ini murni tambahan (`0005_laporan_template.sql`), tidak mengubah tabel Stage 1-6 yang sudah ada.
