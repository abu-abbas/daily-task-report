# ADR-0043: Beranda sebagai preview rencana hari ini, todo-list opsional dalam catatan

- Status: diterima.
- Tanggal: 2026-09-07.
- Stage utama: [03](../stages/03-input-harian.md).
- Melengkapi: [ADR-0007](0007-tanggal-realisasi.md), [ADR-0009](0009-edit-submit.md).

## Konteks

`/` selama ini redirect langsung ke `/input`, jadi halaman pertama yang dilihat user selalu form input kosong — terasa seperti halaman default, bukan sesuatu yang membantu memulai kerja hari itu. Tidak ada tempat untuk melihat sekilas apa yang sudah direncanakan untuk hari ini tanpa masuk mode edit.

## Keputusan

`/` menjadi halaman **Beranda** tersendiri (bukan redirect lagi) — menampilkan rencana hari ini (`rencanaHariIni`) yang sudah tersimpan secara read-only, sebagai acuan kerja. Form input harian (checklist realisasi, kerjaan tambahan, rencana) tetap di `/input`, tidak berubah. Setelah "Simpan" di `/input` sukses, user diarahkan balik ke `/`.

Ini **tidak mengubah** model pelaporan ADR-0007/ADR-0009: realisasi tetap resmi dicatat besok (retrospektif, catatan wajib), tidak ada pencatatan realisasi live hari itu juga.

Catatan (`catatan`) pada task rencana — field yang sudah ada, sudah opsional, sudah tersimpan lewat endpoint simpan yang sama — sekarang boleh berisi sintaks checkbox markdown (`- [ ] ...` / `- [x] ...`), dirender di Beranda sebagai todo-list yang bisa dicentang. Centang mengirim ulang catatan yang sudah diedit lewat endpoint simpan yang sama (upsert by task+tanggal+jenis, ADR-0041) — bukan endpoint atau kolom baru. Fitur ini murni opsional: user boleh tidak memakai checkbox sama sekali (catatan biasa), atau memakainya cuma untuk diri sendiri tanpa berdampak ke laporan resmi apa pun.

## Konsekuensi

Tidak ada perubahan skema database. `rencanaHariIni` pada respons `GET /task-logs/today` bertambah field `catatan` (sebelumnya tidak diikutsertakan meski kolomnya sudah ada). Sidebar mendapat entri navigasi "Beranda" terpisah dari "Input harian". Todo-list dalam catatan tidak divalidasi atau dihitung di mana pun (bukan indikator, bukan bagian dari Stage 6 dashboard tim) — murni bantuan visual personal.
