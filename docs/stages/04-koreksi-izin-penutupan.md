# Stage 04 — Koreksi laporan, izin, dan penutupan task

- Status: Selesai — pilih tanggal laporan, edit data tersimpan, form izin ([ADR-0044](../adr/0044-tanggal-laporan-dan-izin.md)), dan penutupan task ([ADR-0045](../adr/0045-penutupan-task.md)) semuanya sudah jalan, teruji, dan diverifikasi visual.
- Prasyarat: Stage 3.
- Keputusan: [ADR-0007](../adr/0007-tanggal-realisasi.md), [ADR-0008](../adr/0008-laporan-terlewat.md), [ADR-0009](../adr/0009-edit-submit.md), [ADR-0012](../adr/0012-penutupan-task.md), [ADR-0013](../adr/0013-izin-form.md), [ADR-0014](../adr/0014-izin-realisasi.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0044](../adr/0044-tanggal-laporan-dan-izin.md), [ADR-0045](../adr/0045-penutupan-task.md).

## Cakupan

- Izinkan pemilihan tanggal laporan terlewat dan edit selama bulan berjalan sesuai aturan batas bulan.
- Submit ulang memperbarui data yang sama; perlakukan hapus/uncheck data tersimpan sesuai keputusan Q-05.
- Toggle izin menyembunyikan rencana tanggal laporan, tetapi realisasi dan tambahan hari kerja sebelumnya tetap tersedia.
- Simpan cuti/sakit/izin pada leaves dengan alasan opsional dan potong_cuti_tahunan=null.
- Tolak izin dan realisasi user yang sama pada tanggal sama, baik saat tambah maupun edit.
- Tutup task hanya lewat aksi eksplisit dengan deskripsi penutupan opsional.

## Kriteria selesai dan pemeriksaan

- [x] Submit berulang tidak menggandakan data dan edit tidak mengubah log user lain.
- [x] Kasus awal/akhir bulan mengikuti keputusan tertulis, termasuk realisasi hari kerja sebelumnya.
- [x] Izin tanggal laporan dapat disimpan bersama realisasi tanggal sebelumnya; konflik tanggal sama ditolak secara atomik.
- [x] Penutupan task bekerja dengan atau tanpa deskripsi; catatan hasil realisasi tetap wajib dan berbeda fungsinya.
- [x] Task tidak ditutup otomatis oleh realisasi; perilaku rencana yang sudah ada ketika task ditutup telah diuji.

## Dependensi terbuka

Tidak ada — Q-01, Q-04, dan Q-05 sudah selesai untuk seluruh cakupan stage ini. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

**Pilih tanggal laporan, edit, dan izin** ([ADR-0044](../adr/0044-tanggal-laporan-dan-izin.md)) — selesai 2026-09-07:

- **Backend**: `server/src/kalender.ts` bertambah `dalamBulanBerjalan()` dan `realisasiTanggalDiizinkan()` (ADR-0030). `server/src/routes/task-logs.ts` di-generalisasi dari "today" ke tanggal pilihan klien (`GET /task-logs/daily?tanggal=`, `POST /task-logs` field `tanggal`), plus efek uncheck (hapus baris checklist lama) dan validasi konflik izin (409). `server/src/routes/leaves.ts` (baru) — `POST /leaves` (upsert, auto-hapus rencana lama di tanggal sama, tolak 409 kalau ada realisasi), `DELETE /leaves/:tanggal`.
- **Test otomatis**: `server/tests/task-logs.test.ts` bertambah dari 24 ke 33 test (bulan berjalan, pengecualian ADR-0030, efek uncheck, konflik izin). `server/tests/leaves.test.ts` baru (9 test). Total 98 test lolos lintas file.
- **Frontend**: `InputHarianView.vue` dapat date-input (`min`/`max` dari `data.hariIni`, query string `?tanggal=`), checkbox toggle izin yang menyembunyikan card "Rencana" diganti form `Select` jenis + `Textarea` alasan. `BerandaView.vue` menampilkan banner "Cuti/Sakit/Izin hari ini" kalau `data.izin` tidak null. `lib/api.ts`/`composables/useTaskLogs.ts` digeneralisasi (`TodayInput` → `DailyInput`, `useDailyInputQuery(tanggal: Ref)`, `useSaveLeave`/`useCancelLeave`).
- **Diverifikasi end-to-end** lewat Playwright (akun uji sementara, dihapus setelah selesai): tambah rencana hari ini → simpan → toggle izin, isi Sakit + alasan → simpan → Beranda tampilkan banner izin, rencana lama otomatis hilang → buka `/input` lagi, form izin ter-restore dengan alasan yang benar → matikan izin → simpan → Beranda kembali ke "Belum ada rencana" → ganti tanggal laporan ke backdate dalam bulan berjalan, card Realisasi/Rencana ikut berubah tanggalnya. Dicek juga tampilan dark mode.
- Perbaikan dari review user: mengaktifkan izin saat tanggal itu sudah punya rencana tersimpan langsung menghapusnya diam-diam begitu "Simpan" diklik, tanpa user tahu dulu — mengagetkan. Ditambah baris peringatan merah di dialog konfirmasi "Simpan" yang sudah ada (bukan dialog baru): "N rencana yang sudah tersimpan di tanggal ini akan terhapus karena izin diaktifkan", cuma muncul kalau kondisinya benar relevan (izin aktif dan ada rencana tersimpan). Diverifikasi lewat Playwright: peringatan tampil di dialog konfirmasi sebelum user klik "Ya, simpan".
- Perbaikan teks lanjutan: user bingung lihat "0 kerjaan tambahan" di dialog konfirmasi padahal ada kartu "Kerjaan tambahan" tersimpan di halaman — ternyata angka itu cuma menghitung draf **baru** sesi ini, bukan total yang sudah tersimpan (yang mana tidak berubah oleh submit ini). Diperjelas jadi "kerjaan tambahan **baru**"/"rencana **baru**" plus kalimat eksplisit "Item yang sudah tersimpan sebelumnya tidak dihitung ulang di sini."
- Perubahan layout dari review user: kartu "Kerjaan tambahan"/"Rencana" (`InputHarianView.vue`) dan kartu rencana Beranda (`BerandaView.vue`) tadinya menampilkan badge project berulang di tiap task walau beberapa task ada di project yang sama — sekarang dikelompokkan (`lib/groupByProject.ts`, dipakai generik lewat constraint `{projectId, projectNama}`): badge project cuma tampil sekali per grup di bagian atas, task-task di bawahnya dipisah garis tipis (`border-t` + `first:border-t-0`). Konsisten di ketiga tempat karena polanya sama persis. Diverifikasi lewat Playwright: dua task di project sama tergabung satu kartu dengan satu badge, project lain jadi kartu terpisah.
- Kalender bulanan di sidebar kanan (`AppSidebarRight.vue`) ternyata cuma dekorasi sejak awal — tidak ada `v-model`/handler apa pun, peninggalan template block awal, ditemukan lewat pertanyaan user ("pajangan doang dong"). Dihubungkan ke tanggal laporan: klik tanggal di kalender itu sekarang `router.push` ke `/input?tanggal=`, dibatasi bulan berjalan (`min-value`/`max-value`) sama seperti date-picker `InputHarianView`. Bug ditemukan sekaligus saat verifikasi: `selectedTanggal` di `InputHarianView.vue` cuma dibaca sekali dari `route.query` saat komponen dibuat, tidak reaktif terhadap navigasi `?tanggal=` dari LUAR komponen (klik di sidebar pakai `router.push`, bukan date-input lokalnya sendiri) — jadi URL berubah tapi konten halaman diam. Diperbaiki dengan `watch(() => route.query.tanggal, ...)` yang menyinkronkan balik ke `selectedTanggal`. Diverifikasi lewat Playwright: klik tanggal di sidebar mengubah URL DAN konten (card Realisasi/Rencana, date-input) sekaligus.

- Perbaikan lanjutan dari review user: field "Tanggal laporan" di halaman Input Harian jadi ganda begitu kalender sidebar bisa dipakai navigasi — tapi kalender sidebar (`AppSidebarRight.vue`) cuma tampil di layar besar (`hidden lg:flex`), sedangkan aplikasi ini mobile-first (ADR-0023). Diselesaikan dengan menyembunyikan field itu cuma di breakpoint `lg` ke atas (`lg:hidden` pada wrapper-nya) — tetap satu-satunya cara pilih tanggal di mobile. Field-nya sendiri juga diganti dari `<input type="date">` native jadi `Popover` + `Calendar` shadcn-vue (permintaan user, konsisten dengan pola date-picker lain di app — form tanggal libur admin dan kalender sidebar), pakai `@internationalized/date` (`parseDate`) buat konversi ke/dari string ISO. Diverifikasi lewat Playwright: field cuma muncul di mobile (`isVisible` false di desktop), popover kalender terbuka dan klik tanggal mengubah URL + konten halaman.

**Penutupan task** ([ADR-0045](../adr/0045-penutupan-task.md)) — selesai 2026-09-08:

- **Backend**: `server/src/routes/tasks.ts` bertambah `handleCloseTask` (`POST /api/tasks/:id/tutup`, body `{deskripsiPenutupan?}`) — siapa pun anggota aktif project boleh menutup (404 kalau task tidak ada, 403 kalau bukan anggota, 409 kalau sudah closed). Dalam transaksi yang sama: `UPDATE tasks SET status='closed', deskripsi_penutupan=?` lalu hapus baris `task_logs` jenis rencana yang belum punya realisasi pasangannya (`NOT EXISTS` per task+tanggal) — rencana yang sudah direalisasi tetap dipertahankan sebagai histori. Tidak ada endpoint reopen (YAGNI).
- **Test otomatis**: `server/tests/tasks.test.ts` bertambah dari 8 ke 13 test (otorisasi, 404/409, rencana belum-direalisasi terhapus vs yang sudah-direalisasi tetap ada, task closed hilang dari daftar terbuka). Total 104 test lolos lintas file.
- **Frontend**: tombol "Tandai selesai" di tiap task pada kartu "Kerjaan tambahan" dan "Rencana" (`InputHarianView.vue`), satu Dialog dipakai ulang untuk task mana pun yang diklik, textarea polos (bukan `MiniMarkdownEditor`, sesuai arahan user) buat deskripsi penutupan opsional. `useCloseTask()` (baru, `composables/useTasks.ts`) invalidate query daftar task dan query harian sekaligus (menutup task bisa mengubah `rencanaHariIni`).
- **Diverifikasi end-to-end** lewat Playwright (akun uji sementara, dihapus setelah selesai): task dengan rencana hari ini → klik "Tandai selesai" → isi deskripsi opsional → konfirmasi → toast sukses → task hilang dari kartu "Rencana" (rencana yang belum direalisasi ikut terhapus, sesuai desain).
- Perubahan tampilan dari review user: tombol teks "Tandai selesai" diganti jadi icon-only (`CircleCheck`, `Button` size `icon-sm`) dibungkus `Tooltip` (baru dipakai pertama kali di app ini) supaya lebih minimalis. Dibungkus `<div class="flex items-center gap-1">` yang sengaja disiapkan buat nampung tombol icon attachment di sebelahnya nanti (Stage 5, lihat memori proyek) — bukan cuma satu tombol lepas. Diverifikasi lewat Playwright: hover tombol memunculkan tooltip "Tandai selesai".
