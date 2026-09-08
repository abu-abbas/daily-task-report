# ADR-0016: Attachment gambar pada log

- Status: diterima; rincian diselesaikan 2026-09-08.
- Tanggal: 2026-09-05.
- Stage utama: [05](../stages/05-kendala-attachment-riwayat.md).

## Konteks

Keputusan bisnis 16: menerima rekomendasi A.

**Rincian terbuka** (diselesaikan 2026-09-08): struktur penyimpanan file, scope (jenis log mana yang boleh dilampiri), otorisasi akses, dan validasi isi file — semua difinalkan bareng user saat merancang implementasi.

## Keputusan

- Izinkan JPG/PNG saja; maksimal 5 file per log dan maksimal 5 MB per file. Attachment opsional, menggunakan relasi polymorphic yang sudah diminta (`attachable_type`/`attachable_id`), dengan task_log sebagai target implementasi awal.
- **Scope**: cuma log `jenis='realisasi'` (checklist Realisasi yang sudah tersimpan + Kerjaan tambahan) — **bukan** Rencana, konsisten dengan [ADR-0015](0015-kendala.md) (kendala). Lampiran itu bukti kerja yang sudah dilakukan, bukan sesuatu yang nempel ke rencana yang belum dikerjakan.
- **Struktur folder**: `data/attachments/<YYYY>/<MM>/<DD>/<task_log_id>/<uuid>.<ext>` — YYYY/MM/DD dipecah dari `task_logs.tanggal` (tanggal laporan, bukan waktu upload sungguhan), konsisten dengan cara app ini selalu berpikir soal tanggal bisnis ([ADR-0032](0032-tanggal-bisnis.md)). Nama file di disk selalu acak (`uuid.ext`, ekstensi dari hasil validasi signature file sungguhan) — nama file asli yang diketik user disimpan terpisah di kolom `attachments.nama_asli` (migration `0003_attachment_nama_asli.sql`), bukan diselipkan ke nama file di disk, supaya tidak perlu sanitasi nama file arbitrary dari user. Ukuran file (bytes) juga disimpan saat upload di kolom `attachments.ukuran_bytes` (migration `0004_attachment_ukuran.sql`) — dari `file.size` yang sudah divalidasi, bukan dihitung ulang dari disk tiap kali dibaca — dipakai buat tampilan "PNG · 820 KB" di kartu lampiran.
- **UI**: pakai komponen resmi `attachment` dari registry shadcn-vue (`npx shadcn-vue add attachment`), orientasi vertical, menampilkan thumbnail gambar penuh + nama file + tipe·ukuran + tombol hapus (ikon X) di pojok. **Catatan implementasi**: prop `size="sm"`/`"xs"` pada komponen ini bentrok dengan orientasi vertical di setup Tailwind v4 proyek ini — kelas `group-data-[size=sm]/attachment:w-8` menang atas `group-data-[orientation=vertical]/attachment:w-full` (harusnya kebalikannya), bikin thumbnail kecil gak proporsional. Pakai `size` default (tanpa prop, jangan set `sm`/`xs`) untuk orientasi vertical supaya thumbnail penuh selebar kartu.
- **Validasi isi file**: server membaca signature byte asli file (JPEG: `FF D8 FF`; PNG: `89 50 4E 47 0D 0A 1A 0A`), **tidak** percaya `Content-Type`/ekstensi yang diklaim klien — mencegah file disamarkan (mis. `.txt` diganti nama jadi `.jpg`).
- **Boleh kapan saja**: upload/hapus lampiran tidak terikat jendela edit bulan berjalan ([ADR-0009](0009-edit-submit.md)) — sama alasan resolve kendala (ADR-0015): menambah bukti pendukung tidak mengubah catatan/realisasi historis. UI tombol upload untuk putaran pertama ini cukup ditaruh di Input Harian (menjangkau bulan berjalan lewat date-picker yang sudah ada, ADR-0044); begitu Riwayat dibangun (Stage 5 berikutnya), tombol upload ikut ditaruh di sana supaya laporan bulan-bulan lama juga bisa ditambahi bukti.
- **Otorisasi**: dibatasi pemilik log saja (`task_logs.user_id` sama dengan user login), sama seperti kendala — **bukan** pengurangan cakupan yang disengaja, melainkan karena akses histori berbasis hierarki ([ADR-0034](0034-akses-histori.md): supervisi/atasan baca laporan bawahannya) **belum diimplementasikan di mana pun** di aplikasi ini (belum ada Riwayat, belum ada endpoint apa pun yang menerapkannya). Perlu direvisit dan diperluas saat Riwayat/akses-hierarki benar-benar dibangun.

## Konsekuensi

- Validasi ukuran, jumlah, dan isi/jenis file di server; batasi akses sesuai pemilik/cakupan laporan (lihat catatan otorisasi di atas). Jangan membangun dukungan entitas lain sekarang.
- File dan referensi database harus konsisten ketika upload gagal atau data diedit. **Penting**: `attachments` itu polymorphic (`attachable_type`/`attachable_id` generik), **bukan** FK sungguhan seperti `kendala.task_log_id` — jadi **tidak** auto-cascade kalau baris `task_logs`-nya dihapus. Satu-satunya jalur penghapusan `task_logs` yang ada sekarang (efek-uncheck checklist realisasi, `handleSaveDailyInput` di `server/src/routes/task-logs.ts`) membersihkan attachment terkait secara manual (baris DB + file fisik) sebelum menghapus baris `task_logs`-nya, supaya tidak jadi file/baris yatim. Dialog konfirmasi simpan di `InputHarianView.vue` juga memperingatkan user kalau uncheck akan menghapus kendala dan/atau lampiran yang sudah tercatat.
