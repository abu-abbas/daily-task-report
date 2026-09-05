# ADR-0026: Tabel kalender kerja tahunan

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [02](../stages/02-user-project.md).

## Konteks

Instruksi tambahan pengguna: wajib ada tabel kalender kerja untuk mengatur libur selama setahun dan menentukan pekerjaan kemarin.

## Keputusan

Tambahkan tabel kalender kerja tahunan sebagai sumber status hari kerja/libur per tanggal. Hari kerja sebelumnya dan ambang 5 hari kerja task nyangkut memakai data kalender yang sama, termasuk saat penelusuran melintasi tahun.

## Konsekuensi

Kebutuhan tabel baru telah disetujui pengguna. Usulan struktur minimum: tanggal unik, penanda hari kerja/libur, dan keterangan opsional; nama tabel/kolom serta DDL belum ditetapkan. Pengelolaan kalender masuk Stage 2 sebelum input harian. Hindari asumsi akhir pekan sebagai satu-satunya libur. Pengisian awal, kewenangan pengelola, perlakuan tanggal kosong, dan pengaruh perubahan kalender pada histori perlu dirinci di Q-01. Tidak mengasumsikan integrasi API libur eksternal.
