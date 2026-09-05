# ADR-0038: Login SSO via GitLab CE self-hosted

- Status: diterima; rincian implementasi dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: susulan pada [Stage 1](../stages/01-fondasi-akses.md) — tidak membuka ulang kriteria yang sudah selesai; diimplementasikan sebagai penambahan terpisah.
- Melengkapi: [ADR-0003](0003-login-session.md), [ADR-0004](0004-hak-akses.md), [ADR-0005](0005-project-keanggotaan.md), [ADR-0033](0033-rangkap-peran.md).
- Terkait: [ADR-0039](0039-integrasi-commit-gitlab.md) (memakai token dari ADR ini untuk memanggil API GitLab).

## Konteks

Kantor pengguna memakai GitLab CE self-hosted untuk kerja sehari-hari. Pengguna ingin memakai instance itu sebagai SSO supaya tidak perlu kredensial terpisah, dan sekalian membuka jalan untuk mengambil data commit sebagai bukti pendukung laporan ([ADR-0039](0039-integrasi-commit-gitlab.md)). [ADR-0003](0003-login-session.md) sebelumnya menyatakan SSO belum diminta; ADR ini menggantikan bagian itu.

GitLab CE (bukan hanya EE) menyediakan provider OAuth2/OIDC bawaan (`/oauth/authorize`, `/oauth/token`, `/oauth/userinfo`), diaktifkan lewat pendaftaran OAuth Application di admin instance tersebut.

## Keputusan

- Tambahkan "Masuk dengan GitLab" di halaman login sebagai **opsi kedua**, berdampingan dengan login email/password yang sudah ada ([ADR-0003](0003-login-session.md)) — password tidak dihapus, tetap berfungsi sebagai fallback jika GitLab tidak dapat diakses atau untuk akun yang sengaja tidak ditautkan.
- Alur: redirect ke `/oauth/authorize` instance GitLab (scope `openid profile email`), tukar `code` ke `/oauth/token`, ambil identitas dari `/oauth/userinfo`. Sesi aplikasi yang terbentuk setelahnya sama persis dengan sesi hasil login password (cookie `HttpOnly` acak, tabel `sessions`) — GitLab hanya membuktikan identitas saat login, bukan otorisasi berkelanjutan.
- Pencocokan akun berdasarkan email dari GitLab ke `users.email`. Simpan juga id user GitLab (`users.gitlab_user_id`, nullable, unik) supaya pencocokan berikutnya tidak bergantung pada email yang bisa berubah.
- **Auto-provisioning**: jika email/`gitlab_user_id` belum ada di `users`, buat baris baru otomatis (nama dan email dari profil GitLab), beri role `tenaga_ahli` sebagai default, tanpa `atasan_id`/`supervisi_id`. Admin tetap yang mengatur hierarki, rangkap peran, dan keanggotaan project setelahnya ([ADR-0031](0031-hierarki-supervisi.md), [ADR-0033](0033-rangkap-peran.md), [ADR-0005](0005-project-keanggotaan.md)) — auto-provisioning hanya membuat *identitas akun*, bukan memberi akses project atau peran tambahan.
- Akun hasil auto-provisioning tidak memiliki `password_hash` (tetap `NULL`); login password untuk akun itu otomatis tertolak sampai admin menetapkan password secara terpisah.
- Konfigurasi instance (`GITLAB_BASE_URL`, `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`, `GITLAB_REDIRECT_URI`) lewat env var (`.env`, tidak dikomit), bukan hardcode — ini kebutuhan pertama proyek yang membenarkan penambahan `.env`.

## Konsekuensi

- Auto-provisioning di sini **berbeda konteks** dari larangan "user membuat project/bergabung sendiri" pada [ADR-0005](0005-project-keanggotaan.md): itu mengatur keanggotaan project, bukan keberadaan akun. Trust boundary-nya adalah "punya akun di GitLab CE internal kantor", bukan internet publik — instance-nya self-hosted dan tertutup.
- Akun baru dari auto-provisioning belum bisa mencatat laporan berarti sampai admin memasukkannya ke project (Stage 2) — konsisten dengan alur admin yang sudah ada, cuma pembuatan akunnya yang tidak lagi manual.
- Menyimpan access/refresh token GitLab per user (untuk dipakai [ADR-0039](0039-integrasi-commit-gitlab.md)) diperlukan sejak alur OAuth ini berjalan; kolom/penyimpanan dan kebijakan refresh dirinci saat implementasi.
- Scope OAuth yang diminta perlu mencakup kebutuhan [ADR-0039](0039-integrasi-commit-gitlab.md) (baca commit) sejak awal supaya user tidak diminta consent dua kali.

## Rincian terbuka

- Apakah login GitLab perlu dibatasi ke anggota grup/project GitLab tertentu (mencegah auto-provisioning dari akun tamu/eksternal di instance yang sama), atau cukup "punya akun di instance ini"? Perlu diperjelas sebelum implementasi jika instance tersebut juga dipakai pihak luar.
- Redirect URI dan route callback (`/api/auth/gitlab/callback` atau serupa) ditentukan saat implementasi.
- Kebijakan token kedaluwarsa/refresh dan apa yang terjadi saat refresh gagal (paksa login ulang vs fallback ke password) dirinci saat implementasi.
