-- ADR-0016: nama file asli buat ditampilkan di UI; nama di disk selalu acak (uuid), hindari
-- masalah sanitasi nama file arbitrary dari user.
ALTER TABLE attachments ADD COLUMN nama_asli TEXT NOT NULL DEFAULT '';
