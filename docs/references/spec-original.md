# Aplikasi Laporan Harian Tenaga Ahli — Spec & Build Prompt

Dokumen ini punya 2 bagian: (1) ERD final, (2) prompt siap pakai buat AI coding agent (Claude Code / Cursor / dst) untuk mulai build.

---

## 1. ERD Final

### Entitas & Relasi

- `users` 1—N `user_project` N—1 `projects` (many-to-many, 1 tenaga ahli bisa pegang banyak project)
- `projects` 1—N `tasks`
- `tasks` 1—N `task_logs` (history harian: siapa ngerjain, kapan, jenis rencana/realisasi)
- `task_logs` 1—N `kendala` (kendala nempel ke kejadian harian, bukan ke task permanen)
- `task_logs` 1—N `attachments` (polymorphic, bisa expand ke entitas lain nanti)

Catatan desain penting:
- `tasks` **tidak** punya `user_id` tetap — siapa yang pegang ditentukan per hari lewat `task_logs.user_id`. Ini yang bikin reassignment implisit: kalau task gak di-carry (gak dicentang) oleh siapa pun, dia ya lepas begitu saja, tanpa proses assign eksplisit.
- Carry-over harian: sistem query `task_logs` milik user tsb, `jenis='rencana'`, `tanggal = kemarin`. Yang dicentang jadi `task_logs` baru `jenis='realisasi'`. Yang tidak dicentang dibiarkan, task tetap `status='open'`, tidak ada aksi apa pun.
- Kalau query di atas kosong (cold start, atau user lupa isi beberapa hari), UI menampilkan empty state dengan CTA "+ Tambah kerjaan kemarin" — insert manual ke `task_logs` (`jenis='realisasi'`, `is_extra=true`) supaya histori tetap nyambung.
- Kendala opsional, per log, bukan field wajib.
- Attachment polymorphic supaya fleksibel nempel ke `task_logs` (paling umum) atau level lain di masa depan.

### SQL DDL (Postgres-style, sesuaikan ke DB pilihan)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(150) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE user_project (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  project_id INT REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id) ON DELETE RESTRICT,
  deskripsi TEXT NOT NULL,
  tag VARCHAR(50),                 -- contoh: "#180", "feat(profile-ui)"
  status VARCHAR(20) DEFAULT 'open', -- open | closed
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE task_logs (
  id SERIAL PRIMARY KEY,
  task_id INT REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE RESTRICT,
  tanggal DATE NOT NULL,
  jenis VARCHAR(20) NOT NULL,      -- rencana | realisasi
  catatan TEXT,
  is_extra BOOLEAN DEFAULT false,  -- true = di luar rencana / manual seed
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_task_logs_user_tanggal ON task_logs (user_id, tanggal, jenis);

CREATE TABLE kendala (
  id SERIAL PRIMARY KEY,
  task_log_id INT REFERENCES task_logs(id) ON DELETE CASCADE,
  deskripsi TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open', -- open | resolved
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE attachments (
  id SERIAL PRIMARY KEY,
  attachable_type VARCHAR(50) NOT NULL,  -- 'task_log', dst
  attachable_id INT NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  uploaded_by INT REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_attachments_morph ON attachments (attachable_type, attachable_id);

CREATE TABLE leaves (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE RESTRICT,
  tanggal DATE NOT NULL,
  jenis VARCHAR(30) NOT NULL,        -- cuti | sakit | izin
  alasan TEXT,
  potong_cuti_tahunan BOOLEAN,       -- nullable, logic pemotongan menyusul
  created_at TIMESTAMP DEFAULT now()
);
```

Catatan `leaves`: sengaja dipisah dari `task_logs` karena hari itu tidak ada
kerjaan sama sekali — bukan variasi status task, tapi status kehadiran.
Logic pemotongan kuota cuti tahunan belum diimplementasikan di kolom
`potong_cuti_tahunan` (nullable dulu), fokus tahap ini cuma capture data.
Saat generate laporan bulanan, `LEFT JOIN` ke tabel ini untuk menjelaskan
tanggal yang tidak punya `task_logs`.

---

## 2. Prompt untuk AI Agent

Copy-paste blok di bawah ini ke Claude Code / Cursor / agent lain buat mulai implementasi.

```
Saya mau bikin aplikasi web internal "Laporan Harian Tenaga Ahli" untuk
menggantikan Google Form yang sekarang dipakai tim developer/tenaga ahli
di sebuah instansi. Tolong bantu build dari spec di bawah ini.

## Konteks bisnis
Setiap pagi, tiap tenaga ahli (programmer) isi laporan: apa yang
dikerjakan kemarin (realisasi) dan rencana hari ini. Masalah di Google
Form lama: user harus ngetik ulang kerjaan yang masih berlanjut dari
hari sebelumnya. Aplikasi baru harus otomatis nge-carry rencana kemarin
jadi checklist realisasi hari ini.

## Aturan bisnis inti (WAJIB dipahami sebelum coding)
1. Task TIDAK terikat ke satu orang secara permanen. Siapa yang
   mengerjakan ditentukan per hari via task_logs.user_id. Kalau sebuah
   task yang direncanakan kemarin tidak dicentang/di-realisasikan oleh
   siapapun hari ini, task itu dianggap "lepas" begitu saja — tidak ada
   proses assign/reassign eksplisit di sistem. Ini teknis reassignment
   yang disengaja untuk tetap simpel.
2. Ada 3 section input harian:
   a. "Realisasi kemarin" — checklist dari task_logs (jenis=rencana,
      tanggal=kemarin, user_id=user aktif). Centang = insert task_log
      baru (jenis=realisasi) + textarea catatan hasil wajib diisi kalau
      dicentang. Tidak dicentang = tidak ada aksi, task tetap open.
      Toggle opsional "ada kendala" per item yang dicentang -> insert
      row ke tabel kendala terkait task_log itu.
   b. "Kerjaan tambahan kemarin" — quick-add kerjaan yang dikerjakan
      kemarin tapi di luar rencana. Insert task baru (kalau topik baru)
      + task_log (jenis=realisasi, is_extra=true).
   c. "Rencana hari ini" — freeform, opsional, quick-add manual saja.
      TIDAK auto-carry paksa dari task yang belum realisasi kemarin
      (karena bisa jadi dioper ke orang lain / tidak dilanjutkan).
3. Empty state / cold start: kalau query task_logs kemarin untuk user
   tsb kosong (hari pertama pakai app, atau user lupa isi beberapa
   hari), section "Realisasi kemarin" TIDAK disembunyikan, tapi ganti
   jadi CTA "+ Tambah kerjaan kemarin (manual)" dengan form sama
   seperti section 2b, hasilnya insert task_log jenis=realisasi,
   is_extra=true, tanggal=kemarin. Ini memastikan histori tetap
   nyambung meski user baru mulai atau ada hari bolong.
4. Attachment (screenshot bukti kerjaan) sifatnya opsional, morph ke
   task_logs (dan berpotensi ke entitas lain nanti), bukan field
   langsung di tabel manapun.
5. Kendala bersifat opsional dan nempel ke task_log spesifik (kejadian
   hari itu), bukan ke task secara permanen.
6. Izin/tidak masuk: di halaman input harian ada toggle "Izin / tidak
   masuk hari ini". Kalau aktif, sembunyikan 3 section normal, ganti
   dengan form kecil (jenis: cuti/sakit/izin, alasan opsional) yang
   insert ke tabel leaves. Kolom potong_cuti_tahunan dibiarkan
   null/belum dihitung dulu -- fokus tahap ini cuma capture data,
   logic pemotongan kuota cuti menyusul nanti.

## Skema database
Gunakan skema berikut (lihat DDL lengkap terlampir / bagian 1 dokumen
ini): users, projects, user_project (pivot), tasks, task_logs, kendala,
attachments (polymorphic via attachable_type + attachable_id), leaves
(izin/cuti/sakit, terpisah dari task_logs).

## Fitur yang dibutuhkan
- Login/pilih user sederhana (belum perlu auth kompleks, asumsikan
  internal tool, bisa mulai dari dropdown/session sederhana dulu).
- Halaman "Input Hari Ini" dengan 3 section di atas, tombol per item
  yang jelas (bukan dropdown tersembunyi), submit di akhir.
- Halaman "Riwayat" — list laporan per tanggal, bisa expand ke detail
  task_logs hari itu termasuk kendala dan attachment.
- Generate laporan bulanan ke format Word (.docx) mengikuti template
  yang sudah ada (placeholder: {%TIMESHEET} = rekap tanggal kerja per
  bulan, {%AKTIVITAS} = narasi aktivitas dari task_logs realisasi bulan
  tsb, lampiran = attachments terkait task_logs bulan tsb). Tanya saya
  untuk detail template kalau dibutuhkan.
- Dashboard/rekap sederhana untuk atasan: siapa mengerjakan apa,
  task mana yang "nyangkut" lama tanpa realisasi.

## Constraint teknis
- Sebutkan stack yang mau saya pakai atau tanya saya dulu sebelum
  scaffolding kalau belum saya tentukan (backend + frontend + DB).
- Ikuti skema tabel di atas apa adanya kecuali ada alasan teknis kuat
  untuk berbeda — kalau begitu, jelaskan dulu ke saya alasannya sebelum
  ubah.
- Prioritaskan clarity UI: setiap aksi (centang, tambah kendala, tambah
  tugas) harus lewat tombol/checkbox eksplisit, bukan gesture
  tersembunyi, karena user-nya bukan technical/non-power-user.

Mulai dengan konfirmasi pemahaman kamu soal 5 aturan bisnis inti di
atas, baru lanjut ke rencana implementasi.
```

---

Referensi tambahan: prototype UI (React) sudah dibuat terpisah untuk validasi flow — bisa dipakai sebagai referensi visual/UX buat agent yang akan implementasi frontend-nya.