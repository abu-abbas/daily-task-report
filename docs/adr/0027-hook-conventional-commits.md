# ADR-0027: Hook Conventional Commits

- Status: diterima.
- Tanggal: 2026-09-05.
- Cakupan: tooling lintas stage; bukan penyelesaian Stage 1.

## Konteks

Pengguna meminta hook commit agar pesan mengikuti Conventional Commits dan siap untuk penggunaan semantic-release nanti.

## Keputusan

Gunakan hook Git native `.githooks/commit-msg` dan commitlint dengan `@commitlint/config-conventional`. `bun install` menjalankan `prepare` untuk mengaktifkan hook pada clone lokal. Dependency development dipin dan lockfile disimpan. Validasi memakai parser standar, bukan regex buatan sendiri; tidak perlu hook manager tambahan.

Format commit adalah `type(scope opsional): deskripsi`. Breaking change dapat memakai `!` atau footer `BREAKING CHANGE`. Jangan melewati hook dengan `--no-verify`. Contoh dan cara instalasi ada di [README](../../README.md).

## Konsekuensi

- Bun harus tersedia ketika commit dijalankan. Hook menggunakan executable commitlint yang sudah terpasang dan tidak mengunduh tool saat commit.
- `core.hooksPath` bersifat lokal, sehingga clone baru perlu menjalankan instalasi. Hook perlu disimpan sebagai executable di Git.
- Gunakan preset `conventionalcommits` pada commit-analyzer dan release-notes-generator saat semantic-release dipasang nanti; preset default semantic-release dapat berbeda.
- Hook lokal dapat dilewati secara teknis; validasi CI dan aturan merge dibutuhkan saat pipeline release dibuat. Semantic-release dan CI belum dipasang dalam pekerjaan ini.
- Uji hook melalui commit Git sungguhan di repository sementara agar pesan invalid benar-benar menolak commit tanpa menambah commit percobaan pada proyek.

## Verifikasi

`bun run test:hooks` lolos: tiga pesan invalid ditolak dan lima pesan valid diterima, termasuk breaking change dengan `!` serta footer. `core.hooksPath` lokal menunjuk `.githooks`; hook memiliki izin executable. Instalasi dependency menjalankan `prepare` dengan sukses.

## Sumber

- [commitlint: pemasangan lokal](https://commitlint.js.org/guides/local-setup.html).
- [semantic-release commit-analyzer: preset](https://github.com/semantic-release/commit-analyzer).
