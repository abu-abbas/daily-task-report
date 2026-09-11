-- ADR-0019 revisi (2026-09-11): laporan diunduh sebagai Word hasil mail-merge ke template
-- pengguna sendiri, BUKAN PDF pdf-lib lagi (dicoba dulu, hasilnya kerasa terlalu plain/kurang
-- mirip dokumen asli dan tidak bisa diedit manual). Tenaga ahli upload template .docx miliknya
-- sendiri (bukan admin per jabatan, dan bukan satu template global) — dipakai mail-merge nama,
-- timesheet, tabel aktifitas, lampiran, dan saran. Cover/Pendahuluan/Ruang Lingkup/Penutup
-- sudah statis di dalam file template masing-masing orang, tidak di-generate aplikasi.
CREATE TABLE laporan_template (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  file_path TEXT NOT NULL,
  nama_asli TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
