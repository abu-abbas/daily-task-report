# ADR-0007: Tanggal log adalah tanggal pekerjaan

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [03](../stages/03-input-harian.md).

## Konteks

Keputusan bisnis 7: menerima rekomendasi A.

## Keputusan

Tanggal task_logs realisasi adalah tanggal pekerjaan dilakukan, bukan tanggal formulir dikirim. created_at merekam waktu pencatatan.

## Konsekuensi

Bedakan tanggal laporan, tanggal rencana, dan tanggal realisasi pada UI/API. Laporan Senin dapat menyimpan realisasi Jumat dan rencana Senin dalam satu submit. Riwayat dan ekspor mengikuti tanggal pekerjaan.
