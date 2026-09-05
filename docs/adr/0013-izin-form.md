# ADR-0013: Izin hari ini tetap mengizinkan realisasi sebelumnya

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [04](../stages/04-koreksi-izin-penutupan.md).

## Konteks

Keputusan bisnis 13: menerima rekomendasi B, menggantikan perilaku toggle pada spec awal.

## Keputusan

Saat toggle izin/tidak masuk untuk tanggal laporan aktif, form rencana tanggal itu disembunyikan dan diganti form cuti/sakit/izin. Realisasi serta kerjaan tambahan hari kerja sebelumnya tetap bisa diisi.

## Konsekuensi

Simpan izin dalam leaves; alasan opsional dan potong_cuti_tahunan tetap null. Jangan menyembunyikan seluruh form sebagaimana spec awal. Tidak menghitung kuota cuti.
