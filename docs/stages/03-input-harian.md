# Stage 03 — Input harian inti

- Status: Selesai — backend dan UI checklist realisasi/kerjaan tambahan/rencana hari ini selesai, teruji, dan diverifikasi visual di browser (mobile/laptop, light/dark).
- Prasyarat: Stage 2 termasuk kalender kerja tahunan; aturan tanggal pada Q-01.
- Keputusan: [ADR-0006](../adr/0006-hari-kerja.md), [ADR-0007](../adr/0007-tanggal-realisasi.md), [ADR-0010](../adr/0010-task-tanpa-pemilik.md), [ADR-0011](../adr/0011-kolaborasi-task.md), [ADR-0018](../adr/0018-tanpa-approval.md), [ADR-0021](../adr/0021-komponen-ui.md), [ADR-0022](../adr/0022-arah-visual.md), [ADR-0023](../adr/0023-mobile-first.md), [ADR-0024](../adr/0024-tema.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0026](../adr/0026-kalender-kerja-tahunan.md), [ADR-0041](../adr/0041-identitas-item-task-log.md).

## Cakupan

- Tampilkan rencana user aktif pada hari kerja sebelumnya sebagai checklist realisasi; centang memerlukan catatan hasil.
- Sediakan kerjaan tambahan dengan task baru atau task open; buat realisasi is_extra=true.
- Pertahankan section realisasi saat kosong dengan CTA Tambah kerjaan kemarin (manual).
- Rencana tanggal laporan bersifat opsional, diisi manual, dan boleh memakai task open yang sama.
- Simpan seluruh submit dalam transaksi; bentuk identitas data yang memungkinkan edit tanpa log ganda pada Stage 4.
- Tampilkan aksi eksplisit yang nyaman disentuh pada light/dark mode; tanpa workflow approval.

## Kriteria selesai dan pemeriksaan

- [x] Simulasi beberapa hari berhasil: rencana → realisasi sebagian → tambahan → rencana baru. Teruji di backend (lihat bukti) dan diverifikasi ulang lewat alur simpan sungguhan di browser.
- [x] Item tidak dicentang tidak menghasilkan realisasi atau penutupan; tidak perlu alasan dan tidak auto-carry ke rencana baru.
- [x] Catatan realisasi kosong ditolak; kegagalan salah satu bagian tidak menyisakan simpan parsial.
- [x] Cold start menghasilkan realisasi manual bertanggal pekerjaan dan is_extra=true.
- [x] Dua user dapat mencatat realisasi pada task dan tanggal yang sama; catatan tetap terpisah.
- [x] Checklist melewati seluruh tanggal libur yang tercatat, bukan hanya akhir pekan; pergantian tahun menggunakan kalender tahun sebelumnya.

## Dependensi terbuka

Q-01 (aturan kalender detail). Identitas item/submit pada Q-05 sudah cukup untuk Stage 3 ([ADR-0041](../adr/0041-identitas-item-task-log.md)); sisanya (edit/koreksi) menyusul Stage 4. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

**Backend:**

- `server/src/kalender.ts` — `todayJakarta()`, `isWorkday()`, `previousWorkday()` berbasis aturan Senin-Jumat dikurangi tabel `holidays`; parsing tanggal manual (`split("-")` + `Date.UTC`) untuk menghindari bug timezone dari `new Date(string)`. Diuji `server/tests/kalender.test.ts` (8 test): akhir pekan, hari libur beruntun, dan pergantian tahun.
- `server/src/routes/tasks.ts` — `handleListTasks`/`handleCreateTask`, keduanya digerbang `isActiveProjectMember` (lihat [Stage 2](02-user-project.md)). Diuji `server/tests/tasks.test.ts`: tanpa login, tanpa `projectId`, bukan anggota aktif, task baru muncul di daftar.
- `server/src/routes/task-logs.ts` — `handleGetTodayInput` (GET) dan `handleSaveTodayInput` (POST), memakai `upsertTaskLog` (satu baris per `user_id, task_id, tanggal, jenis`, sesuai [ADR-0041](../adr/0041-identitas-item-task-log.md)). Validasi seluruh item (catatan wajib untuk realisasi, keanggotaan project) dijalankan sebelum tulis apa pun; penulisan dibungkus `db.transaction(...)` agar gagal sebagian tidak menyisakan simpan parsial. Realisasi disimpan bertanggal hari kerja sebelumnya, rencana bertanggal hari ini.
- Kedua handler menerima parameter opsional `tanggalOverride` (dipakai hanya oleh test) agar "hari ini" bisa disimulasikan tanpa bergantung jam sistem; route asli di `server/src/index.ts` tetap memanggil tanpa argumen ini.
- `server/tests/task-logs.test.ts` — simulasi 3 hari kerja nyata (Kamis `2026-10-08`, Jumat `2026-10-09`, Senin `2026-10-12` yang melompati akhir pekan): cold start checklist kosong, catatan kosong ditolak, kegagalan satu item membatalkan seluruh submit, kerjaan tambahan (`is_extra=true`) di cold start, checklist terisi dari rencana hari sebelumnya, realisasi sebagian (task yang tidak dicentang tidak menghasilkan baris), submit ulang meng-update bukan menggandakan baris, dan dua user mencatat realisasi pada task+tanggal yang sama dengan catatan tetap terpisah ([ADR-0011](../adr/0011-kolaborasi-task.md)).
- Total suite: `bun test` 69 pass / 0 fail (7 file); `bunx tsc --noEmit` bersih.

**Frontend:**

- `frontend/src/views/InputHarianView.vue` — tiga section (Checklist realisasi, Kerjaan tambahan, Rencana hari ini) memakai `useTodayInputQuery`/`useSaveTodayInput` (`frontend/src/composables/useTaskLogs.ts`). Checklist dicentang lokal via `checklistDrafts` (di-hydrate ulang dari data server tiap kali query berubah); kerjaan tambahan dan rencana hari ini dikumpulkan sebagai draft lokal lalu dikirim sebagai satu payload `items[]` saat "Simpan" — cocok dengan simpan atomik di backend.
- `frontend/src/components/input-harian/TaskPickerForm.vue` — komponen dipakai ulang untuk kerjaan tambahan (catatan wajib) dan rencana hari ini (catatan opsional); pilih project aktif lalu pilih task terbuka atau ketik task baru.
- Section checklist menampilkan pesan kosong + CTA "Tambah kerjaan kemarin (manual)" setiap kali checklist kosong (bukan hanya saat cold start penuh), sesuai cakupan; tombol Simpan pakai `AlertDialog` konfirmasi berisi ringkasan jumlah item sebelum commit.
- Verifikasi visual nyata via Playwright (login sungguhan sebagai user tenaga ahli, bukan fixture): alur cold start → isi kerjaan tambahan + rencana hari ini → konfirmasi → simpan → toast sukses → data ter-refresh dan tampil sebagai entri tersimpan, dicek di viewport laptop (1280×900) dan mobile (390×844), tema light dan dark.
- Bug ditemukan dan diperbaiki saat verifikasi: tombol "Simpan" yang semula `sticky bottom-4` menimpa form "Rencana hari ini" ketika total konten lebih pendek dari viewport — diganti jadi elemen statis di akhir halaman dengan border pemisah. Section "Checklist realisasi" juga sebelumnya kosong tanpa pesan apa pun ketika checklist kosong tapi kerjaan tambahan sudah terisi (kondisi `isColdStart` yang mensyaratkan keduanya kosong sekaligus) — disederhanakan jadi `checklistEmpty` agar pesan+CTA selalu tampil setiap checklist kosong.
- Data uji yang sempat tersimpan ke database dev selama verifikasi dihapus kembali setelah selesai; tidak ada perubahan pada akun pengguna sungguhan.
- Bug label ditemukan lewat review manual user: field/section sempat dinamai "rencana besok" (di kode maupun UI), padahal menurut [ADR-0007](../adr/0007-tanggal-realisasi.md) rencana yang diisi hari ini bertanggal hari ini juga (tanggal laporan), bukan besok — satu submit sah menyimpan realisasi kemarin dan rencana hari ini sekaligus. Backend sudah benar secara data (tanggal rencana = `tanggal`, bukan besok); yang salah cuma penamaan. Diganti jadi `rencanaHariIni` di seluruh lapisan (respons API, tipe frontend, judul section "Rencana hari ini").
