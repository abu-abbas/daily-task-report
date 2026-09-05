# Stage 07 — Ekspor Word menurut tipe programmer

- Status: Belum dimulai; menunggu template asli.
- Prasyarat: Stage 5 untuk data laporan. Urutan kerja normal setelah Stage 6; template tidak menghalangi Stage 1–6.
- Keputusan: [ADR-0007](../adr/0007-tanggal-realisasi.md), [ADR-0013](../adr/0013-izin-form.md), [ADR-0014](../adr/0014-izin-realisasi.md), [ADR-0016](../adr/0016-attachment.md), [ADR-0019](../adr/0019-word-per-tipe.md), [ADR-0025](../adr/0025-metode-ponytail.md).

## Cakupan

- Terima dan pelajari contoh .docx untuk setiap tipe programmer yang masuk cakupan.
- Tetapkan pemetaan tipe programmer ke template dan jelaskan perubahan skema minimum jika diperlukan.
- Hasilkan satu dokumen per tenaga ahli per bulan: timesheet, narasi realisasi, izin, serta lampiran sesuai template.
- Gunakan placeholder dari spec hanya bila cocok dengan template aktual; jangan membuat editor template generik.

## Kriteria selesai dan pemeriksaan

- [ ] Dokumen untuk setiap tipe yang disepakati dapat dibuka dan layout/isinya sesuai contoh pengguna.
- [ ] Data dipilih berdasarkan tanggal pekerjaan pada bulan dan user yang benar.
- [ ] Izin, hari tanpa laporan, libur, dan attachment mengikuti aturan template; tidak ada penggandaan aktivitas karena join.
- [ ] Template/tipe yang belum tersedia ditangani dengan pesan jelas, tidak memakai template yang keliru diam-diam.

## Dependensi terbuka

File template dan seluruh Q-06; hasil ekspor belum dapat dinyatakan final sebelum tersedia. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

Belum ada implementasi atau pemeriksaan aplikasi. Isi hasil pemeriksaan dan keterbatasan aktual saat tahap dikerjakan. Berhenti setelah kriteria tahap terpenuhi; jangan menambahkan fitur di luar cakupan.
