# Stage 06 — Dashboard dan rekap atasan

- Status: Belum dimulai.
- Prasyarat: Stage 5 dan pemetaan tim pada Q-02.
- Keputusan: [ADR-0004](../adr/0004-hak-akses.md), [ADR-0006](../adr/0006-hari-kerja.md), [ADR-0010](../adr/0010-task-tanpa-pemilik.md), [ADR-0011](../adr/0011-kolaborasi-task.md), [ADR-0017](../adr/0017-task-nyangkut.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0026](../adr/0026-kalender-kerja-tahunan.md).

## Cakupan

- Tampilkan siapa mengerjakan apa berdasarkan log; sediakan filter tanggal, project, dan orang dalam kewenangan pengguna.
- Tampilkan task open tanpa realisasi selama 5 hari kerja; gunakan tanggal dibuat bila belum memiliki realisasi.
- Hitung realisasi lintas user untuk aktivitas task dan jangan mereset indikator hanya karena rencana baru.
- Gunakan tabel kalender kerja tahunan yang sama dengan carry-over; hitung hari kerja berdasarkan status tanggal, termasuk libur tambahan.

## Kriteria selesai dan pemeriksaan

- [ ] Atasan hanya melihat tim yang berada dalam cakupannya, termasuk hasil filter dan detail.
- [ ] Task closed tidak masuk indikator; rencana baru saja tidak menghilangkan indikator.
- [ ] Kasus sebelum/tepat/setelah ambang 5 hari kerja serta task tanpa realisasi menghasilkan hasil sesuai definisi kalender.
- [ ] Rekap cocok dengan log sumber, tanpa penggandaan akibat join kendala/attachment.

## Dependensi terbuka

Q-01 dan Q-02. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

Belum ada implementasi atau pemeriksaan aplikasi. Isi hasil pemeriksaan dan keterbatasan aktual saat tahap dikerjakan. Berhenti setelah kriteria tahap terpenuhi; jangan menambahkan fitur di luar cakupan.
