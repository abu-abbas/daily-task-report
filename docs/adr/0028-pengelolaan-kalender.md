# ADR-0028: Pengelolaan kalender bersama sebagai daftar libur

- Status: diterima; revisi menghapus mekanisme blok submit karena tidak lagi relevan.
- Tanggal: 2026-09-05 (revisi: 2026-09-05).
- Stage: 0 untuk keputusan; 2 untuk pengelolaan; 3/6 untuk penggunaan.
- Melengkapi: [ADR-0026](0026-kalender-kerja-tahunan.md) dan [ADR-0006](0006-hari-kerja.md).

## Konteks

Pengguna menerima satu kalender bersama yang dikelola admin. Rancangan awal menahan submit laporan bila kalender per tanggal belum diisi lengkap; setelah [ADR-0026](0026-kalender-kerja-tahunan.md) direvisi menjadi aturan default mingguan (Senin–Jumat kerja, Sabtu–Minggu libur tetap) plus tabel `holidays`, keadaan "kalender belum tersedia" tidak bisa terjadi lagi — status hari kerja untuk tanggal berapa pun selalu bisa dihitung.

## Keputusan

- Admin mengelola satu daftar libur/cuti bersama (`holidays`) untuk semua project dan tenaga ahli, berbentuk rentang tanggal (nama, mulai, akhir) sesuai [referensi](../references/holiday-settings.md).
- Senin–Jumat = hari kerja, Sabtu–Minggu = libur, tetap dan tidak dapat diubah admin per tanggal.
- Admin hanya menambah tanggal libur tambahan di luar akhir pekan (libur nasional, cuti bersama). Tidak ada mekanisme menjadikan Sabtu/Minggu hari kerja.
- Penentuan hari kerja sebelumnya dan hitungan task nyangkut membaca aturan + daftar libur yang sama, termasuk saat melewati tahun.

## Konsekuensi

Tidak ada lagi keadaan "kalender belum lengkap" maupun blok submit karenanya — dihapus dari cakupan aplikasi. Perubahan pada daftar `holidays` berlaku ke depan dan ke belakang sesuai perhitungan, tapi tidak memindahkan tanggal log yang sudah tersimpan ([ADR-0032](0032-tanggal-bisnis.md)). UI admin mengikuti [referensi](../references/holiday-settings.md): input nama, tanggal mulai, tanggal akhir, validasi mulai ≤ akhir.

Asia/Jakarta, pemisahan cuti pribadi, dan larangan mengubah tanggal log tersimpan ditetapkan pada [ADR-0032](0032-tanggal-bisnis.md). Detail ambang nyangkut dan penyajian formulir lama masih dirinci pada Q-01.
