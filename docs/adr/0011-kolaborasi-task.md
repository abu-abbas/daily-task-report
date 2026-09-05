# ADR-0011: Beberapa orang pada task yang sama

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [03](../stages/03-input-harian.md).

## Konteks

Keputusan bisnis 11: menerima rekomendasi A.

## Keputusan

Beberapa user boleh mengerjakan task yang sama pada tanggal yang sama. Setiap user memiliki log dan catatan hasil sendiri.

## Konsekuensi

Jangan membuat unique constraint global pada pasangan task dan tanggal. Aturan mencegah duplikasi user yang sama harus tetap memungkinkan kolaborasi lintas user; lihat Q-05.
