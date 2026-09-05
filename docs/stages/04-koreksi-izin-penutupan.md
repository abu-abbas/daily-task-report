# Stage 04 — Koreksi laporan, izin, dan penutupan task

- Status: Belum dimulai.
- Prasyarat: Stage 3.
- Keputusan: [ADR-0007](../adr/0007-tanggal-realisasi.md), [ADR-0008](../adr/0008-laporan-terlewat.md), [ADR-0009](../adr/0009-edit-submit.md), [ADR-0012](../adr/0012-penutupan-task.md), [ADR-0013](../adr/0013-izin-form.md), [ADR-0014](../adr/0014-izin-realisasi.md), [ADR-0025](../adr/0025-metode-ponytail.md).

## Cakupan

- Izinkan pemilihan tanggal laporan terlewat dan edit selama bulan berjalan sesuai aturan batas bulan.
- Submit ulang memperbarui data yang sama; perlakukan hapus/uncheck data tersimpan sesuai keputusan Q-05.
- Toggle izin menyembunyikan rencana tanggal laporan, tetapi realisasi dan tambahan hari kerja sebelumnya tetap tersedia.
- Simpan cuti/sakit/izin pada leaves dengan alasan opsional dan potong_cuti_tahunan=null.
- Tolak izin dan realisasi user yang sama pada tanggal sama, baik saat tambah maupun edit.
- Tutup task hanya lewat aksi eksplisit dengan deskripsi penutupan opsional.

## Kriteria selesai dan pemeriksaan

- [ ] Submit berulang tidak menggandakan data dan edit tidak mengubah log user lain.
- [ ] Kasus awal/akhir bulan mengikuti keputusan tertulis, termasuk realisasi hari kerja sebelumnya.
- [ ] Izin tanggal laporan dapat disimpan bersama realisasi tanggal sebelumnya; konflik tanggal sama ditolak secara atomik.
- [ ] Penutupan task bekerja dengan atau tanpa deskripsi; catatan hasil realisasi tetap wajib dan berbeda fungsinya.
- [ ] Task tidak ditutup otomatis oleh realisasi; perilaku rencana yang sudah ada ketika task ditutup telah diuji.

## Dependensi terbuka

Q-01, Q-04, Q-05 dan penyesuaian skema deskripsi penutupan. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

Belum ada implementasi atau pemeriksaan aplikasi. Isi hasil pemeriksaan dan keterbatasan aktual saat tahap dikerjakan. Berhenti setelah kriteria tahap terpenuhi; jangan menambahkan fitur di luar cakupan.
