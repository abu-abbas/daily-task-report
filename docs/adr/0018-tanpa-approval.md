# ADR-0018: Laporan tanpa workflow approval

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [03](../stages/03-input-harian.md).

## Konteks

Keputusan bisnis 18: menerima rekomendasi A.

## Keputusan

Laporan cukup disimpan, dibaca pada riwayat/rekap, dan diekspor. Tidak ada alur kirim untuk approval, setujui, atau kembalikan.

## Konsekuensi

Label Kirim laporan tidak berarti status persetujuan. Jangan menambah state machine approval atau fitur koreksi melalui persetujuan atasan.
