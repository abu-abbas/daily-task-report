# Laporan Harian Tenaga Ahli

Dokumentasi keputusan dan rencana pembangunan aplikasi tersedia di [docs/README.md](docs/README.md).

Mulai dari [checklist pekerjaan](docs/TODO.md) untuk melihat progres dan langkah berikutnya.

Rancangan layar dapat dibuka di browser melalui [preview Stage 0](docs/stages/00-preview.html). Tersedia contoh mobile/desktop dan light/dark mode; data tidak disimpan.

Stage 1 (fondasi aplikasi dan akses) selesai; lihat [bukti pelaksanaan](docs/stages/01-fondasi-akses.md). Stage 2 (user, project, kalender kerja) hampir selesai — lihat [checklist](docs/TODO.md) untuk detail. Ikuti ADR yang diterima dan ponytail full saat mengerjakan setiap stage.

## Menjalankan aplikasi

Prasyarat: Bun terpasang. Database-nya PostgreSQL ([ADR-0049](docs/adr/0049-hono-drizzle-postgres.md)), tapi untuk lokal **tidak perlu install Postgres**: selama `DATABASE_URL` kosong, aplikasi memakai [PGlite](https://pglite.dev) (Postgres asli yang jalan di dalam proses Bun) dengan data di `data/pglite/`, mirip file SQLite dulu. Satu batasan: folder itu hanya bisa dibuka satu proses sekaligus, jadi matikan server dulu kalau mau membukanya dari skrip lain.

Di server (atau lokal yang punya Postgres), isi `DATABASE_URL`, misalnya `postgres://laporan:laporan@localhost:5432/laporan_harian`. Skema dan migration sama untuk keduanya.

```sh
bun install --frozen-lockfile           # sekali di root — workspaces meng-install frontend & server

cp server/.env.example server/.env      # sesuaikan kalau perlu (PORT, DATABASE_URL di server, dst.)
cp frontend/.env.example frontend/.env  # locale/timezone tampilan (ADR-0032)

bun run migrate                         # jalankan migration (PGlite lokal, atau DATABASE_URL)
bun run dev:server                      # terminal 1 — backend di :3001
bun run dev:frontend                    # terminal 2 — frontend di :5173, proxy /api ke backend
```

Buka `http://localhost:5173`. Login butuh user dengan `password_hash` terisi; belum ada halaman registrasi/seed otomatis, jadi user pertama (admin) dibuat manual langsung ke database (hash password dengan `Bun.password.hash`, lalu insert ke tabel `users`/`user_roles`). Setelah itu, pengelolaan user selanjutnya lewat halaman Kelola User (`/admin/users`).

### Pindah dari SQLite lama

Data dari versi SQLite (`data/app.db`) disalin sekali ke database yang masih kosong (PGlite lokal, atau Postgres dari `DATABASE_URL`):

```sh
bun run migrate                              # buat tabel
bun --cwd=server run salin-data              # salin data/app.db, lalu cek jumlah baris per tabel
```

`bun test` memakai PGlite sementara secara default. Untuk menguji ke server Postgres sungguhan, set `TEST_DATABASE_URL` ke database berakhiran `_test` (skemanya dikosongkan tiap run).

Lokasi file SQLite bisa diganti lewat `SQLITE_PATH`. Attachment dan template Word tetap di `data/`, tidak perlu disalin. Perubahan skema berikutnya: ubah `server/src/schema.ts`, lalu `bun --cwd=server run db:generate` untuk membuat file migration baru di `docs/schema/postgres/`.

## Setup hook commit

Prasyarat: Git dan Bun tersedia di terminal yang menjalankan commit, termasuk terminal Git dari IDE.

```sh
bun install --frozen-lockfile
bun run test:hooks
```

Script `prepare` mengaktifkan `.githooks/commit-msg` lewat konfigurasi lokal `core.hooksPath`. Jalankan instalasi setelah clone. Jika lifecycle scripts dilewati, aktifkan kembali dengan `bun run prepare`. Folder ini menjadi sumber hook repo; jangan menimpanya dengan konfigurasi hooks lain.

Hook menjalankan commitlint lokal dengan preset Conventional Commits. Formatnya `type(scope opsional): deskripsi`, misalnya:

```text
feat(laporan): tambah input harian
fix(kalender): perbaiki tanggal sebelumnya
docs: lengkapi keputusan proyek
feat(api)!: ubah format laporan

BREAKING CHANGE: respons laporan memakai struktur baru
```

Tipe yang diterima: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, dan `test`. Scope opsional. Gunakan deskripsi yang diawali huruf kecil tanpa titik di akhir; header maksimal 100 karakter sesuai preset. Pesan otomatis tertentu seperti merge/revert mengikuti pengecualian bawaan commitlint. Jangan melewati hook dengan `--no-verify`.

Saat semantic-release dipasang nanti, gunakan preset `conventionalcommits` secara konsisten pada commit-analyzer dan release-notes-generator agar notasi `!` dan footer `BREAKING CHANGE` dibaca sesuai konvensi ini. `feat` biasanya menghasilkan minor, `fix`/`perf` patch, dan breaking change major. Semantic-release belum dipasang; hook lokal bukan jaminan validasi di GitHub, sehingga validasi CI perlu ditambahkan saat pipeline release dibuat.

Keputusan dan sumber: [ADR-0027](docs/adr/0027-hook-conventional-commits.md).
