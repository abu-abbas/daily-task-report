-- Migration awal — lihat docs/adr/0036-skema-fisik-stage1.md untuk keputusan per tabel.
-- Dijalankan sekali secara berurutan (tanpa ORM, sesuai ADR-0035); tambahan skema berikutnya
-- jadi file 0002_*.sql, dst.

PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  atasan_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  supervisi_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (atasan_id IS NULL OR atasan_id <> id),
  CHECK (supervisi_id IS NULL OR supervisi_id <> id)
);

-- Rangkap peran (ADR-0033): satu user bisa punya beberapa baris role.
CREATE TABLE user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('tenaga_ahli', 'supervisi', 'atasan', 'admin')),
  PRIMARY KEY (user_id, role)
);

-- Login/session (ADR-0003): cookie membawa token acak, bukan identitas yang dipercaya dari klien.
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Keanggotaan (ADR-0005). ended_at menandai keanggotaan berakhir tanpa menghapus baris,
-- karena histori realisasi milik user tetap terbaca setelah keluar project (ADR-0034)
-- dan butuh jejak "pernah jadi anggota" tanpa snapshot hierarki terpisah.
CREATE TABLE user_project (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ended_at TEXT,
  PRIMARY KEY (user_id, project_id)
);

-- Task tidak punya pemilik tetap (ADR-0010); deskripsi_penutupan opsional (ADR-0012).
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  deskripsi TEXT NOT NULL,
  tag TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  deskripsi_penutupan TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tidak ada unique constraint pada (task_id, tanggal, user_id, jenis): beberapa orang boleh
-- mengerjakan task yang sama pada tanggal yang sama (ADR-0011). Duplikasi item milik user yang
-- sama pada task/tanggal/jenis sama masih terbuka (Q-05) — jangan diasumsikan lewat DDL ini.
CREATE TABLE task_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tanggal TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('rencana', 'realisasi')),
  catatan TEXT,
  is_extra INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_task_logs_user_tanggal ON task_logs (user_id, tanggal, jenis);
CREATE INDEX idx_task_logs_task ON task_logs (task_id);

-- Kendala opsional per log, bukan status permanen task (ADR-0015).
CREATE TABLE kendala (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_log_id INTEGER NOT NULL REFERENCES task_logs(id) ON DELETE CASCADE,
  deskripsi TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Polymorphic, task_log sebagai target implementasi awal (ADR-0016).
-- file_path (bukan file_url): penyimpanan lokal (ADR-0020), path relatif di disk, bukan URL publik.
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attachable_type TEXT NOT NULL,
  attachable_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_attachments_morph ON attachments (attachable_type, attachable_id);

-- Cuti pribadi, terpisah dari kalender kerja bersama (ADR-0032).
CREATE TABLE leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tanggal TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('cuti', 'sakit', 'izin')),
  alasan TEXT,
  potong_cuti_tahunan INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_leaves_user_tanggal ON leaves (user_id, tanggal);

-- Daftar libur/cuti bersama (ADR-0026/ADR-0028). Hari kerja = Senin-Jumat dan bukan
-- termasuk rentang di tabel ini; Sabtu-Minggu selalu libur, dihitung, tidak disimpan.
CREATE TABLE holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_akhir TEXT NOT NULL CHECK (tanggal_akhir >= tanggal_mulai)
);
CREATE INDEX idx_holidays_rentang ON holidays (tanggal_mulai, tanggal_akhir);
