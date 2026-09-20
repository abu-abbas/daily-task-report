# ADR-0047: Realisasi terisi dari commit GitLab lewat token personal

- Status: diterima; rincian implementasi dicatat di bawah.
- Tanggal: 2026-09-16.
- Stage utama: [05](../stages/05-kendala-attachment-riwayat.md) (pelengkap ADR-0039).
- Mendahului: [ADR-0039](0039-integrasi-commit-gitlab.md) — dikerjakan lebih dulu pakai token personal karena SSO ([ADR-0038](0038-sso-gitlab.md)) belum ada. ADR-0039 (commit-linking lewat token hasil SSO) **tidak dibatalkan**, cuma urutan pengerjaannya dimundurkan sampai ADR-0038 benar dikerjakan. ADR ini juga memperluas cakupan dari "murni bukti pendukung" jadi juga bisa prefill teks realisasi.
- Melengkapi: [ADR-0040](0040-import-project-gitlab.md) (`projects.gitlab_project_id` dipakai sebagai sumber prefill project, sekarang bisa di-assign user biasa juga, tidak cuma lewat import admin).

## Konteks

[ADR-0039](0039-integrasi-commit-gitlab.md) sudah memutuskan commit GitLab bisa ditautkan manual sebagai bukti pendukung, tapi bergantung pada token OAuth hasil SSO ([ADR-0038](0038-sso-gitlab.md)) yang belum dikerjakan dan scope-nya jauh lebih besar (mengganti alur login). Pengguna mengusulkan pendekatan lebih ringan: tiap developer tempel token GitLab miliknya sendiri, dipakai buat menarik commit dan sekalian mengisi draft realisasi — bukan cuma jadi lampiran bukti yang terpisah dari teks laporan.

## Keputusan

- **Token personal, bukan SSO**: ada halaman pengaturan/profil baru tempat tiap user menempelkan **Personal Access Token (PAT)** GitLab miliknya sendiri (scope `read_api` cukup). Fitur ini tidak lagi bergantung pada ADR-0038 — token berdiri sendiri, login password tetap seperti sekarang. Identitas pemilik token diverifikasi lewat `GET /api/v4/user` (mengembalikan `email`, dicocokkan ke `users.email` yang sedang login) — bukan sekadar dipercaya dari input user, sekaligus jadi filter penulis commit (`author_email`) tanpa user perlu isi username GitLab manual.
- **Tampil per tanggal realisasi, lazy load**: saat user mengisi/mengedit realisasi untuk tanggal tertentu, ada aksi eksplisit ("Tarik commit hari ini") yang baru memanggil GitLab API saat diklik — tidak di-prefetch untuk semua tanggal. Tidak ada batas jumlah commit; volume harian wajar jauh di bawah ratusan, jadi paginasi/limit artifisial di-skip (ponytail, [ADR-0025](0025-metode-ponytail.md)).
- **Pilih manual, jadi draft bukan auto-submit**: hasil tarikan ditampilkan sebagai daftar commit (pesan, waktu, repo asal). User memilih satu/lebih commit yang mau "dibawa" ke satu log realisasi; pesan commit terpilih dipakai sebagai **draft awal** teks catatan (masih bisa diedit sebelum disimpan) — bukan otomatis mengisi dan menyimpan diam-diam. Referensi commit yang dipilih tetap disimpan ke `task_log_commits` (struktur dari ADR-0039) sebagai bukti, terpisah dari teks yang sudah disalin ke `catatan`.
- **Sumber project via `gitlab_project_id`, tapi assignment dibuka untuk siapa saja**: kalau project di aplikasi sudah punya `gitlab_project_id` (dari import admin ADR-0040, atau dari langkah berikut), commit dari repo itu otomatis menyarankan project tersebut ke user saat memilih commit. Kalau belum ada tautan, **user biasa (bukan cuma admin) boleh assign sendiri** repo GitLab mana yang cocok dengan project yang sedang ia kerjakan, langsung dari alur pemilihan commit ini — memperluas ADR-0040 yang sebelumnya cuma lewat alur import admin.

## Konsekuensi

- Bukan pengganti permanen: fitur ini dikerjakan duluan pakai token personal supaya **tidak perlu menunggu** ADR-0038 (SSO). ADR-0039 (commit-linking lewat token hasil SSO) tetap berlaku sebagai rencana, cuma urutannya mundur ke belakang ADR-0038 — nanti diputuskan lagi saat ADR-0038 benar dikerjakan apakah PAT personal dipertahankan berdampingan atau digantikan token SSO.
- Kolom baru untuk menyimpan token personal per user (mis. `users.gitlab_pat`) — penyimpanan dan siapa yang boleh membaca/menghapusnya dirinci di bawah.
- `task_log_commits` (ADR-0039) tetap dipakai sebagai catatan referensi commit yang pernah ditarik, terlepas dari teksnya sudah disalin/diedit ke `catatan` atau belum.
- Assignment `gitlab_project_id` yang tadinya cuma lewat admin-import (ADR-0040) sekarang juga bisa terjadi lewat alur ini oleh anggota biasa — constraint unik yang sudah ada di ADR-0040 tetap berlaku (satu repo cuma boleh terikat satu project); kalau repo itu sudah ke-assign ke project lain, user diberi tahu, bukan menimpa diam-diam.
- Tetap **bukan approval**, sejalan [ADR-0018](0018-tanpa-approval.md) — menarik/memilih commit tidak mengubah status persetujuan apa pun.

## Rincian terbuka

- Penyimpanan token: plaintext di kolom DB (konsisten dengan trust boundary "internal self-hosted" ADR-0038) vs dienkripsi at-rest — belum ada preseden enkripsi reversibel di proyek ini (`password_hash` itu satu-arah, beda kasus), diputuskan saat implementasi Stage 5.
- Perilaku saat token invalid/dicabut/kedaluwarsa saat menarik commit (pesan error jelas vs retry) — dirinci saat implementasi.
- Cara enumerasi commit lintas repo yang bisa diakses token (mis. `GET /api/v4/projects?membership=true` lalu commit per repo, vs endpoint events/aktivitas GitLab) dipilih saat implementasi mengikuti API GitLab CE yang tersedia.
- Detail UI halaman pengaturan token (field di halaman profil user, bukan halaman admin) dirinci saat implementasi Stage 5.

## Revisi (2026-09-19): token instance bersama, hasil impor jadi task baru

Sebelum Stage 5 mulai dikerjakan, pengguna mengganti dua premis di atas. Bagian "Keputusan"/"Konsekuensi"/"Rincian terbuka" di atas **tidak dihapus** (jejak kenapa PAT-per-user awalnya dipilih), tapi digantikan poin-poin berikut untuk implementasi yang sebenarnya berjalan:

- **Token instance bersama, bukan PAT per user**: satu token GitLab (`GITLAB_SELFHOSTED_URL` + `GITLAB_SELFHOSTED_PRIVATE_TOKEN`) disimpan di `server/.env` (tidak dikomit, mengikuti pola env var lain — lihat `server/.env.example`), dipakai untuk semua user. Tidak ada lagi halaman pengaturan token per user, tidak ada kolom `users.gitlab_pat`, dan tidak ada lagi verifikasi identitas lewat `GET /api/v4/user` — token ini murni kredensial layanan, bukan representasi akun GitLab siapa pun. Ini menggugurkan seluruh poin pertama "Keputusan" di atas beserta rincian terbuka soal penyimpanan/enkripsi token dan UI halaman profil.
- **Token ini admin-level**: terbukti bisa `GET /api/v4/projects` tanpa parameter `membership`, mengembalikan semua project di instance GitLab CE ini — dipakai untuk enumerasi commit lintas repo (menjawab rincian terbuka soal cara enumerasi: list semua project dulu, lalu commit per project dalam rentang tanggal terpilih, tanpa perlu tahu repo mana milik siapa lebih dulu).
- **Filter "milik sendiri" tetap berlaku, tapi caranya beda**: karena token bukan lagi identitas user, penyaringan dilakukan aplikasi sendiri — `commit.author_email` dicocokkan (case-insensitive) ke `users.email` akun yang login. Kalau `users.email` kosong atau tidak ada commit yang cocok pada tanggal itu, hasilnya daftar kosong dengan pesan jelas, bukan error keras.
- **Pemicu tetap eksplisit & lazy**, sekarang lewat tombol "Impor commit GitLab" di alur "Tambah kerjaan" (kerjaan realisasi di luar rencana, Stage 3/`InputHarianView`) — tanggal commit yang ditarik ikut tanggal realisasi yang sedang diisi (hari kerja sebelumnya), bukan tanggal bebas.
- **Cakupan meluas lagi**: dari "draft awal teks ke satu log realisasi yang sudah dipilih user" jadi **otomatis membuat draft task baru**. Modal menampilkan commit hari itu sebagai checklist; tiap commit yang dicentang jadi satu draft "kerjaan tambahan" terpisah (satu task per commit) — baris pertama pesan commit jadi deskripsi task, sisanya jadi catatan realisasi (masih bisa diedit sebelum "Simpan" akhir), dan tag task diisi dari tipe conventional commit pada judul (`feat`, `fix`, `chore`, dst.) kalau polanya cocok, kosong kalau tidak. Nama project GitLab asal commit ditampilkan di tiap baris murni sebagai informasi (readable), **bukan** pemicu pemetaan otomatis — project tujuan task tetap dipilih manual oleh user sekali di modal (dropdown project yang sama seperti form manual), berlaku untuk semua commit yang dicentang dalam satu sesi impor. Ini berarti `projects.gitlab_project_id` (ADR-0040) belum perlu diimplementasikan supaya fitur ini bisa jalan.
- **Belum menyentuh `task_log_commits`**: draft dari commit picker ini lewat jalur draft "kerjaan tambahan" yang sudah ada (sama seperti isi manual TaskPickerForm) — task & task_log baru sungguhan tercipta bareng dalam satu transaksi saat "Simpan" akhir diklik, bukan saat commit dicentang di modal. Tabel referensi commit (`task_log_commits`, ADR-0039) tidak dipakai di alur ini; nyambungkan commit sebagai bukti terpisah ke log yang sudah ada tetap rencana ADR-0039 yang belum dikerjakan.

### Status token instance bersama: sementara, buat sampling (2026-09-19)

Setelah baris di atas diimplementasikan (`server/gitlab.ts`, `server/routes/gitlab.ts`, `GET /api/gitlab/commits`), pengguna mengonfirmasi token instance bersama di `server/.env` itu **cuma dipakai buat sampling/uji coba selagi fitur ini dibangun** — bukan pengganti permanen bagian pertama "Keputusan" di atas. Arah produksi tetap **token personal (PAT) per user disimpan di DB**, seperti keputusan awal ADR ini, lengkap dengan halaman pengaturan di profil dan rincian terbuka soal penyimpanan (plaintext vs terenkripsi) yang sempat ditandai gugur di bagian "Revisi" di atas — dihidupkan lagi sebagai kerjaan lanjutan, belum jadwal pasti.

Bagian lain di "Revisi (2026-09-19)" di atas (auto-create task per commit, project dipilih manual di modal, filter `author_email` == `users.email`) **tetap berlaku** terlepas dari sumber tokennya nanti instance-bersama atau per-user — cuma soal *dari mana* token itu dibaca (env var vs kolom DB per user) yang masih berubah. Satu detail direvisi: enumerasi project pakai `GET /api/v4/projects?membership=true`, bukan semua project di instance — token yang admin-level membuat daftar tanpa `membership` terlalu besar/berat buat di-scan tiap kali impor (dicoba manual oleh pengguna, terkonfirmasi `membership=true` sudah cukup karena commit yang relevan pasti di project yang dia jadi anggotanya).

### Implementasi token per-user (2026-09-19, hari yang sama)

Sesi kerja yang sama menyelesaikan arah produksi di atas sebelum sampling berakhir — jadi "instance bersama" di `server/.env` sekarang murni fallback, bukan jalur utama:

- **Kolom baru** `users.gitlab_username`, `users.gitlab_avatar_url`, `users.gitlab_private_token` ([migration 0008](../schema/0008_gitlab_kredensial_user.sql)). `gitlab_private_token` dibaca duluan di `resolveGitlabToken()` (`server/src/gitlab.ts`); fallback ke `GITLAB_SELFHOSTED_PRIVATE_TOKEN` di `.env` cuma dipakai kalau kolom user-nya masih kosong (transisi, bukan permanen).
- **`PUT /api/me/gitlab-token`** (`server/src/routes/gitlab.ts`): verifikasi dulu ke `GET /api/v4/user` pakai token yang dikirim user — kalau gagal terhubung/token invalid, **tidak ditulis ke DB sama sekali** (kolom lama tidak ketiban token yang ternyata salah). Kalau berhasil, dicocokkan `email` hasil `GET /api/v4/user` ke `users.email` akun yang login (identitas token, sesuai "Keputusan" awal ADR ini) — beda email ditolak. Username & avatar hasil verifikasi ikut disimpan (`gitlab_username`, `gitlab_avatar_url`) supaya user tidak perlu isi manual.
- **Token tidak pernah dikirim ke client**: `publicUser()` (`server/src/routes/auth.ts`) cuma expose `gitlabUsername`, `gitlabAvatarUrl`, `hasGitlabToken` (boolean) lewat `/api/me` — bukan nilai token-nya. Endpoint simpan token pun cuma membalas username/avatar hasil verifikasi, bukan echo token yang dikirim. Frontend (`GitlabCommitImportDialog.vue`) karena itu cuma bisa "isi ulang" token (input password-masked, kosong tiap dibuka), bukan menampilkan token lama lalu mengeditnya.
- Diverifikasi end-to-end pakai token sampling pengguna sendiri terhadap instance GitLab CE asli (`sourcecode.jakarta.go.id`): token invalid ditolak tanpa nulis DB, token valid tersimpan lengkap dengan username (`abuabbas`) & avatar, dan `GET /api/gitlab/commits` mengembalikan commit asli (judul/body/tag conventional commit/nama project) buat tanggal yang benar.

### Revisi lagi (2026-09-19, hari yang sama): pilih repo dulu, bukan nge-loop semua repo

Enumerasi "list semua project lalu commit per project" di atas ternyata lambat lewat dev-proxy Vite (satu percobaan pertama sempat 502 setelah ~12 detik walau backend langsung selalu cepat) dan boros — 25 repo di-scan padahal user cuma butuh commit dari satu repo per impor. Diganti alur dua langkah:

- **`GET /api/gitlab/projects`** (baru, `fetchGitlabProjects()` di `server/src/gitlab.ts`) — cuma daftar repo (`GET /api/v4/projects?membership=true`, 1 panggilan, ~0.4 detik untuk 25 repo), dipakai isi dropdown "Pilih repo GitLab" di modal.
- **`GET /api/gitlab/commits?projectId=&tanggal=`** sekarang wajib `projectId` (id repo GitLab yang dipilih user di dropdown itu) — `fetchCommitsForDate()` cuma memanggil commit utuk **satu repo itu saja**, bukan `mapWithConcurrency` ke semua repo. Field `projectName` per-commit dihapus dari response (jadi redundan — semua commit yang tampil sudah pasti dari repo yang sama, ditampilkan sekali sebagai konteks dropdown, bukan diulang per baris).
- Modal (`GitlabCommitImportDialog.vue`): urutan jadi status token → pilih repo GitLab → (baru setelah repo dipilih) pilih project tujuan + checklist commit. Query commit `enabled` menunggu `gitlabProjectId` terisi, bukan cuma modal terbuka.
- Hasilnya: fetch commit scoped satu repo ~0.15–0.2 detik lewat proxy Vite, dicoba 3x berturut-turut tanpa 502 (dibanding sebelumnya yang menyapu 25 repo sekaligus).

### Tambahan (2026-09-19, hari yang sama): project tujuan bisa "Lainnya…"

"Pilih project tujuan" di modal semula cuma dropdown project yang sudah ada — pengguna minta bisa mengusulkan project baru juga, sama seperti `TaskPickerForm` (ADR-0042). Ditambahkan opsi "Lainnya…" dengan input nama, dikirim sebagai `newTask.projectBaru` bukan `projectId`.

- **Bug dicegah sebelum sempat kejadian**: satu sesi impor bisa menghasilkan BANYAK draft task (satu per commit dicentang) yang semuanya menunjuk `projectBaru` dengan nama SAMA — `resolveProjectId()` di `server/src/routes/task-logs.ts` sebelumnya bikin baris `projects` baru untuk **setiap** item, tidak dicek dulu apa sudah ada nama identik di batch simpan yang sama (tidak masalah selama ini karena `TaskPickerForm` cuma pernah kirim satu `newTask` per submit). Ditambahkan `projectBaruCache` (Map nama→projectId) di dalam transaksi `handleSaveDailyInput`, supaya beberapa item dengan `projectBaru` sama pada satu kali "Simpan" berbagi satu project usulan, bukan bikin duplikat. Berlaku umum untuk semua alur newTask, bukan cuma impor GitLab.
- Diverifikasi: `bun test` (184 test, termasuk suite `task-logs.test.ts`) tetap lolos semua setelah perubahan.

### Bug ditemukan (2026-09-19): commit yang sudah diimpor bisa jadi duplikat

**Laporan pengguna**: commit yang sudah diimpor jadi task lalu "Simpan" diklik, tetap muncul lagi kalau modal "Impor dari GitLab" dibuka ulang (tanggal/repo yang sama) — tidak ada penanda "commit ini sudah pernah diimpor". Kalau dicentang & diimpor lagi, hasilnya task/task_log **duplikat** untuk commit yang sama. Belum diperbaiki — dicatat dulu sebagai keputusan sebelum implementasi (diminta eksplisit: ADR dulu, bukan langsung coding).

**Akar masalah**: alur impor sekarang (bagian "Revisi (2026-09-19)" di atas) sengaja belum menyentuh `task_log_commits` ("Belum menyentuh `task_log_commits`" — lihat poin di atas) — jadi tidak ada state apa pun yang mencatat commit mana yang sudah pernah jadi task. `GET /api/gitlab/commits` selalu mengembalikan seluruh commit di rentang tanggal itu apa adanya dari GitLab, tanpa peduli riwayat impor sebelumnya.

**Keputusan**:

- **Aktifkan `task_log_commits` ([ADR-0039](0039-integrasi-commit-gitlab.md)) sekarang**, lebih cepat dari rencana asal (yang niatnya nunggu SSO/[ADR-0038](0038-sso-gitlab.md)) — strukturnya dipakai persis seperti yang sudah didesain di sana (`task_log_id`, `commit_sha`, `commit_url`, `pesan`, `authored_at`, `ditambahkan_oleh`, `created_at`), cuma fungsinya diperluas: bukan cuma "bukti pendukung terpisah", tapi sekalian jadi penanda "commit ini sudah diimpor". `pesan` yang disimpan sengaja pesan **lengkap** commit asli (bukan cuma title) — beda dari `catatan` di task_log yang mungkin sudah diedit user sebelum simpan, berguna buat bandingkan teks asli vs hasil edit kalau dibutuhkan nanti.
- **Ditulis di transaksi "Simpan" yang sama**, bukan saat commit dicentang di modal — prinsip sama seperti project "Lainnya" ([ADR-0042](0042-project-lainnya-usulan.md)): draft yang batal/di-refresh sebelum "Simpan" tidak boleh menyisakan data nyantol. Berarti draft item (`newTask`/`SaveTaskLogItem`) perlu ikut bawa data commit (`sha`, `commitUrl`, `pesan` lengkap, `authoredAt`) dari commit picker sampai ke payload simpan akhir, baru ditulis ke `task_log_commits` kalau task_log-nya benar-benar berhasil dibuat.
- **`GET /api/gitlab/commits` memfilter status "sudah diimpor"** — tiap commit yang di-return dicek `commit_sha`-nya sudah ada di `task_log_commits` milik user itu (`ditambahkan_oleh = ctx.user.id`) atau belum. SHA git praktis unik global, jadi cukup dicek per-sha per-user, tidak perlu discope ulang per tanggal/repo.
- **UI tampilkan "Sudah diimpor", bukan disembunyikan** — konsisten pola yang sama persis dengan [ADR-0040](0040-import-project-gitlab.md) ("tombol import menampilkan 'sudah diimpor' untuk project yang gitlab_project_id-nya sudah ada"). Checkbox commit yang sudah diimpor dinonaktifkan + badge "Sudah diimpor", bukan hilang dari daftar — user tetap bisa lihat konteksnya, tidak bingung kenapa sebagian commit "menghilang" begitu saja.
- **Race dua tab dianggap risiko diterima**: kalau user buka dua sesi impor bersamaan tanpa refresh, checkbox commit "sudah diimpor" di sesi yang lebih lama bisa saja belum ke-update — tidak perlu locking khusus, skala tim ini (~6 orang) membuat kejadian ini jarang dan dampaknya kecil (paling banter satu duplikat, bukan korupsi data).

**Konsekuensi**:

- `task_log_commits` jadi dipakai lebih dulu dari rencana ADR-0039 asli, tapi skemanya tetap yang sudah didesain di sana — saat token-SSO (ADR-0039 versi lengkap) dikerjakan nanti, tabel ini tinggal dipakai bersama, tidak perlu migrasi skema baru.
- Menambah satu query lookup (`commit_sha IN (...)`) di `GET /api/gitlab/commits` — dampak performa kecil (satu query indexed per request, bukan N+1).

**Rincian terbuka**:

- Apakah badge "Sudah diimpor" perlu link balik ke task/task_log tujuan (klik → lompat ke situ)? Ditunda, disederhanakan dulu jadi badge statis + checkbox disabled saja.
- DDL final `task_log_commits` (kolom persis, index di `commit_sha`+`ditambahkan_oleh`) ditulis saat implementasi, migration bernomor berikutnya (`docs/schema/0009_*.sql`).
