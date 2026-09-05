# ADR-0028: Pengelolaan kalender bersama dan tanggal kosong

- Status: diterima.
- Tanggal: 2026-09-05.
- Stage: 0 untuk keputusan; 2 untuk pengelolaan; 3/6 untuk penggunaan.
- Melengkapi: [ADR-0026](0026-kalender-kerja-tahunan.md) dan [ADR-0006](0006-hari-kerja.md).

## Konteks

Pengguna menerima satu kalender bersama yang dikelola admin, pola awal Senin–Jumat kerja/Sabtu–Minggu libur yang dapat diubah, serta penahanan input saat kalender belum tersedia.

## Keputusan

- Admin mengelola satu kalender untuk semua project dan tenaga ahli.
- Pengisian awal tahun memakai Senin–Jumat sebagai hari kerja dan Sabtu–Minggu sebagai libur. Admin dapat mengubah status tanggal, termasuk hari kerja khusus dan libur tambahan.
- Jika kalender yang diperlukan untuk menentukan tanggal pekerjaan belum tersedia, submit laporan ditahan sampai kalender dilengkapi.
- Penentuan hari kerja sebelumnya dan hitungan task nyangkut membaca kalender yang sama, termasuk saat melewati tahun.

## Konsekuensi

Pola awal hanya untuk mengisi kalender; perhitungan tetap memakai baris kalender yang sudah dikelola. Tanggal kosong tidak boleh dianggap libur lalu dilewati. UI menjelaskan tanggal yang belum tersedia dan data tersimpan tetap dapat dibaca.

Usulan teknis satu baris per tanggal dengan input rentang libur serta pengisian tahun tanpa menimpa koreksi ada di [bahan review](../stages/00-review.md). Asia/Jakarta, pemisahan cuti pribadi, dan larangan mengubah tanggal log tersimpan ditetapkan pada [ADR-0032](0032-tanggal-bisnis.md). Detail ambang nyangkut dan penyajian formulir lama masih dirinci pada Q-01.
