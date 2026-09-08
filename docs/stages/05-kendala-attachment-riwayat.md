# Stage 05 — Kendala, attachment, dan riwayat

- Status: Sedang dikerjakan — kendala dan attachment per log realisasi selesai (2026-09-08); riwayat dan tautan commit GitLab menyusul.
- Prasyarat: Stage 4.
- Keputusan: [ADR-0004](../adr/0004-hak-akses.md), [ADR-0009](../adr/0009-edit-submit.md), [ADR-0015](../adr/0015-kendala.md), [ADR-0016](../adr/0016-attachment.md), [ADR-0023](../adr/0023-mobile-first.md), [ADR-0024](../adr/0024-tema.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0039](../adr/0039-integrasi-commit-gitlab.md).

## Cakupan

- Tambahkan kendala opsional per task_log dan aksi resolved oleh pembuat log.
- Upload JPG/PNG maksimal 5 file per log dan 5 MB per file; gunakan attachments polymorphic dengan target task_log saja.
- Validasi server dan pembatasan akses file mengikuti kewenangan laporan.
- Bangun riwayat per tanggal pekerjaan dengan detail realisasi/rencana, kendala, attachment, dan izin.
- Tangani kegagalan upload serta edit/penghapusan referensi file secara konsisten.
- Sediakan penautan commit GitLab (manual, milik user sendiri) ke task_log sebagai bukti pendukung, sesuai [ADR-0039](../adr/0039-integrasi-commit-gitlab.md).

## Kriteria selesai dan pemeriksaan

- [ ] Riwayat sesuai log yang tersimpan; tanggal izin tetap terlihat walaupun tidak ada log.
- [x] Upload dengan jenis, jumlah, atau ukuran tidak sah ditolak; user tanpa hak tidak dapat mengakses file (otorisasi pemilik-saja, cakupan hierarki lebih luas menunggu Riwayat — lihat ADR-0016).
- [x] Kendala terikat pada log yang benar dan hanya aktor yang berhak dapat resolve.
- [x] Edit/kegagalan upload tidak meninggalkan attachment rusak pada laporan.
- [ ] Riwayat dapat dibaca dan dioperasikan di mobile/laptop serta kedua tema.

## Dependensi terbuka

Aturan resolve lintas bulan pada Q-04 **selesai** (lihat [ADR-0015](../adr/0015-kendala.md): boleh kapan saja). Perubahan data tersimpan pada Q-05 masih relevan untuk bagian attachment/riwayat yang belum dikerjakan. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

**Kendala per log realisasi** ([ADR-0015](../adr/0015-kendala.md)) — selesai 2026-09-08:

- **Backend**: `server/src/routes/kendala.ts` (baru) — `handleCreateKendala` (`POST /api/bottlenecks`, body `{taskLogId, deskripsi}`, 400 kalau log-nya jenis rencana, 403 kalau bukan pembuat log, 404 kalau log tidak ada), `handleResolveKendala` (`POST /api/bottlenecks/:id/resolve`, 409 kalau sudah resolved — satu arah, tidak ada reopen), `handleDeleteKendala` (`DELETE /api/bottlenecks/:id`, 204). URL sengaja pakai Inggris (`/api/bottlenecks`) walau nama file/fungsi/tabel/komponen tetap "kendala" — permintaan user, cuma path URL yang diganti, bukan rename menyeluruh. Otorisasi murni kepemilikan `task_logs.user_id`, tanpa cek ulang keanggotaan project. `server/src/routes/task-logs.ts`: `GET /task-logs/daily` sekarang ikut mengembalikan `taskLogId` dan `kendala[]` per item checklist dan kerjaan tambahan (query kendala sekali jalan per `task_log_id`, bukan N+1).
- **Test otomatis**: `server/tests/kendala.test.ts` (baru, 13 test) — otorisasi, 404/403/400/409, kendala hanya untuk log realisasi, resolve tetap berhasil walau tanggal log sudah lama (membuktikan "boleh kapan saja"). Total 119 test lolos lintas file.
- **Frontend**: komponen baru `KendalaList.vue` (`components/input-harian/`) dipakai di kartu "Realisasi" (checklist, cuma tampil saat item dicentang) dan "Kerjaan tambahan" di `InputHarianView.vue` — daftar kendala dengan badge status (`Kendala`/`Selesai`), tombol "Tandai selesai" (hilang otomatis setelah resolved) dan "Hapus", plus form kecil "+ Tambah kendala" (disembunyikan kalau log belum pernah tersimpan). Tiap aksi (`useCreateKendala`/`useResolveKendala`/`useDeleteKendala`, baru di `composables/useTaskLogs.ts`) manggil API langsung dan invalidate query harian — tidak dibundel ke tombol "Simpan" utama.
- **Diverifikasi lewat Playwright** (akun uji sementara, data dihapus setelah selesai): tambah kendala ke item checklist yang sudah tersimpan → badge "Kendala" muncul dengan tombol "Tandai selesai"+"Hapus" → klik "Tandai selesai" → badge jadi "Selesai", tombol resolve hilang, "Hapus" tetap ada. Tambah kendala ke item "Kerjaan tambahan" → hapus → baris hilang dari daftar. Screenshot desktop+dark dan mobile+light, layout badge/tombol tetap rapi (wrap dengan benar) di kedua ukuran.
- **Bug ditemukan lewat laporan user** (realisasi yang sudah dicentang + kendala yang sudah resolved tiba-tiba hilang setelah klik "Simpan"): direproduksi lewat Playwright — checkbox checklist ke-uncheck (mis. kepencet), lalu isi rencana baru dan simpan. Efek uncheck checklist (ADR-0044) memang sudah didesain menghapus baris realisasi tersimpan, tapi sejak kendala menempel ke baris itu (`ON DELETE CASCADE`), kendalanya ikut terhapus **diam-diam tanpa peringatan**. Fix: `InputHarianView.vue` menghitung `checklistKendalaAkanHilang` (checklist yang di-uncheck tapi masih punya kendala tersimpan) dan menampilkannya sebagai peringatan merah di dialog konfirmasi simpan, pola sama seperti peringatan izin-menghapus-rencana yang sudah ada. Tidak ada perubahan backend — perilaku hapusnya sendiri tetap sesuai ADR-0044, cuma sekarang user diberi tahu dulu. Diverifikasi lewat Playwright: uncheck checklist yang punya kendala → buka dialog konfirmasi → peringatan muncul dengan jumlah checklist dan kendala yang akan hilang.

**Attachment gambar pada log realisasi** ([ADR-0016](../adr/0016-attachment.md)) — selesai 2026-09-08:

- **Backend**: `server/src/storage.ts` (baru) — `saveAttachmentFile`/`deleteAttachmentFile` (folder `data/attachments/<YYYY>/<MM>/<DD>/<task_log_id>/<uuid>.<ext>`, YYYY/MM/DD dari `task_logs.tanggal`), `detectImageExt` (sniff signature byte JPEG/PNG asli, bukan percaya `Content-Type` klaim klien). `server/src/db.ts` export `storageDir` (diturunkan dari `dbPath`, otomatis ikut redirect ke tmpdir saat test — isolasi attachment test tanpa env var baru). `server/src/routes/attachments.ts` (baru) — `handleUploadAttachment` (`POST /api/attachments`, multipart/form-data, validasi 404/403/400 kepemilikan+jenis log+jumlah max 5+ukuran max 5MB+signature file), `handleDeleteAttachment` (`DELETE /api/attachments/:id`, 204, hapus file+baris), `handleGetAttachmentFile` (`GET /api/attachments/:id/file`, akses-terkontrol, `Content-Disposition: inline` dengan nama asli). Migration `docs/schema/0003_attachment_nama_asli.sql` nambah kolom `attachments.nama_asli`. `server/src/routes/task-logs.ts`: `GET /task-logs/daily` ikut mengembalikan `attachments[]` per item checklist/kerjaan tambahan; `handleSaveDailyInput` efek-uncheck sekarang memanggil `deleteAttachmentsByTaskLogIds` SEBELUM menghapus baris `task_logs`, karena attachment polymorphic **tidak** auto-cascade seperti kendala.
- **Test otomatis**: `server/tests/attachments.test.ts` (baru, 16 test) — otorisasi, 404/403/400 (bukan gambar walau diklaim `image/jpeg`, >5MB, log jenis rencana, sudah 5 lampiran), upload JPG/PNG valid, hapus (204, file hilang dari disk), lihat file (Content-Type benar), dan efek-uncheck ikut membersihkan attachment (baris DB + file disk, tanpa nyangkut). Total 135 test lolos lintas file.
- **Frontend**: komponen baru `AttachmentList.vue` (`components/input-harian/`) dipakai di checklist Realisasi dan Kerjaan tambahan (bukan Rencana) — grid thumbnail gambar (klik buka file asli di tab baru), tombol hapus muncul saat hover, tombol "Lampiran" (ikon `Paperclip`) yang men-trigger `<input type="file">` tersembunyi, disembunyikan kalau log belum tersimpan atau sudah 5 lampiran. Validasi ringan di klien (tipe+ukuran) sebelum upload, validasi asli tetap di server. `useUploadAttachment`/`useDeleteAttachment` (baru di `composables/useTaskLogs.ts`) invalidate query harian.
- Peringatan uncheck yang sebelumnya cuma sebut kendala (`checklistKendalaAkanHilang`) digabung jadi `checklistDataAkanHilang` yang sebut kendala **dan** lampiran sekaligus dalam satu kalimat di dialog konfirmasi simpan.
- **Diverifikasi lewat Playwright** (akun uji sementara, data + folder `data/attachments` dev dibersihkan setelah selesai): upload JPG ke checklist → thumbnail muncul; upload PNG ke Kerjaan tambahan → thumbnail kedua muncul; hover+hapus salah satu → hilang dari daftar, yang lain tetap ada. Upload file `.txt` yang diganti nama jadi `.jpg` (menyamar) → ditolak 400 dengan toast error, membuktikan validasi baca signature asli bukan cuma ekstensi/klaim klien. Uncheck checklist yang punya kendala+lampiran sekaligus → dialog konfirmasi menampilkan "1 checklist yang di-uncheck sudah punya 1 kendala dan 2 lampiran tercatat...". Screenshot desktop+dark dan mobile+light.

Riwayat dan tautan commit GitLab belum dikerjakan — putaran terpisah berikutnya.
