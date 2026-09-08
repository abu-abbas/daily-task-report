# ADR-0015: Kendala per log dan penyelesaiannya

- Status: diterima; rincian terbuka pada Q-04 diselesaikan 2026-09-08.
- Tanggal: 2026-09-05.
- Stage utama: [05](../stages/05-kendala-attachment-riwayat.md).

## Konteks

Keputusan bisnis 15: menerima rekomendasi A.

**Rincian terbuka** (diselesaikan 2026-09-08): aturan resolve kendala setelah bulan laporan ditutup (di luar jendela edit [ADR-0009](0009-edit-submit.md)). User memutuskan resolve boleh dilakukan **kapan saja**, tidak terikat bulan berjalan — menandai kendala selesai cuma mengubah status kendala itu sendiri, bukan mengubah isi laporan/realisasi historis, jadi wajar diselesaikan belakangan walau bulan sudah lewat.

## Keputusan

- Kendala bersifat opsional, terkait `task_log` tertentu, dan dapat ditandai resolved oleh pembuat log (`task_logs.user_id`).
- **Resolve tidak terikat jendela edit bulan berjalan** — beda dari mengedit isi catatan/realisasi (ADR-0009), status kendala boleh diubah kapan saja.
- **Resolve satu arah, tidak ada "buka lagi"** — konsisten dengan pola penutupan task ([ADR-0045](0045-penutupan-task.md)/[ADR-0012](0012-penutupan-task.md), YAGNI reopen). Kalau kendala yang sama muncul lagi, dicatat sebagai kendala baru, bukan membuka ulang yang lama.
- **Kendala cuma berlaku untuk log jenis `realisasi`** (baik checklist realisasi maupun kerjaan tambahan), bukan `rencana` — secara konsep kendala muncul saat mengerjakan, bukan saat merencanakan. Konsisten dengan wireframe awal ([00-review.md](../stages/00-review.md)) yang menaruh "+ Tambah kendala" di item realisasi.
- **Otorisasi murni kepemilikan log** (`task_logs.user_id` sama dengan user yang login), tanpa cek ulang keanggotaan aktif project — user yang sudah keluar dari project tetap boleh mengelola kendala di histori laporannya sendiri.
- Kendala baru hanya bisa ditambahkan ke `task_log` yang sudah tersimpan (bukan ke draft yang belum disimpan) — endpoint kendala berdiri sendiri (`POST/DELETE /api/kendala`, `POST /api/kendala/:id/resolve`), tidak dibundel ke `POST /api/task-logs`, konsisten dengan pola `closeTask`/`saveLeave` (aksi kecil independen, invalidate query harian setelahnya).

## Konsekuensi

Pertahankan relasi task_logs 1—N kendala. Jangan memindahkannya menjadi status permanen task. Kewenangan atasan untuk resolve tidak diberikan (tetap hanya pembuat log). Menghapus `task_log` (mis. efek uncheck checklist realisasi) ikut menghapus kendala di bawahnya lewat `ON DELETE CASCADE` yang sudah ada di skema — tidak perlu penanganan khusus.
