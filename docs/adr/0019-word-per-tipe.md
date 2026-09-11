# ADR-0019: Ekspor Word menurut tipe programmer

- Status: diterima; direvisi 2026-09-11 (tiga kali, semua hari yang sama). (1) PDF penuh jadi jalur utama, Word ditunda. (2) Setelah dicoba, PDF pdf-lib kerasa terlalu plain dan tidak bisa diedit manual — balik ke Word lewat mail-merge ke template `.docx` milik masing-masing tenaga ahli sendiri (bukan admin per jabatan, bukan generate dari nol). (3) **FINAL, lihat bagian paling akhir "Hapus Jabatan/Kontrak/PPK/Ruang Lingkup/Pendahuluan"**: dipakai nyata beberapa putaran, ternyata Cover/Pendahuluan/Ruang Lingkup cukup statis di template — seluruh mesin itu dihapus, tersisa cuma Template Word (upload sendiri) + Saran & Rekomendasi (opsional, tanpa label BAB).
- Tanggal: 2026-09-05.
- Stage utama: [07](../stages/07-ekspor-word.md).

## Konteks

Keputusan bisnis 19: pengguna menyatakan template menyusul dan berbeda per tipe programmer; mempertahankan usulan satu orang per bulan.

## Keputusan

Ekspor menghasilkan dokumen Word per tenaga ahli per bulan, menggunakan template sesuai tipe programmer. Rekap tanggal, narasi realisasi, izin, dan attachment mengikuti template asli.

## Konsekuensi

Template belum tersedia. Jangan menganggap semua tipe menggunakan satu layout atau placeholder identik. Klasifikasi programmer, pemetaan template, dan kebijakan perubahan tipe perlu diputuskan setelah contoh diterima; lihat Q-06. Tidak membangun editor template generik.

## Implementasi awal (PDF generik)

Selesai 2026-09-08. Sebelum template Word asli tersedia, dibangun cicilan awal berupa ekspor **PDF generik satu layout** (bukan per tipe programmer) — tujuannya validasi data laporan (task, tanggal, catatan, lampiran, status, kalender kerja), bukan hasil akhir. Keputusan:

- Cakupan akses: diri sendiri saja (generate laporan bulanan milik sendiri), sama seperti Riwayat. Akses admin/atasan generate laporan orang lain belum dibangun.
- Isi laporan mengikuti 3 contoh dokumen nyata yang dikirim user (bukan tebakan): timesheet Gantt (task × tanggal, warna merah=libur/kuning=izin/abu=ada realisasi), tabel "Aktifitas Pekerjaan/Kegiatan" (satu baris per log realisasi, kolom Status dari `tasks.status`), dan lampiran hasil kerja (gambar + caption bernomor).
- Rencana tidak ikut jadi baris tabel aktifitas — laporan ini murni "hasil pekerjaan" yang sudah dikerjakan. Kendala tidak ditampilkan — tidak ada di contoh dokumen.
- `pdf-lib` dipakai murni (bukan render HTML-ke-PDF) karena tabel/warna kustom dan embed gambar JPG/PNG langsung dari file attachment yang sudah ada — tanpa dependency headless-browser tambahan.
- Font standar `pdf-lib` (WinAnsi/CP1252) tidak bisa encode glyph checkbox Unicode (☐/☑), ditemukan lewat error runtime saat verifikasi. Awalnya diganti ASCII `[ ]`/`[x]`, lalu disederhanakan lagi (2026-09-08) jadi bullet "•" biasa buat checklist maupun bullet — status tercentang/belum tidak berarti apa-apa di dokumen cetak yang tidak interaktif, beda dari tampilan UI (`MiniMarkdownText.vue`) yang tetap pakai `<input type="checkbox">` sungguhan.
- Layout Word asli per tipe programmer (inti ADR ini) masih menunggu template dan Q-06 — PDF generik ini tidak menggantikannya.

## Halaman Laporan tersendiri + pratinjau sebelum cetak

Selesai 2026-09-08 (permintaan user sehari sebelumnya, langsung dikerjakan). Ekspor PDF generik pindah dari widget kecil di Riwayat jadi **halaman sendiri** (`/laporan`, nav item baru di sidebar), default menampilkan bulan berjalan. Widget lama di Riwayat (Popover bulan-terbaru + grid bulan/tahun) **dipindah seluruhnya** ke sini — Riwayat kembali fokus ke heatmap+daftar Realisasi saja.

- Sebelum tombol unduh PDF, ada tombol **"Tampilkan"** yang menampilkan pratinjau di layar — tabel mirip "Aktifitas Pekerjaan" (No, Tanggal, Aplikasi/Modul, Kegiatan, Catatan, Status, Lampiran), diambil dari `GET /api/reports/monthly-preview?bulan=` (endpoint baru, berbagi fungsi agregasi data (`aggregateMonthlyReport`) yang sama dengan endpoint PDF — cuma beda cara menyajikan hasilnya, bukan query terpisah). Catatan dikirim RAW (markdown asli) supaya bisa dirender pakai `MiniMarkdownText.vue` yang sudah ada di UI (reuse, bukan versi teks-polos ala PDF).
- **Callout "N hari kerja belum ada realisasi"** muncul kalau ada hari kerja (`isWorkday`) di bulan itu yang bukan izin dan belum ada realisasi — dibatasi sampai hari ini (`todayJakarta()`) supaya tanggal di masa depan yang belum waktunya tidak ikut ditandai kosong. Ini yang memenuhi tujuan awal: user bisa mengecek dulu ada tidaknya tanggal kosong sebelum mencetak, bukan baru ketahuan setelah PDF jadi.
- Tombol "Unduh laporan (PDF)" tetap selalu aktif (tidak digembok di belakang "Tampilkan") — pratinjau itu bantuan opsional, bukan gate wajib.
- Popover pemilih bulan di halaman baru ini pakai ulang persis pola yang sudah diperbaiki di widget Riwayat sebelumnya (satu `Popover` dua tampilan internal, bukan `DropdownMenu`+`Popover` terpisah — lihat catatan bug focus-race di `docs/stages/07-ekspor-word.md`) — dipindah, bukan ditulis ulang dari nol.

## Pratinjau jadi dua tab: Daftar + Timesheet

Selesai 2026-09-08 (permintaan user langsung setelah halaman Laporan di atas jadi). Pratinjau sebelum cetak dipecah jadi dua `Tabs` (shadcn-vue) — bukan cuma tabel "Aktifitas Pekerjaan" tapi juga rendering layar dari timesheet Gantt (task × tanggal) yang sebelumnya cuma ada di dalam PDF.

- Backend: `handleMonthlyReportPreview` menambah field `timesheet` di response — `tasks`/`hari` dipakai apa adanya dari `aggregateMonthlyReport`, `taskDatesWorked` dikonversi dari `Map<number, Set<string>>` (tidak bisa di-JSON) jadi `Record<string, string[]>` keyed by `taskId` sebagai string. Tidak ada query baru — data yang sama persis dengan yang dipakai `buildMonthlyReportPdf`.
- Frontend: `TimesheetPreview.vue` (baru, `components/reports/`) me-render grid CSS (bukan `<table>`, kolom hari bisa sampai 31) dengan warna cell yang SENGAJA disamakan persis dengan `drawTimesheetPages` di `report-pdf.ts` — merah=libur, kuning=izin, abu=ada realisasi, transparan=kosong — supaya pratinjau layar dan hasil PDF tidak pernah kelihatan beda.
- Kedua tab (Daftar dan Timesheet) dibungkus `ScrollArea` (shadcn-vue) horizontal, bukan `overflow-x-auto` polos — tabel Daftar pun ikut dibenahi jadi `ScrollArea` di turn ini (awalnya masih `overflow-x-auto` bawaan browser, kelihatan jelek/scrollbar-nya beda gaya dari komponen lain). Root `ScrollArea` butuh class `w-full min-w-0` supaya tidak melebarkan grid/flex parent-nya — bug yang sama seperti yang sudah ditemukan sebelumnya di `ActivityHeatmap.vue`, dipakai ulang polanya di sini.
- Kolom Catatan di tab Daftar sempat masih menampilkan checkbox interaktif asli (`MiniMarkdownText.vue` dipakai apa adanya, ketahuan dari screenshot user) — padahal pratinjau ini merepresentasikan PDF, yang checklist-nya sudah disederhanakan jadi bullet polos (lihat "Implementasi awal" di atas). Diperbaiki dengan konversi teks `- [ ]`/`- [x]` jadi `- ` biasa sebelum dikirim ke `MiniMarkdownText` (`catatanUntukPratinjau` di `LaporanView.vue`) — bukan mengubah `MiniMarkdownText.vue` sendiri, karena Input Harian/Riwayat tetap butuh checkbox interaktif di situ.

## PDF penuh menggantikan Word untuk sementara

Diputuskan 2026-09-11. Merevisi keputusan awal ADR ini (ekspor Word per tipe programmer) — bukan dibatalkan, ditunda: pembuatan template Word dinilai lambat, rawan pagination/cross-halaman yang sulit dikontrol, dan menyulitkan revisi tiap kali ada bagian yang belum sesuai. Untuk sekarang, seluruh dokumen laporan (bukan cuma timesheet + tabel aktifitas + lampiran yang sudah ada) dibangun sebagai **PDF penuh satu layout per tipe jabatan** memakai `pdf-lib` (perluasan langsung dari `report-pdf.ts`, bukan dependency baru) — Word ditunda sampai ada alasan kuat untuk kembali ke situ.

Struktur diambil dari contoh nyata dokumen tipe "Programmer" (`data/attachments/202601 - Wibowo Sulistiyo.pdf`, 24 halaman, BAB I-VI):

| Bagian | Sifat |
| --- | --- |
| Cover | statis; field: bulan+tahun laporan, sub kegiatan, paket pekerjaan, jabatan tenaga ahli, nama tenaga ahli |
| Daftar Isi | statis, selalu sama |
| BAB I Pendahuluan (termasuk Nama Kegiatan) | input, supaya gampang diubah kalau ada revisi redaksional |
| BAB II Ruang Lingkup | **berbeda per jabatan tenaga ahli** — bukan satu isi untuk semua tipe programmer |
| BAB III Waktu Pelaksanaan, BAB IV Hasil Pekerjaan (tabel aktifitas + lampiran) | sudah ada dari cicilan awal (lihat "Implementasi awal" di atas); kolom Tindak Lanjut/Solusi diambil dari field `catatan` freetext realisasi harian apa adanya, bukan template auto-generate |
| BAB V Saran dan Rekomendasi | input wajib per bulan, **menggembok tombol unduh** sampai diisi |
| BAB VI Penutup | statis, selalu sama |

Konsekuensi: butuh field skema baru untuk Pendahuluan/Nama Kegiatan (per bulan atau default+override), Ruang Lingkup (kemungkinan per jabatan/role, bukan per bulan), dan Saran & Rekomendasi (wajib per bulan, dicek sebelum endpoint unduh PDF mau jalan). Q-06 masih terbuka untuk tipe jabatan selain Programmer — jangan menebak isi Ruang Lingkup jabatan lain sebelum ada contoh nyata.

Isi/struktur BAB di atas dianggap tidak spesifik-format: kalau suatu saat ekspor Word diaktifkan lagi, konten dan field inputnya tetap sama persis seperti di atas — cuma cara render (`pdf-lib` vs templating Word) yang beda. Jadi field skema dan input yang dibangun sekarang untuk PDF tidak perlu dibongkar ulang kalau nanti pindah ke Word.

### Model konten rinci per BAB (tipe Programmer)

**Konsep baru: Jabatan dan Kontrak.** `role` yang sudah ada (`tenaga_ahli`/`supervisi`/`atasan`/`admin`, [ADR-0033](0033-rangkap-peran.md)) itu soal hak akses aplikasi, bukan "jabatan" tenaga ahli untuk keperluan laporan (Programmer, System Administrator, dst — jenisnya diatur regulasi/Kepgub, bukan bebas ditentukan aplikasi). Jabatan juga tidak melekat tetap ke user — bisa beda per **kontrak** (penugasan), dan satu paket kontrak membawa sekumpulan data resmi yang berubah bareng, bukan field lepas-lepas:

- **`jabatan`** (master, dikelola admin): `id`, `nama`.
- **`kontrak`** (dikelola admin, satu user bisa punya banyak baris riwayat): `id`, `user_id`, `jabatan_id`, `sub_kegiatan`, `paket_pekerjaan`, `nama_kegiatan` (daftar key-value stabil — K/L/D/I, Satker/SKPD, dst, **tidak termasuk PPK**, lihat di bawah — jumlah baris fleksibel), `mulai` (tanggal), `berakhir` (tanggal, nullable = masih aktif).
- **PPK dipisah dari kontrak**, karena pejabatnya bisa mutasi di tengah masa kontrak berjalan — kalau ikut dikunci ke kontrak, ganti PPK jadi harus menutup dan bikin baris kontrak baru padahal kontrak sendiri belum tentu berubah. PPK juga **satu nilai bersama untuk semua tenaga ahli** (melekat ke instansi/Satker, bukan ke user atau kontrak individu): `ppk_saat_ini` (dikelola admin) — `id`, `nama`, `berlaku_sejak` (tanggal), riwayat multi-baris (bukan overwrite in place, supaya laporan bulan lama tetap tampil PPK yang berlaku waktu itu).
- Saat generate laporan bulan X: sistem pilih kontrak milik user itu yang rentang `mulai`..`berakhir`-nya mencakup bulan X (isi Cover: bulan+tahun, sub kegiatan, paket pekerjaan, jabatan+nama tenaga ahli, serta BAB I bagian C untuk K/L/D/I & Satker/SKPD), **dan terpisah** pilih baris `ppk_saat_ini` dengan `berlaku_sejak` terbaru yang `<=` bulan X (isi baris PPK di BAB I bagian C) — dua sumber digabung saat render, bukan diketik ulang manual tiap bulan.
- Ini juga jadi kunci default **BAB II Ruang Lingkup** (lewat `jabatan_id` di kontrak aktif bulan itu).

**BAB I Pendahuluan** — hanya narasi (bukan lagi termasuk Nama Kegiatan, lihat Kontrak di atas), disimpan per (user, bulan laporan), **prefill dari bulan sebelumnya** saat pertama dibuka (bukan kosong), **tidak menggembok** tombol unduh (beda dari BAB V) karena wajarnya jarang berubah:
- Deskripsi pembuka — 3 paragraf freetext.
- A. Maksud dan Tujuan — label section statis, isi freetext.
- B. Sasaran — label section statis, isi freetext.
- C. Nama Kegiatan — label section statis, isinya gabungan **kontrak aktif** (K/L/D/I, Satker/SKPD, dst) **+ `ppk_saat_ini`** yang berlaku bulan itu (lihat di atas), bukan diketik ulang tiap bulan.
- Label ketiga section (A/B/C) sendiri selalu tetap 3 itu — dikonfirmasi user, tidak perlu dibuat dinamis.

**BAB II Ruang Lingkup** — di-key oleh `jabatan_id` (dari kontrak aktif), model **default + override**:
- Deskripsi singkat — 1 paragraf freetext.
- Bullet list bernomor — daftar string, jumlah item fleksibel.
- **Default per jabatan** (`ruang_lingkup_jabatan`, keyed `jabatan_id`) — diedit **admin**, berubah untuk **semua** tenaga ahli jabatan itu yang belum punya override sendiri.
- **Override per user** (`ruang_lingkup_override`, keyed `user_id`, opsional) — diedit **tenaga ahli sendiri**, cuma berlaku ke laporan dia sendiri; salah edit tidak mengganggu tenaga ahli lain dengan jabatan yang sama.
- Render laporan: pakai override user kalau ada, kalau tidak fallback ke default jabatan.

**BAB V Saran dan Rekomendasi** — per user per bulan, **wajib diisi sebelum tombol unduh aktif** (gate), format sederhana: daftar bullet freetext saja (tidak ada sub-struktur key-value seperti Nama Kegiatan).

**BAB VI Penutup** — statis penuh termasuk blok tanda tangan (jabatan+nama dari kontrak aktif, tanggal dari bulan laporan).

Konsekuensi tambahan: entitas `jabatan` dan `kontrak` beririsan dengan Stage 02 (manajemen user/project oleh admin) — CRUD-nya wajar ditaruh di halaman admin yang sama, bukan halaman Laporan. Perlu pemeriksaan "kontrak aktif tidak ditemukan untuk bulan ini" saat generate laporan — **bukan diblokir**, tenaga ahli mengisi sendiri (pola sama seperti usulan project "Lainnya", ADR-0042), lihat [ADR-0046 bagian "Self-fill saat data belum ada"](0046-skema-fisik-laporan-template.md#self-fill-saat-data-belum-ada-2026-09-11) untuk detail skema (`kontrak.perlu_review`) dan pembagian hak tulis admin vs tenaga ahli.

## Backend CRUD + laporan PDF lengkap BAB I-VI diimplementasikan

Selesai 2026-09-11 (backend saja — belum ada UI frontend). Endpoint CRUD untuk seluruh entitas di atas: `server/src/routes/jabatan.ts`, `kontrak.ts` (termasuk `getKontrakAktif`, validasi rentang bentrok, pembagian hak edit admin/self-fill), `ppk.ts` (termasuk `getPpkAktif`), `ruang-lingkup.ts` (termasuk `getRuangLingkupUntukLaporan` — default+override), `pendahuluan.ts` (termasuk `getPendahuluanUntukLaporan` — carry-forward), `saran.ts` (termasuk `isSaranTerisi`+`getSaranLines` — gate). Semua di-wire ke `server/src/index.ts`; 55 test baru/disesuaikan total (file baru `server/tests/{jabatan,kontrak,ppk,ruang-lingkup,pendahuluan,saran}.test.ts` + penyesuaian `reports.test.ts` untuk gate kontrak/saran).

`GET /api/reports/monthly` (`server/src/routes/reports.ts`) diperluas memakai seluruh helper di atas: 409 kalau kontrak aktif tidak ada, 409 kalau Saran & Rekomendasi bulan itu belum diisi (dua-duanya sebelum PDF mulai dibangun, bukan menghasilkan PDF rusak). `server/src/report-pdf.ts` (`buildMonthlyReportPdf`) diperluas menggambar seluruh BAB sesuai urutan contoh asli: Cover → Daftar Isi (statis) → BAB I Pendahuluan (3 paragraf + Maksud&Tujuan + Sasaran + Nama Kegiatan berlabel a)/b)/c)) → BAB II Ruang Lingkup (deskripsi + daftar bernomor 1)/2)/dst) → BAB III/IV (timesheet+aktivitas+lampiran, sudah ada) → BAB V Saran (daftar bernomor 1./2./dst) → BAB VI Penutup (statis + tanda tangan). Diverifikasi lewat PDF sampel dirender ke gambar (`pdftoppm`, poppler) dan diperiksa manual tiap halaman — bukan cuma cek page count.

**UI frontend** — selesai 2026-09-11 (lihat juga bagian berikut soal perubahan target ekspor jadi Word): `frontend/src/views/admin/AdminJabatanView.vue` (CRUD jabatan + dialog Ruang Lingkup default + seksi PPK), `AdminKontrakView.vue` (CRUD kontrak admin + tombol "Tandai direview"), keduanya di-routing `/admin/jabatan` dan `/admin/kontrak` plus entri sidebar baru. `frontend/src/components/reports/DetailLaporanPanel.vue` (baru, dipasang sebagai tab "Detail Laporan" di `LaporanView.vue` berdampingan Daftar/Timesheet) — self-fill Kontrak (termasuk tambah jabatan baru inline), Ruang Lingkup override milik sendiri (dengan pratinjau default jabatan kalau belum override), Pendahuluan, dan Saran. Diverifikasi lewat Playwright nyata terhadap dev server (bukan cuma typecheck): login, isi kontrak self-fill, lihat gate tombol unduh berubah reaktif.

Masih terbuka: contoh Ruang Lingkup untuk jabatan selain Programmer (Q-06).

## Word via template mail-merge milik tenaga ahli sendiri (final, 2026-09-11)

Setelah PDF penuh (bagian di atas) dicoba, terasa terlalu plain (tidak mirip dokumen asli — tidak ada letterhead/kop surat, justifikasi, dsb) dan tidak bisa diedit manual setelah di-generate. Sempat dipertimbangkan membongkar seluruh mesin Jabatan/Kontrak/PPK/Ruang Lingkup karena isi Cover/Pendahuluan/Ruang Lingkup/Penutup ternyata cukup ditulis statis di dalam file Word oleh pemiliknya sendiri — tapi diputuskan **tidak dibongkar** ("sayang kalau dihapus"), cukup **ditambah** kemampuan upload template.

**Keputusan final**: setiap tenaga ahli upload file `.docx` miliknya sendiri (bukan admin, bukan per-jabatan, bukan satu template global) lewat tab "Detail Laporan". Aplikasi mail-merge cuma bagian yang jelas berubah tiap bulan ke placeholder di template itu:

| Placeholder | Isi | Sumber |
| --- | --- | --- |
| `{TA}` | Tahun (mis. "2026") | dari parameter bulan |
| `{BULAN}` | Label bulan (mis. "Maret 2026") | agregasi laporan yang sudah ada |
| `{NAMA_TENAGA_AHLI}` | Nama user | profil user |
| `{JABATAN_TENAGA_AHLI}` | Nama jabatan | `getKontrakAktif` + join `jabatan` (infrastruktur Stage 7 sebelumnya dipakai lagi di sini) |
| `{DATE_END}` | Tanggal akhir bulan | dihitung dari bulan |
| `{%TIMESHEET}` | Tabel Gantt task×hari, warna sama seperti PDF | raw XML `<w:tbl>` dibangun manual |
| `{%AKTIVITAS}` | Tabel Aktifitas Pekerjaan | raw XML `<w:tbl>` dibangun manual |
| `{%LAMPIRAN_PEKERJAAN}` | Gambar lampiran + caption bernomor | raw XML `<w:drawing>` + embed manual ke ZIP docx |
| `{%SARAN _REKOMENDASI}` (perhatikan spasi — persis begitu di template asli) | Daftar bernomor dari `saran_bulanan` | `getSaranLines` (sudah ada) |

Cover/Pendahuluan/Ruang Lingkup/Penutup **tidak** di-generate aplikasi — sudah statis di dalam file template masing-masing orang. Konsekuensinya, `ruang_lingkup_*`/`pendahuluan_bulanan` yang sudah dibangun **tidak dipakai** oleh jalur Word ini (dibiarkan ada, bukan dihapus, kalau-kalau dibutuhkan lagi nanti) — cuma `jabatan`/`kontrak` (untuk `{JABATAN_TENAGA_AHLI}`) dan `saran_bulanan` yang benar-benar terpakai.

**Kenapa prefix `%` bisa dipakai apa adanya** (template TIDAK perlu diedit user): docxtemplater (dipilih murni karena tersedia gratis & bisa raw-XML insertion tanpa modul berbayar) sudah punya modul bawaan `RawXmlModule` (prefix default `@`) yang menggantikan SATU PARAGRAF UTUH dengan XML mentah dari data — pas untuk "satu placeholder jadi satu tabel/gambar penuh". Dibuktikan lewat percobaan nyata (bukan cuma baca dokumentasi) bahwa membuat instance kedua modul yang sama dengan `prefix` di-set ke `"%"` (tinggal ganti properti, modul intinya generik) bekerja tanpa konflik — dipasang di `modules: [...]` saat construct `Docxtemplater`. Gambar di-embed manual (tambah `word/media/imageN.*`, relationship di `word/_rels/document.xml.rels`, pastikan `[Content_Types].xml` kenal ekstensinya) — bukan pakai package image-module terpisah, supaya tidak konflik prefix `%` dengan tag lain.

**Entitas baru**: `laporan_template` (`docs/schema/0006_laporan_template_word.sql`) — `user_id` (PK), `file_path`, `nama_asli`, `uploaded_at`. Satu baris per user, upload ulang menimpa (bukan riwayat). File disimpan di `data/laporan-template/<userId>.docx` (`server/src/storage.ts`).

**Backend**: `server/src/report-docx.ts` (baru) — `buildMonthlyReportDocx`, murni fungsi build docx dari template bytes + data (pola sama `report-pdf.ts`, tanpa akses DB). `server/src/routes/laporan-template.ts` — upload (validasi ekstensi `.docx` + sniff signature ZIP)/get-mine/delete, semua self-service (bukan admin). `handleMonthlyReportWord` di `reports.ts` (`GET /api/reports/monthly-word?bulan=`) — 409 kalau belum upload template (bukan diblokir permanen, tinggal upload), TIDAK ada gate kontrak/saran seperti PDF (field itu di sini cuma salah satu dari banyak placeholder, bukan penentu seluruh Cover). PDF (`GET /api/reports/monthly`) masih ada di backend, tidak dihapus, tapi **tidak lagi ditampilkan di UI** (fokus ke Word).

**Verifikasi**: 235 test backend lolos (13 baru — `laporan-template.test.ts` + tambahan di `reports.test.ts`, pakai docx minimal buatan sendiri via `pizzip`, BUKAN file pribadi user). Lebih penting: end-to-end nyata dengan template asli pengguna (`data/attachments/Template-2026.docx`, 2.4MB, ada letterhead/logo) — di-merge dengan data uji lalu **dikonversi ke PDF pakai LibreOffice (`soffice --headless --convert-to pdf`)** dan dirender ke gambar (`pdftoppm`) buat diperiksa manual tiap halaman: cover dengan logo+tahun+nama benar, tabel timesheet dengan warna benar, tabel aktifitas, gambar lampiran (pakai file asli dari `data/attachments/`) dengan caption benar, saran, dan penutup dengan tanda tangan — hasilnya identik strukturnya dengan contoh dokumen asli yang jadi rujukan sejak awal sesi ini. Juga diverifikasi lewat Playwright terhadap dev server sungguhan: upload template asli lewat UI, badge peringatan di tab "Detail Laporan" hilang otomatis, tombol unduh berubah dari disabled+tooltip jadi aktif secara reaktif.

**Belum dikerjakan**: dukungan tipe file selain `.docx`, preview isi template sebelum upload, riwayat template lama (sengaja YAGNI — upload ulang menimpa).

## Hapus Jabatan/Kontrak/PPK/Ruang Lingkup/Pendahuluan — dipakai nyata, ternyata tidak terpakai (2026-09-11, hari yang sama)

Setelah dipakai beberapa putaran (upload template asli, isi data uji, unduh berulang untuk cek kapitalisasi/font/pagination timesheet), pengguna menyimpulkan seluruh mesin Kontrak (+Jabatan+PPK) dan BAB I Pendahuluan/BAB II Ruang Lingkup **tidak pernah benar-benar terpakai** oleh jalur Word — persis seperti yang sempat disinggung di bagian sebelumnya ("Cover/Pendahuluan/Ruang Lingkup/Penutup sudah statis di template"), tinggal dieksekusi: dihapus semua, bukan dibiarkan menganggur.

**Dihapus** (kode + tabel database, bukan cuma berhenti dipakai):
- Tabel: `kontrak`, `jabatan`, `ppk_saat_ini`, `ruang_lingkup_jabatan`, `ruang_lingkup_override`, `pendahuluan_bulanan` — di-`DROP` lewat [`schema/0007_hapus_kontrak_ruang_lingkup_pendahuluan.sql`](../schema/0007_hapus_kontrak_ruang_lingkup_pendahuluan.sql) (migration baru, bukan edit migration lama yang sudah pernah jalan di data nyata — data kontrak asli milik user sempat ada isinya sebelum dihapus).
- Backend: `server/src/routes/{jabatan,kontrak,ppk,ruang-lingkup,pendahuluan}.ts` + test-nya dihapus. `report-pdf.ts` dan `handleMonthlyReportPdf` dikembalikan ke bentuk sederhana sebelum sesi ini (timesheet+aktifitas+lampiran saja, tanpa Cover/BAB I/II/V/VI) — PDF ini tetap ada sebagai endpoint (`GET /api/reports/monthly`) tapi **tidak dipakai UI sama sekali**, murni sisa dari cicilan awal Stage 7.
- `report-docx.ts`: `{JABATAN_TENAGA_AHLI}` berhenti di-mail-merge (sumbernya, `kontrak`, sudah tidak ada) — ditambah `nullGetter: () => ""` di opsi Docxtemplater supaya tag semacam itu yang masih ada di template lama dirender kosong, bukan error.
- Frontend: `AdminJabatanView.vue`, `AdminKontrakView.vue` (+ routing `/admin/jabatan`, `/admin/kontrak`, entri sidebar "Kelola jabatan"/"Kelola kontrak") dan composable terkait (`useJabatan`, `useKontrak`, `usePpk`, `useRuangLingkup`, `usePendahuluan`) dihapus. `DetailLaporanPanel.vue` disederhanakan jadi cuma 2 section: **Template Word** dan **Saran dan Rekomendasi** (label "BAB V"/nomor bab dihapus dari UI — bukan lagi kerangka BAB, cuma satu field opsional).

**Yang bertahan**: `saran_bulanan` + endpoint `saran.ts` (Saran & Rekomendasi tetap ada, opsional — kosong berarti bagian itu di laporan Word tampil "Tidak ada saran khusus bulan ini", BUKAN mengosongkan seluruh laporan). `laporan_template` (upload template sendiri) sama sekali tidak tersentuh perubahan ini.

**Why**: proyek Stage 7 ini dari awal memang berjalan iteratif dengan banyak percobaan nyata oleh pengguna sendiri (bukan cuma dibaca/di-review) — pola yang berulang tiap sesi ini adalah: coba dulu, baru ketahuan mana yang kepakai. Jangan berasumsi entitas yang sempat dibangun dengan effort besar (kontrak: self-fill, validasi rentang bentrok, dsb) otomatis "akan dipakai nanti" — kalau jalur nyata (Word mail-merge) ternyata tidak butuh, lebih baik dihapus daripada dipertahankan sebagai kode mati.

**How to apply**: kalau ke depan ada permintaan menambah field/entitas baru untuk laporan, JANGAN otomatis membangun sistem CRUD lengkap (form admin, self-fill, review workflow) sebelum dipastikan lewat pemakaian nyata bahwa field itu benar-benar perlu diisi otomatis oleh aplikasi — banyak hal yang kelihatannya perlu "dikelola sistem" ternyata cukup ditulis manual di template Word oleh pemiliknya sendiri.
