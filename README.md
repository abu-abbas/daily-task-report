# Laporan Harian Tenaga Ahli

Dokumentasi keputusan dan rencana pembangunan aplikasi tersedia di [docs/README.md](docs/README.md).

Mulai dari [checklist pekerjaan](docs/TODO.md) untuk melihat progres dan langkah berikutnya.

Rancangan layar dapat dibuka di browser melalui [preview Stage 0](docs/stages/00-preview.html). Tersedia contoh mobile/desktop dan light/dark mode; data tidak disimpan.

Stage 1 (fondasi aplikasi dan akses) sedang berjalan; lihat [bukti pelaksanaan](docs/stages/01-fondasi-akses.md). Ikuti ADR yang diterima dan ponytail full saat mengerjakan setiap stage.

## Menjalankan aplikasi (Stage 1)

Prasyarat: Bun terpasang.

```sh
bun install --frozen-lockfile   # sekali di root — workspaces meng-install frontend & server

bun run migrate                 # jalankan migration ke data/app.db
bun run dev:server              # terminal 1 — backend di :3001
bun run dev:frontend            # terminal 2 — frontend di :5173, proxy /api ke backend
```

Buka `http://localhost:5173`. Login butuh user dengan `password_hash` terisi; belum ada halaman registrasi/seed otomatis (admin/provisioning menyusul Stage 2).

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
