# ADR-0006: Kemarin berarti hari kerja sebelumnya

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [03](../stages/03-input-harian.md).

## Konteks

Keputusan bisnis 6: menerima rekomendasi B.

## Keputusan

Checklist realisasi mengambil rencana milik user aktif pada hari kerja sebelumnya menurut tabel kalender kerja tahunan (ADR-0026). Telusuri mundur dari tanggal laporan sampai menemukan tanggal yang ditandai hari kerja.

## Konsekuensi

Contoh: jika Senin hari kerja dan Sabtu/Minggu libur, laporan Senin mengacu ke Jumat. Jika Jumat juga ditandai libur, lanjut ke hari kerja sebelumnya. Kalender yang sama dipakai untuk indikator task nyangkut. Perlakuan cuti pribadi, tanggal kalender yang belum terisi, timezone, dan lintas bulan/tahun masih dirinci pada Q-01.
