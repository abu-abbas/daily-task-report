# ADR-0048: Logging aplikasi — file harian, rotasi ukuran, retensi mingguan

- Status: diterima; diimplementasikan 2026-10-09 bersama tahap 1 [ADR-0049](0049-hono-drizzle-postgres.md) (`server/src/logger.ts`). Hook global memakai `app.onError` milik Hono, bukan hook `error` milik `Bun.serve`.
- Tanggal: 2026-09-19.
- Stage utama: lintas stage (infrastruktur operasional), tidak terikat satu stage fitur.

## Konteks

Backend proyek ini nyaris tanpa logging aplikasi sama sekali — cuma dua baris `console.log` saat startup (`[server] berjalan di ...`) dan migrasi (`[migrate] applied ...`). Error yang terjadi di dalam route handler ditangkap lokal lalu dibalas ke client sebagai `errorResponse` generik, tanpa jejak apa pun tertulis di server (contoh nyata: `catch` di `server/src/routes/gitlab.ts` yang menelan error koneksi ke GitLab, cuma balas "Gagal menghubungi GitLab, coba lagi." ke user — kalau ini kejadian di production, tidak ada cara tahu penyebab aslinya tanpa reproduksi manual).

Begitu aplikasi live, mengandalkan log dari proses hosting saja (stdout yang ditangkap systemd/docker/pm2 dkk) berisiko: tidak ada jaminan retensi, gampang hilang kalau proses di-restart/di-redeploy, dan bercampur dengan log proses lain kalau di-mounting bareng. Dibutuhkan log level aplikasi sendiri yang persist ke disk dengan retensi jelas — mirip default logging Laravel (daily channel + retensi hari), tapi tanpa menambah dependency baru, konsisten [ADR-0025](0025-metode-ponytail.md) (ponytail) dan [ADR-0035](0035-backend-framework.md) (Bun native, tanpa framework/ORM tambahan) — proyek ini sudah punya pola modul kecil buat kebutuhan serupa (`server/src/storage.ts` untuk attachment, `server/src/kalender.ts` untuk tanggal kerja), logger ini mengikuti pola yang sama.

## Keputusan

- **Modul sendiri, bukan library** (`server/src/logger.ts`, belum dibuat) — tidak pakai pino/winston/dkk. Konsisten pola modul kecil yang sudah ada di proyek ini, menghindari dependency baru untuk kebutuhan yang bisa diselesaikan dengan file I/O sederhana.
- **Format JSON Lines (ndjson)** — satu baris JSON per event: `{ts, level, message, ...meta}`. Gampang di-`grep`/`jq` manual dari server tanpa tool tambahan, dan tetap gampang diparsing terstruktur kalau nanti butuh tooling lebih canggih.
- **Lokasi**: `data/logs/`, sejajar `data/attachments/` dan `data/laporan-template/` yang sudah ada (ADR-0020, operasional lokal) — perlu ditambahkan eksplisit ke `.gitignore` (pola yang ada sekarang list folder `data/*` spesifik per jenis, bukan wildcard).
- **Rotasi dua lapis** — ini bagian yang paling penting dipikirkan matang karena tanpa rotasi yang benar, file log bisa membengkak tak terkendali:
  - **Lapis 1, harian**: nama file `app-YYYY-MM-DD.log`, tanggal kalender Asia/Jakarta (konsisten [ADR-0032](0032-tanggal-log-tidak-berubah.md) soal timezone bisnis) — file baru otomatis tiap pergantian hari, sama seperti daily channel Laravel.
  - **Lapis 2, ukuran, sebagai pengaman** — rotasi harian saja tidak cukup untuk kasus pathological: bug yang bikin error berulang di *setiap* request (mis. loop retry yang salah, atau serangan/scan otomatis yang memicu error terus-menerus) bisa membengkakkan SATU file harian sampai mengganggu disk jauh sebelum jatah rotasi berikutnya (24 jam lagi). Kalau file hari berjalan tembus batas ukuran (default 10 MB, `LOG_MAX_FILE_SIZE_BYTES`), penulisan lanjut ke file bernomor untuk tanggal yang sama (`app-YYYY-MM-DD.1.log`, `.2.log`, dst) — bukan menimpa atau menghentikan logging.
- **Retensi**: file yang tanggalnya lebih tua dari N hari dihapus otomatis, default **7 hari** (`LOG_RETENTION_DAYS`, sesuai saran awal "seminggu"). Pruning dijalankan sekali saat startup server, dan otomatis dicek ulang tiap kali tanggal berganti selama proses jalan lama tanpa restart (dipicu dari titik yang sudah pasti dilewati tiap panggilan log, bukan cron/scheduler terpisah — proses ini kecil, tidak butuh infrastruktur tambahan).
- **Yang di-log**:
  - Setiap response 5xx (error internal) — level `error`, isi minimal: pesan, stack trace (kalau ada `Error` asli), method + path, dan `userId` dari sesi kalau ada.
  - **Hook global** `Bun.serve({ error(err) { ... } })` — jaring pengaman terakhir untuk exception yang lolos dari try/catch manapun di route handler, supaya tidak ada error yang hilang tanpa jejak sama sekali. Bun sudah sediakan hook ini bawaan (`error?: (error: ErrorLike) => Response | ...`), tinggal disambungkan ke logger.
  - Titik-titik yang SEKARANG diam-diam menelan error di `catch` (mis. `routes/gitlab.ts`, dan kemungkinan tempat lain yang disisir saat implementasi) — ditambah `log("error", ...)` sebelum balas response generik ke client.
  - **Tidak** untuk access log rutin (setiap request sukses) — sengaja diskip biar tidak berisik/boros disk buat skala tim ini (~6 orang pengguna internal); ponytail ([ADR-0025](0025-metode-ponytail.md)), bisa ditambah nanti kalau kebutuhannya beneran muncul.
- **Level minimal**: `error` (utama), `warn` (opsional, kejadian mencurigakan tapi bukan kegagalan), `info` (dipakai jarang, event penting seperti migrasi). Tidak ada `debug` yang nyala di production — tidak perlu sistem level yang rumit untuk kebutuhan sekarang.

## Konsekuensi

- Folder `data/logs/` baru, harus ditambahkan ke `.gitignore` sebelum implementasi supaya tidak ke-commit tidak sengaja.
- Menulis log ke disk itu I/O sinkron tambahan di jalur request yang gagal — cuma kena di path error (jarang), dianggap trade-off yang wajar untuk logging file-based tanpa dependency.
- Tidak ada shipping ke sistem eksternal (mis. Sentry, log aggregator terpusat) di keputusan ini — kalau nanti dibutuhkan (tim membesar, butuh alerting real-time, dst), itu keputusan terpisah yang kemungkinan besar berarti pindah ke library logging beneran, dicatat sebagai rincian terbuka di bawah, bukan diasumsikan sekarang.
- Retensi otomatis berarti log lama BENAR-BENAR hilang setelah N hari — kalau butuh audit trail lebih panjang dari 7 hari untuk kasus tertentu, itu di luar cakupan logger ini (beda kebutuhan dari audit/activity log bisnis yang sudah ada, mis. `ActivityLogger`/riwayat realisasi).

## Rincian terbuka

- Daftar pasti titik `catch` yang perlu ditambah `log("error", ...)` di seluruh `server/src/routes/*.ts` — disisir saat implementasi, bukan didaftar lengkap di ADR ini.
- Apakah perlu cara baca log dari dalam aplikasi (mis. halaman admin kecil buat lihat/download log terbaru) atau cukup akses filesystem manual (SSH/`docker exec`) — ditunda, YAGNI, bisa direvisi ADR ini kalau ternyata dibutuhkan.
- Nilai default `LOG_MAX_FILE_SIZE_BYTES` (10 MB) dan `LOG_RETENTION_DAYS` (7 hari) bisa disesuaikan saat implementasi/setelah dipakai nyata di production, mengikuti volume error yang sebenarnya terjadi — bukan angka final yang kaku.
- Upgrade ke library logging (pino dkk) atau shipping eksternal, kalau suatu saat dibutuhkan — bukan penolakan permanen, cuma belum perlu sekarang (ponytail).
