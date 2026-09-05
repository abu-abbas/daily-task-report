# ADR-0033: Satu akun dapat merangkap peran

- Status: diterima.
- Tanggal: 2026-09-05.
- Stage: 0, 1, dan 2.

## Konteks

Pengguna memastikan admin, atasan, dan supervisi juga dapat mencatat pekerjaan sendiri sebagai tenaga ahli.

## Keputusan

Satu akun dapat memiliki lebih dari satu peran: admin, atasan, supervisi, dan tenaga_ahli. Pencatatan pekerjaan sendiri menggunakan peran tenaga ahli, identitas akun yang sama, serta keanggotaan project yang sesuai.

## Konsekuensi

Kolom role tunggal tidak cukup. Usulan skema minimum adalah user_roles dengan pasangan unik user_id/role, tanpa mesin permission generik. Hak master data, rekap tim, dan laporan sendiri tetap terpisah menurut peran yang diberikan; menjadi admin tidak otomatis memberi hak mengedit laporan orang lain.

Hierarki tetap [atasan → supervisi → tenaga ahli](0031-hierarki-supervisi.md). Relasi tidak boleh menunjuk diri sendiri atau membentuk siklus walaupun akun merangkap peran. Usulan constraint dan validasi dijelaskan sebelum migration.
