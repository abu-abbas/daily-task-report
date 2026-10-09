import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// Skema Drizzle (ADR-0049 tahap 2) — cerminan PERSIS skema hasil migration docs/schema/0001–0009,
// bukan sumber perubahan skema. Selama tahap 2 migration tetap file SQL di docs/schema; file ini
// cuma dipakai untuk query bertipe. Nama properti sengaja sama dengan nama kolom (snake_case)
// supaya baris hasil query tetap cocok dengan tipe yang sudah ada (types.ts, tipe row di route).
// CHECK constraint tidak diulang di sini karena tidak dipakai Drizzle untuk query; sumbernya
// tetap file SQL. tests/schema.test.ts memastikan tabel/kolom di sini sama dengan database nyata.

const now = sql`CURRENT_TIMESTAMP`;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nama: text("nama").notNull(),
  email: text("email").unique(),
  password_hash: text("password_hash"),
  atasan_id: integer("atasan_id"),
  supervisi_id: integer("supervisi_id"),
  created_at: text("created_at").notNull().default(now),
  gitlab_username: text("gitlab_username"),
  gitlab_avatar_url: text("gitlab_avatar_url"),
  gitlab_private_token: text("gitlab_private_token"),
});

export const userRoles = sqliteTable(
  "user_roles",
  {
    user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["tenaga_ahli", "supervisi", "atasan", "admin"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.role] })],
);

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token_hash: text("token_hash").notNull().unique(),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires_at: text("expires_at").notNull(),
  created_at: text("created_at").notNull().default(now),
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nama: text("nama").notNull(),
  is_active: integer("is_active").notNull().default(1),
  created_at: text("created_at").notNull().default(now),
  belum_direkonsiliasi: integer("belum_direkonsiliasi").notNull().default(0),
});

export const userProject = sqliteTable(
  "user_project",
  {
    user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    project_id: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    ended_at: text("ended_at"),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.project_id] })],
);

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  project_id: integer("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  deskripsi: text("deskripsi").notNull(),
  tag: text("tag"),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  deskripsi_penutupan: text("deskripsi_penutupan"),
  created_at: text("created_at").notNull().default(now),
});

export const taskLogs = sqliteTable(
  "task_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    task_id: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    tanggal: text("tanggal").notNull(),
    jenis: text("jenis", { enum: ["rencana", "realisasi"] }).notNull(),
    catatan: text("catatan"),
    is_extra: integer("is_extra").notNull().default(0),
    created_at: text("created_at").notNull().default(now),
  },
  (t) => [
    index("idx_task_logs_user_tanggal").on(t.user_id, t.tanggal, t.jenis),
    index("idx_task_logs_task").on(t.task_id),
  ],
);

export const kendala = sqliteTable("kendala", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  task_log_id: integer("task_log_id").notNull().references(() => taskLogs.id, { onDelete: "cascade" }),
  deskripsi: text("deskripsi").notNull(),
  status: text("status", { enum: ["open", "resolved"] }).notNull().default("open"),
  created_at: text("created_at").notNull().default(now),
});

export const attachments = sqliteTable(
  "attachments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    attachable_type: text("attachable_type").notNull(),
    attachable_id: integer("attachable_id").notNull(),
    file_path: text("file_path").notNull(),
    file_type: text("file_type"),
    uploaded_by: integer("uploaded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    uploaded_at: text("uploaded_at").notNull().default(now),
    nama_asli: text("nama_asli").notNull().default(""),
    ukuran_bytes: integer("ukuran_bytes").notNull().default(0),
  },
  (t) => [index("idx_attachments_morph").on(t.attachable_type, t.attachable_id)],
);

export const leaves = sqliteTable(
  "leaves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    tanggal: text("tanggal").notNull(),
    jenis: text("jenis", { enum: ["cuti", "sakit", "izin"] }).notNull(),
    alasan: text("alasan"),
    potong_cuti_tahunan: integer("potong_cuti_tahunan"),
    created_at: text("created_at").notNull().default(now),
  },
  (t) => [index("idx_leaves_user_tanggal").on(t.user_id, t.tanggal)],
);

export const holidays = sqliteTable(
  "holidays",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nama: text("nama").notNull(),
    tanggal_mulai: text("tanggal_mulai").notNull(),
    tanggal_akhir: text("tanggal_akhir").notNull(),
  },
  (t) => [index("idx_holidays_rentang").on(t.tanggal_mulai, t.tanggal_akhir)],
);

export const saranBulanan = sqliteTable(
  "saran_bulanan",
  {
    user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    bulan: text("bulan").notNull(),
    isi: text("isi").notNull().default(""),
    updated_at: text("updated_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.bulan] })],
);

export const laporanTemplate = sqliteTable("laporan_template", {
  user_id: integer("user_id").primaryKey().references(() => users.id, { onDelete: "restrict" }),
  file_path: text("file_path").notNull(),
  nama_asli: text("nama_asli").notNull(),
  uploaded_at: text("uploaded_at").notNull().default(now),
});

export const taskLogCommits = sqliteTable(
  "task_log_commits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    task_log_id: integer("task_log_id").notNull().references(() => taskLogs.id, { onDelete: "cascade" }),
    commit_sha: text("commit_sha").notNull(),
    commit_url: text("commit_url").notNull(),
    pesan: text("pesan").notNull(),
    authored_at: text("authored_at").notNull(),
    ditambahkan_oleh: integer("ditambahkan_oleh").notNull().references(() => users.id, { onDelete: "restrict" }),
    created_at: text("created_at").notNull().default(now),
  },
  (t) => [unique().on(t.ditambahkan_oleh, t.commit_sha), index("idx_task_log_commits_task_log").on(t.task_log_id)],
);
