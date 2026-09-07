# ADR-0045: Penutupan task eksplisit dengan deskripsi opsional

- Status: diterima; poin 2 direvisi 2026-09-08 setelah verifikasi lewat browser menunjukkan hasil aslinya membingungkan (lihat Konteks revisi); poin 2 disempurnakan lagi hari yang sama (lihat Revisi kedua).
- Tanggal: 2026-09-08.
- Stage utama: [04](../stages/04-koreksi-izin-penutupan.md).
- Melengkapi: [ADR-0010](0010-task-tanpa-pemilik.md), [ADR-0011](0011-kolaborasi-task.md), [ADR-0012](0012-penutupan-task.md).

## Konteks

ADR-0012 sudah memutuskan task cuma menjadi closed lewat aksi eksplisit "Tandai task selesai" dengan deskripsi penutupan opsional, tapi menyisakan tiga rincian di Q-04: siapa boleh menutup, nasib rencana yang belum direalisasi, dan apakah reopen dibutuhkan. Ini jawabannya.

**Revisi poin 2** (hari yang sama, setelah verifikasi lewat browser): keputusan awal "rencana belum direalisasi dihapus" bikin task yang ditutup terasa hilang tanpa jejak — user menunjukkan lewat screenshot bahwa rencana yang ditutup malah lenyap total dari checklist realisasi besoknya, padahal maksud "tandai selesai" itu task-nya memang tidak bisa dilanjutkan lagi, **bukan berarti pekerjaannya dianggap batal**. Kalau task ditutup, rencana yang belum sempat direalisasi seharusnya dianggap terealisasi (kan sudah dinyatakan selesai), bukan dihapus diam-diam.

**Revisi kedua** (hari yang sama, dua masalah dari screenshot lanjutan): (a) task yang sudah closed tidak kelihatan statusnya di daftar "Kerjaan tambahan"/"Rencana" — user tidak tahu task itu sudah ditutup atau belum sampai mencoba klik lagi; (b) saat menutup task tanpa mengisi deskripsi penutupan, catatan realisasi otomatis yang dihasilkan selalu fallback ke teks generik "Task ditutup." — padahal rencananya sendiri sudah punya catatan/checklist yang ditulis user (mubazir, kelihatan seperti catatan lama ketimpa). Perbaikan: (a) query checklist/tambahan/rencana ikut mengembalikan `task.status`, ditampilkan sebagai badge "Ditutup" menggantikan tombol/ikon "Tandai selesai" kalau task sudah closed; (b) prioritas catatan realisasi otomatis diubah jadi per-baris: deskripsi penutupan (kalau diisi) > catatan rencana yang sudah ada duluan di baris itu > fallback generik "Task ditutup." kalau memang keduanya kosong — bukan lagi satu nilai global yang dipakai rata ke semua baris.

## Keputusan

1. **Siapa boleh menutup**: siapa pun anggota aktif project task itu — sama seperti akses baca-tulis task lainnya (task tanpa pemilik tetap, ADR-0010; dikerjakan bareng, ADR-0011). Tidak ada role khusus.
2. **Rencana yang belum direalisasi** (direvisi dua kali): **dikonversi jadi realisasi**, bukan dihapus — dalam transaksi yang sama saat task ditutup, setiap baris rencana yang belum punya realisasi pasangannya (per user+tanggal) dapat baris realisasi baru. Catatan baris baru itu dipilih per-baris dengan prioritas: deskripsi penutupan (kalau diisi) → catatan rencana baris itu sendiri (kalau sudah ada) → fallback generik "Task ditutup." (kalau keduanya kosong). Baris rencana aslinya **tidak dihapus** — tetap ada sebagai histori, dan checklist realisasi besoknya otomatis menampilkan task itu sudah tercentang dengan catatan itu. Rencana yang **sudah** punya realisasi sendiri tidak disentuh (catatannya tidak tertimpa).
3. **Reopen**: tidak dibangun sekarang (YAGNI, sesuai teks ADR-0012 sendiri). Task closed tetap closed; kalau nanti terbukti dibutuhkan, jadi ADR/pekerjaan terpisah.
4. **Resolve kendala setelah batas edit bulanan**: di luar cakupan sekarang — kendala (ADR-0015) belum dibangun (Stage 5), jadi belum ada yang perlu diputuskan soal interaksinya dengan penutupan task.

Deskripsi penutupan pakai textarea polos (bukan `MiniMarkdownEditor`) — teks penutupan singkat, bukan catatan kerja harian.

## Konsekuensi

Endpoint baru `POST /api/tasks/:id/tutup` (body `{deskripsiPenutupan?}`) menulis ke kolom `tasks.status`/`tasks.deskripsi_penutupan` yang sudah ada sejak migration awal — tidak ada migration baru. Task closed otomatis tidak lagi muncul di `GET /api/tasks` (filter `status='open'` sudah ada sejak Stage 3), tapi histori realisasi/rencananya (termasuk yang baru dikonversi) tetap utuh dan tetap terlihat di checklist/riwayat. UI: tombol icon "Tandai selesai" (`CircleCheck` + `Tooltip`) di setiap task pada kartu "Kerjaan tambahan" dan "Rencana" (`InputHarianView.vue`), dialog konfirmasi tunggal dipakai ulang untuk task mana pun yang diklik.

`GET /api/task-logs/daily` ikut mengembalikan `taskStatus` untuk setiap item checklist/tambahan/rencana (join ke `tasks.status`) supaya `InputHarianView.vue` bisa menampilkan badge "Ditutup" di posisi tombol/ikon "Tandai selesai" begitu task closed — baik di kartu "Kerjaan tambahan"/"Rencana" (badge menggantikan tombol) maupun di checklist Realisasi (badge murni indikator tambahan, tidak menggantikan apa pun karena checklist Realisasi memang tidak punya tombol aksi).
