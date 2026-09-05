# Stage 05 — Kendala, attachment, dan riwayat

- Status: Belum dimulai.
- Prasyarat: Stage 4.
- Keputusan: [ADR-0004](../adr/0004-hak-akses.md), [ADR-0009](../adr/0009-edit-submit.md), [ADR-0015](../adr/0015-kendala.md), [ADR-0016](../adr/0016-attachment.md), [ADR-0023](../adr/0023-mobile-first.md), [ADR-0024](../adr/0024-tema.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0039](../adr/0039-integrasi-commit-gitlab.md).

## Cakupan

- Tambahkan kendala opsional per task_log dan aksi resolved oleh pembuat log.
- Upload JPG/PNG maksimal 5 file per log dan 5 MB per file; gunakan attachments polymorphic dengan target task_log saja.
- Validasi server dan pembatasan akses file mengikuti kewenangan laporan.
- Bangun riwayat per tanggal pekerjaan dengan detail realisasi/rencana, kendala, attachment, dan izin.
- Tangani kegagalan upload serta edit/penghapusan referensi file secara konsisten.
- Sediakan penautan commit GitLab (manual, milik user sendiri) ke task_log sebagai bukti pendukung, sesuai [ADR-0039](../adr/0039-integrasi-commit-gitlab.md).

## Kriteria selesai dan pemeriksaan

- [ ] Riwayat sesuai log yang tersimpan; tanggal izin tetap terlihat walaupun tidak ada log.
- [ ] Upload dengan jenis, jumlah, atau ukuran tidak sah ditolak; user tanpa hak tidak dapat mengakses file.
- [ ] Kendala terikat pada log yang benar dan hanya aktor yang berhak dapat resolve.
- [ ] Edit/kegagalan upload tidak meninggalkan attachment rusak pada laporan.
- [ ] Riwayat dapat dibaca dan dioperasikan di mobile/laptop serta kedua tema.

## Dependensi terbuka

Aturan resolve lintas bulan pada Q-04 dan perubahan data tersimpan pada Q-05. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

Belum ada implementasi atau pemeriksaan aplikasi. Isi hasil pemeriksaan dan keterbatasan aktual saat tahap dikerjakan. Berhenti setelah kriteria tahap terpenuhi; jangan menambahkan fitur di luar cakupan.
