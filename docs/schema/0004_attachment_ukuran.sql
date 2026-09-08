-- ADR-0016: ukuran file (bytes) disimpan saat upload, dipakai buat tampilan "PNG · 820 KB" di UI
-- lampiran — dari file yang sudah divalidasi, bukan dihitung ulang dari disk tiap kali dibaca.
ALTER TABLE attachments ADD COLUMN ukuran_bytes INTEGER NOT NULL DEFAULT 0;
