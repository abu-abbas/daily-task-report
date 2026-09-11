-- ADR-0046: skema fisik untuk laporan bulanan PDF lengkap (BAB I-VI), lihat juga ADR-0019.
-- Daftar/bullet (Ruang Lingkup, Saran & Rekomendasi, Nama Kegiatan) disimpan sebagai TEXT
-- satu-item-per-baris, mengikuti pola task_logs.catatan yang sudah ada — bukan child table
-- terpisah, karena tidak ada tempat lain yang butuh baca item-nya satu-satu.

-- Jabatan tenaga ahli untuk keperluan laporan (Programmer, System Administrator, dst) —
-- beda dari user_roles (hak akses aplikasi); jenisnya mengikuti regulasi/Kepgub eksternal,
-- bukan ditentukan aplikasi.
CREATE TABLE jabatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL UNIQUE
);

-- Penugasan/kontrak tenaga ahli, berjangka waktu — jabatan bisa beda antar kontrak.
-- nama_kegiatan: baris "Key: Value" (mis. "K/L/D/I: ...", "Satker/SKPD: ..."), TIDAK
-- termasuk PPK (lihat ppk_saat_ini) karena pejabatnya bisa mutasi di tengah kontrak berjalan.
-- perlu_review (ADR-0019, pola sama seperti projects.belum_direkonsiliasi ADR-0042): tenaga
-- ahli boleh mengisi kontrak sendiri kalau belum ada baris yang mencakup bulan laporannya
-- (supaya tidak terhambat menunggu admin) — baris begini ditandai perlu_review = 1 sampai
-- admin mengecek/mengoreksi; laporan tetap bisa langsung diunduh tanpa menunggu itu.
CREATE TABLE kontrak (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  jabatan_id INTEGER NOT NULL REFERENCES jabatan(id) ON DELETE RESTRICT,
  sub_kegiatan TEXT NOT NULL,
  paket_pekerjaan TEXT NOT NULL,
  nama_kegiatan TEXT NOT NULL DEFAULT '',
  mulai TEXT NOT NULL,
  berakhir TEXT,
  perlu_review INTEGER NOT NULL DEFAULT 0,
  CHECK (berakhir IS NULL OR berakhir >= mulai)
);
CREATE INDEX idx_kontrak_user_rentang ON kontrak (user_id, mulai, berakhir);

-- PPK: satu nilai berlaku bareng untuk semua tenaga ahli (melekat ke instansi/Satker, bukan
-- ke user/kontrak individu). Riwayat multi-baris supaya laporan bulan lama tetap menampilkan
-- PPK yang berlaku waktu itu, bukan PPK terbaru.
CREATE TABLE ppk_saat_ini (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  berlaku_sejak TEXT NOT NULL
);
CREATE INDEX idx_ppk_berlaku_sejak ON ppk_saat_ini (berlaku_sejak);

-- Ruang Lingkup (BAB II) default per jabatan — dikelola admin, berlaku untuk semua tenaga
-- ahli jabatan itu yang belum punya override sendiri (lihat ruang_lingkup_override).
CREATE TABLE ruang_lingkup_jabatan (
  jabatan_id INTEGER PRIMARY KEY REFERENCES jabatan(id) ON DELETE CASCADE,
  deskripsi_singkat TEXT NOT NULL DEFAULT '',
  bullet_list TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Override per user (opsional) — kalau ada baris di sini, dipakai gantiin default jabatan
-- untuk laporan user itu saja; diedit tenaga ahli sendiri, tidak memengaruhi user lain.
CREATE TABLE ruang_lingkup_override (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  deskripsi_singkat TEXT NOT NULL DEFAULT '',
  bullet_list TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Pendahuluan (BAB I narasi, TIDAK termasuk Nama Kegiatan — itu dari kontrak+ppk_saat_ini)
-- per user per bulan. Prefill dari bulan sebelumnya dilakukan di kode aplikasi saat baris
-- bulan itu belum ada, bukan di DDL. Tidak digembok ke tombol unduh (beda dari saran_bulanan).
CREATE TABLE pendahuluan_bulanan (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  bulan TEXT NOT NULL,
  deskripsi TEXT NOT NULL DEFAULT '',
  maksud_tujuan TEXT NOT NULL DEFAULT '',
  sasaran TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, bulan)
);

-- Saran & Rekomendasi (BAB V) per user per bulan — wajib diisi sebelum unduh PDF; validasi
-- "isi tidak kosong" dilakukan di endpoint unduh, bukan CHECK constraint (SQLite tidak bisa
-- membedakan "belum pernah diisi" vs "sengaja dikosongkan" secara berguna lewat CHECK).
CREATE TABLE saran_bulanan (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  bulan TEXT NOT NULL,
  isi TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, bulan)
);
