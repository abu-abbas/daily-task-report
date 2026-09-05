# ADR-0014: Izin dan realisasi tidak boleh pada tanggal yang sama

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [04](../stages/04-koreksi-izin-penutupan.md).

## Konteks

Keputusan bisnis 14: menerima rekomendasi A.

## Keputusan

Untuk user yang sama, tanggal berstatus cuti/sakit/izin tidak boleh sekaligus memiliki realisasi. Salah satunya harus dikoreksi.

## Konsekuensi

Validasi lintas leaves dan task_logs pada backend, termasuk ketika edit. Izin Senin dan realisasi Jumat tetap sah. Izin sebagian hari belum masuk cakupan. Perlakuan rencana lama saat izin diaktifkan perlu dirinci; lihat Q-05.
