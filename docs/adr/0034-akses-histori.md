# ADR-0034: Akses histori mengikuti hubungan aktif

- Status: diterima.
- Tanggal: 2026-09-05.
- Stage: 0, 1, 2, 5, 6, dan 7.

## Konteks

Pengguna menyetujui tenaga ahli tetap membaca histori miliknya setelah keluar project, atasan/supervisi aktif dapat membaca histori tenaga ahli saat ini, serta admin tidak otomatis mengedit laporan orang lain.

## Keputusan

- Tenaga ahli tetap dapat membaca laporan miliknya setelah keanggotaan project berakhir.
- Supervisi membaca histori tenaga ahli yang saat ini berada di bawahnya.
- Atasan membaca histori tenaga ahli melalui supervisi yang saat ini berada di bawahnya.
- Admin mengelola data master; status admin sendiri tidak memberi hak mengedit laporan orang lain.

## Konsekuensi

Pergantian hubungan dapat mengubah pembaca histori: pengelola baru memperoleh cakupan dan pengelola lama kehilangan cakupan yang sudah tidak dimilikinya. Aturan yang sama berlaku pada API, detail, attachment, dan ekspor. Tidak perlu menyimpan snapshot hubungan organisasi per log untuk kebijakan akses ini.

Keputusan ini mengatur baca. Kebijakan koreksi laporan pribadi setelah keluar project masih perlu dirinci pada Stage 4; jangan menyamakannya dengan izin menambah pekerjaan baru pada project lama.
