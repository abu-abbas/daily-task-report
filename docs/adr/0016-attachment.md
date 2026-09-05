# ADR-0016: Attachment gambar pada log

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [05](../stages/05-kendala-attachment-riwayat.md).

## Konteks

Keputusan bisnis 16: menerima rekomendasi A.

## Keputusan

Izinkan JPG/PNG saja; maksimal 5 file per log dan maksimal 5 MB per file. Attachment opsional, menggunakan relasi polymorphic yang sudah diminta, dengan task_log sebagai target implementasi awal.

## Konsekuensi

Validasi ukuran, jumlah, dan isi/jenis file di server; batasi akses sesuai pemilik/cakupan laporan. Jangan membangun dukungan entitas lain sekarang. File dan referensi database harus konsisten ketika upload gagal atau data diedit.
