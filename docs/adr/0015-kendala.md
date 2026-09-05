# ADR-0015: Kendala per log dan penyelesaiannya

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [05](../stages/05-kendala-attachment-riwayat.md).

## Konteks

Keputusan bisnis 15: menerima rekomendasi A.

## Keputusan

Kendala bersifat opsional, terkait task_log tertentu, dan dapat ditandai resolved oleh pembuat log.

## Konsekuensi

Pertahankan relasi task_logs 1—N kendala. Jangan memindahkannya menjadi status permanen task. Kewenangan atasan untuk resolve belum diberikan; aturan resolve setelah bulan ditutup perlu diperjelas di Q-04.
