# Stage 03 — Input harian inti

- Status: Belum dimulai.
- Prasyarat: Stage 2 termasuk kalender kerja tahunan; aturan tanggal pada Q-01.
- Keputusan: [ADR-0006](../adr/0006-hari-kerja.md), [ADR-0007](../adr/0007-tanggal-realisasi.md), [ADR-0010](../adr/0010-task-tanpa-pemilik.md), [ADR-0011](../adr/0011-kolaborasi-task.md), [ADR-0018](../adr/0018-tanpa-approval.md), [ADR-0021](../adr/0021-komponen-ui.md), [ADR-0022](../adr/0022-arah-visual.md), [ADR-0023](../adr/0023-mobile-first.md), [ADR-0024](../adr/0024-tema.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0026](../adr/0026-kalender-kerja-tahunan.md).

## Cakupan

- Tampilkan rencana user aktif pada hari kerja sebelumnya sebagai checklist realisasi; centang memerlukan catatan hasil.
- Sediakan kerjaan tambahan dengan task baru atau task open; buat realisasi is_extra=true.
- Pertahankan section realisasi saat kosong dengan CTA Tambah kerjaan kemarin (manual).
- Rencana tanggal laporan bersifat opsional, diisi manual, dan boleh memakai task open yang sama.
- Simpan seluruh submit dalam transaksi; bentuk identitas data yang memungkinkan edit tanpa log ganda pada Stage 4.
- Tampilkan aksi eksplisit yang nyaman disentuh pada light/dark mode; tanpa workflow approval.

## Kriteria selesai dan pemeriksaan

- [ ] Simulasi beberapa hari berhasil: rencana → realisasi sebagian → tambahan → rencana baru.
- [ ] Item tidak dicentang tidak menghasilkan realisasi atau penutupan; tidak perlu alasan dan tidak auto-carry ke rencana baru.
- [ ] Catatan realisasi kosong ditolak; kegagalan salah satu bagian tidak menyisakan simpan parsial.
- [ ] Cold start menghasilkan realisasi manual bertanggal pekerjaan dan is_extra=true.
- [ ] Dua user dapat mencatat realisasi pada task dan tanggal yang sama; catatan tetap terpisah.
- [ ] Checklist melewati seluruh tanggal libur yang tercatat, bukan hanya akhir pekan; pergantian tahun menggunakan kalender tahun sebelumnya.

## Dependensi terbuka

Q-01 serta aturan identitas item/submit pada Q-05. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

Belum ada implementasi atau pemeriksaan aplikasi. Isi hasil pemeriksaan dan keterbatasan aktual saat tahap dikerjakan. Berhenti setelah kriteria tahap terpenuhi; jangan menambahkan fitur di luar cakupan.
