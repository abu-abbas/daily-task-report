# ADR-0022: Visual minimalis dengan referensi sebagai inspirasi

- Status: diterima; warna aksen final dikunci pada revisi ini.
- Tanggal: 2026-09-05 (revisi warna aksen: 2026-09-05).
- Stage utama: [00](../stages/00-keputusan-desain.md).

## Konteks

Keputusan frontend 2: menerima rekomendasi A; pengguna menyertakan gambar sebagai referensi saja. Warna aksen sempat dibiarkan terbuka; pengguna memilihnya lewat preset shadcn-vue (`init --preset a1Fg8Ero`).

## Keputusan

Tampilan minimalis modern: warna dasar netral, satu warna aksen, form lapang, dan aksi eksplisit. Gambar menjadi referensi hierarki konten dan alur, bukan tuntutan salinan persis.

**Warna aksen final**: hijau lime/chartreuse (token shadcn-vue `baseColor: olive`, `--primary: oklch(0.841 0.238 128.85)` di light mode, `oklch(0.768 0.233 130.85)` di dark mode) — dipakai konsisten lewat token `--primary`/`--sidebar-primary`/`--chart-*`, bukan warna hardcode di komponen tertentu. Warna dasar (background/border/muted) memakai varian netral bernuansa hangat (olive-tinted), bukan abu-abu murni.

Font: **Figtree** (sans-serif), menggantikan Geist. Style komponen shadcn-vue: `reka-mira`. Radius tetap `0.625rem` (tidak diubah preset ini). Kursor pointer pada tombol interaktif diaktifkan (`pointer: true`).

## Konsekuensi

Pertahankan tiga section, kartu task, badge project/tag, checkbox, dan tombol tambah yang terlihat. Detail adaptasi tercatat pada referensi UI. Semua komponen baru yang ditambah lewat `shadcn-vue add` mengikuti token warna/font/style ini secara otomatis; jangan menimpa `--primary` dkk. dengan warna hardcode di komponen tertentu (lihat kasus login page yang sempat memakai emerald hardcode dan dibatalkan). Perubahan warna aksen berikutnya cukup lewat `components.json`/`style.css`, bukan menulis ulang per komponen.
