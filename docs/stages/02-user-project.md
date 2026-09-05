# Stage 02 — User, project, dan kalender kerja

- Status: Belum dimulai.
- Prasyarat: Stage 1.
- Keputusan: [ADR-0004](../adr/0004-hak-akses.md), [ADR-0005](../adr/0005-project-keanggotaan.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0026](../adr/0026-kalender-kerja-tahunan.md), [ADR-0040](../adr/0040-import-project-gitlab.md).

## Cakupan

- Sediakan pengelolaan user, project, dan keanggotaan oleh admin.
- Siapkan data contoh secukupnya untuk menguji satu user dengan beberapa project dan satu project dengan beberapa user.
- Filter pilihan project berdasarkan keanggotaan; periksa kembali pada backend.
- Sediakan pengelolaan daftar libur/cuti bersama (`holidays`, berbentuk rentang tanggal) oleh admin; Senin–Jumat kerja dan Sabtu–Minggu libur dihitung tetap, tidak diatur admin, sesuai [ADR-0028](../adr/0028-pengelolaan-kalender.md).
- Sediakan alternatif impor project dari GitLab CE (admin pilih satu-satu, sekali impor lalu independen), berdampingan dengan pembuatan manual, sesuai [ADR-0040](../adr/0040-import-project-gitlab.md).

## Kriteria selesai dan pemeriksaan

- [ ] Admin dapat mengelola data yang diperlukan untuk input harian.
- [ ] Tenaga ahli tidak dapat mencatat pekerjaan pada project di luar keanggotaannya, termasuk lewat request langsung.
- [ ] Perubahan keanggotaan mengikuti kebijakan riwayat yang sudah dirinci, tanpa menghilangkan histori secara tidak sengaja.
- [ ] Hari libur dapat diatur admin (rentang tanggal) dan dipakai bersama aturan default mingguan untuk penelusuran hari kerja sebelumnya, termasuk lintas tahun.

## Dependensi terbuka

Kebijakan keanggotaan pada Q-02 dan rincian pengelolaan kalender pada Q-01. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

Belum ada implementasi atau pemeriksaan aplikasi. Isi hasil pemeriksaan dan keterbatasan aktual saat tahap dikerjakan. Berhenti setelah kriteria tahap terpenuhi; jangan menambahkan fitur di luar cakupan.
