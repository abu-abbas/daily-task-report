-- ADR-0019 revisi lanjutan (2026-09-11): Cover/Pendahuluan (BAB I)/Ruang Lingkup (BAB II) sudah
-- statis di template Word masing-masing tenaga ahli — mesin kontrak/jabatan/ppk/ruang-lingkup/
-- pendahuluan yang dibangun sebelumnya (ADR-0046) ternyata tidak dipakai jalur Word sama sekali,
-- dihapus alih-alih dibiarkan menganggur (ponytail — bukan "siapa tahu dipakai lagi").
-- saran_bulanan dan laporan_template TETAP ADA (masih dipakai mail-merge Word).
-- Urutan drop: anak dulu (referensi FK ke jabatan/users) baru induknya.
DROP TABLE IF EXISTS ruang_lingkup_override;
DROP TABLE IF EXISTS ruang_lingkup_jabatan;
DROP TABLE IF EXISTS pendahuluan_bulanan;
DROP TABLE IF EXISTS kontrak;
DROP TABLE IF EXISTS ppk_saat_ini;
DROP TABLE IF EXISTS jabatan;
