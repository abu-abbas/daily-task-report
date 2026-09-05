# ADR-0030: Pengecualian realisasi pada awal bulan

- Status: diterima.
- Tanggal: 2026-09-05.
- Stage: 0 untuk keputusan; 3/4 untuk input dan edit; 7 untuk ekspor.
- Melengkapi: [ADR-0007](0007-tanggal-realisasi.md), [ADR-0008](0008-laporan-terlewat.md), dan [ADR-0009](0009-edit-submit.md).

## Konteks

Pada hari kerja pertama bulan baru, laporan dapat memuat pekerjaan hari kerja terakhir bulan sebelumnya. Aturan bulan berjalan saja akan menutup kesempatan mencatat realisasi tersebut.

## Keputusan

Pengguna mengizinkan pengisian atau koreksi realisasi hari kerja terakhir bulan sebelumnya pada hari kerja pertama bulan baru. Tanggal lama lainnya tetap terkunci; aturan umum pengisian/edit dalam bulan berjalan tetap berlaku.

## Konsekuensi

- Hari kerja pertama/terakhir ditentukan kalender bersama, termasuk lintas tahun dan libur beruntun.
- Backend mengecek hari saat aksi dilakukan. Memilih tanggal formulir awal bulan pada hari berikutnya tidak membuka kembali pengecualian.
- Tanggal log tetap tanggal pekerjaan bulan sebelumnya, sehingga masuk ekspor bulan sebelumnya; created_at mencatat waktu input sebenarnya.
- Pengecualian ini hanya untuk realisasi, bukan pembukaan umum untuk mengubah rencana, izin, atau tanggal-tanggal lain bulan lalu.

## Kasus penerimaan

- Jika tanggal kerja pertama April mengacu ke tanggal kerja terakhir Maret, realisasi Maret tersebut boleh diisi atau dikoreksi pada hari itu.
- Realisasi tanggal Maret yang lebih lama tetap ditolak.
- Pada hari kerja berikutnya, memilih ulang formulir pertama April tidak mengaktifkan pengecualian.
- Bila kalender tahun sebelumnya diperlukan tetapi kosong, blok submit sesuai [ADR-0028](0028-pengelolaan-kalender.md).

Timezone bisnis telah ditetapkan Asia/Jakarta pada [ADR-0032](0032-tanggal-bisnis.md).
