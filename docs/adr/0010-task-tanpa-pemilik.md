# ADR-0010: Pemilihan task dan kepemilikan harian

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [03](../stages/03-input-harian.md).

## Konteks

Keputusan bisnis 10: menerima rekomendasi A; mempertahankan aturan inti spec.

## Keputusan

Rencana dan kerjaan tambahan boleh memilih task open pada project terkait atau membuat task baru. Task tidak memiliki user_id pemilik tetap; pelaku ditentukan task_logs.user_id per hari.

## Konsekuensi

Task yang tidak dicentang tidak menghasilkan realisasi, tidak memerlukan alasan, dan tidak ditutup otomatis. Tidak ada assign/reassign eksplisit. Rencana hari ini tetap manual dan tidak otomatis mengikutkan pekerjaan yang belum direalisasikan.
