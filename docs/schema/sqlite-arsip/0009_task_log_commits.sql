-- Referensi commit GitLab yang ditautkan ke task_log (ADR-0039), diaktifkan lebih awal dari
-- rencana asal (yang niatnya nunggu SSO/ADR-0038) supaya bisa dipakai mencegah commit yang sama
-- diimpor dua kali jadi task duplikat (ADR-0047, bug 2026-09-19). pesan disimpan LENGKAP (bukan
-- cuma title) — beda dari task_logs.catatan yang mungkin sudah diedit user sebelum simpan.
-- UNIQUE (ditambahkan_oleh, commit_sha): SHA git praktis unik global, jadi cukup dicek per-user
-- tanpa perlu discope ulang per project/tanggal — sekaligus jaring pengaman DB-level kalau ada
-- race (mis. dua tab), INSERT OR IGNORE di kode aplikasi.
CREATE TABLE task_log_commits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_log_id INTEGER NOT NULL REFERENCES task_logs(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  commit_url TEXT NOT NULL,
  pesan TEXT NOT NULL,
  authored_at TEXT NOT NULL,
  ditambahkan_oleh INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ditambahkan_oleh, commit_sha)
);
CREATE INDEX idx_task_log_commits_task_log ON task_log_commits (task_log_id);
