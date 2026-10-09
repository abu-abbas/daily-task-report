import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Skema PostgreSQL (ADR-0049 tahap 3) — sumber kebenaran skema sejak pindah dari SQLite.
// Migration dihasilkan dari file ini dengan `bun run db:generate` (drizzle-kit) ke
// docs/schema/postgres/, lalu dijalankan `bun run migrate`. Rangkaian migration SQLite lama
// (0001–0009) diarsipkan di docs/schema/sqlite-arsip/ sebagai jejak keputusan ADR-0036 dkk.
//
// Nama properti sengaja sama dengan nama kolom (snake_case) supaya baris hasil query cocok
// dengan tipe yang sudah ada (types.ts, tipe row di tiap route).
//
// Pemetaan tipe dari SQLite:
// - id INTEGER AUTOINCREMENT → integer GENERATED ALWAYS AS IDENTITY.
// - tanggal bisnis (YYYY-MM-DD, ADR-0032) → date, dibaca/ditulis sebagai string "YYYY-MM-DD"
//   supaya tidak pernah lewat konversi zona waktu.
// - waktu teknis (created_at, expires_at, dst) → timestamptz.
// - flag 0/1 (is_active, is_extra, dst) tetap integer 0/1: perilaku API dan kode yang sudah
//   ada tidak perlu berubah, dan CHECK menjaga nilainya tetap 0/1.

const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
const flag = (name: string, defaultValue: 0 | 1) => integer(name).notNull().default(defaultValue);

export const users = pgTable(
  "users",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    nama: text("nama").notNull(),
    email: text("email").unique(),
    password_hash: text("password_hash"),
    atasan_id: integer("atasan_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    supervisi_id: integer("supervisi_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    created_at: createdAt(),
    gitlab_username: text("gitlab_username"),
    gitlab_avatar_url: text("gitlab_avatar_url"),
    gitlab_private_token: text("gitlab_private_token"),
  },
  (t) => [
    check("users_atasan_bukan_diri_sendiri", sql`${t.atasan_id} IS NULL OR ${t.atasan_id} <> ${t.id}`),
    check("users_supervisi_bukan_diri_sendiri", sql`${t.supervisi_id} IS NULL OR ${t.supervisi_id} <> ${t.id}`),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["tenaga_ahli", "supervisi", "atasan", "admin"] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.role] }),
    check("user_roles_role", sql`${t.role} IN ('tenaga_ahli', 'supervisi', 'atasan', 'admin')`),
  ],
);

export const sessions = pgTable("sessions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  token_hash: text("token_hash").notNull().unique(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires_at: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  created_at: createdAt(),
});

export const projects = pgTable(
  "projects",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    nama: text("nama").notNull(),
    is_active: flag("is_active", 1),
    created_at: createdAt(),
    belum_direkonsiliasi: flag("belum_direkonsiliasi", 0),
  },
  (t) => [
    check("projects_is_active_flag", sql`${t.is_active} IN (0, 1)`),
    check("projects_belum_direkonsiliasi_flag", sql`${t.belum_direkonsiliasi} IN (0, 1)`),
  ],
);

export const userProject = pgTable(
  "user_project",
  {
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    project_id: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ended_at: timestamp("ended_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.project_id] })],
);

export const tasks = pgTable(
  "tasks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    project_id: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    deskripsi: text("deskripsi").notNull(),
    tag: text("tag"),
    status: text("status", { enum: ["open", "closed"] })
      .notNull()
      .default("open"),
    deskripsi_penutupan: text("deskripsi_penutupan"),
    created_at: createdAt(),
  },
  (t) => [check("tasks_status", sql`${t.status} IN ('open', 'closed')`)],
);

export const taskLogs = pgTable(
  "task_logs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    task_id: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    tanggal: date("tanggal", { mode: "string" }).notNull(),
    jenis: text("jenis", { enum: ["rencana", "realisasi"] }).notNull(),
    catatan: text("catatan"),
    is_extra: flag("is_extra", 0),
    created_at: createdAt(),
  },
  (t) => [
    index("idx_task_logs_user_tanggal").on(t.user_id, t.tanggal, t.jenis),
    index("idx_task_logs_task").on(t.task_id),
    check("task_logs_jenis", sql`${t.jenis} IN ('rencana', 'realisasi')`),
    check("task_logs_is_extra_flag", sql`${t.is_extra} IN (0, 1)`),
  ],
);

export const kendala = pgTable(
  "kendala",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    task_log_id: integer("task_log_id")
      .notNull()
      .references(() => taskLogs.id, { onDelete: "cascade" }),
    deskripsi: text("deskripsi").notNull(),
    status: text("status", { enum: ["open", "resolved"] })
      .notNull()
      .default("open"),
    created_at: createdAt(),
  },
  (t) => [check("kendala_status", sql`${t.status} IN ('open', 'resolved')`)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    attachable_type: text("attachable_type").notNull(),
    attachable_id: integer("attachable_id").notNull(),
    file_path: text("file_path").notNull(),
    file_type: text("file_type"),
    uploaded_by: integer("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    uploaded_at: timestamp("uploaded_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    nama_asli: text("nama_asli").notNull().default(""),
    ukuran_bytes: integer("ukuran_bytes").notNull().default(0),
  },
  (t) => [index("idx_attachments_morph").on(t.attachable_type, t.attachable_id)],
);

export const leaves = pgTable(
  "leaves",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    tanggal: date("tanggal", { mode: "string" }).notNull(),
    jenis: text("jenis", { enum: ["cuti", "sakit", "izin"] }).notNull(),
    alasan: text("alasan"),
    potong_cuti_tahunan: integer("potong_cuti_tahunan"),
    created_at: createdAt(),
  },
  (t) => [
    index("idx_leaves_user_tanggal").on(t.user_id, t.tanggal),
    check("leaves_jenis", sql`${t.jenis} IN ('cuti', 'sakit', 'izin')`),
  ],
);

export const holidays = pgTable(
  "holidays",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    nama: text("nama").notNull(),
    tanggal_mulai: date("tanggal_mulai", { mode: "string" }).notNull(),
    tanggal_akhir: date("tanggal_akhir", { mode: "string" }).notNull(),
  },
  (t) => [
    index("idx_holidays_rentang").on(t.tanggal_mulai, t.tanggal_akhir),
    check("holidays_rentang", sql`${t.tanggal_akhir} >= ${t.tanggal_mulai}`),
  ],
);

export const saranBulanan = pgTable(
  "saran_bulanan",
  {
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    bulan: text("bulan").notNull(),
    isi: text("isi").notNull().default(""),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.bulan] })],
);

export const laporanTemplate = pgTable("laporan_template", {
  user_id: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "restrict" }),
  file_path: text("file_path").notNull(),
  nama_asli: text("nama_asli").notNull(),
  uploaded_at: timestamp("uploaded_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const taskLogCommits = pgTable(
  "task_log_commits",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    task_log_id: integer("task_log_id")
      .notNull()
      .references(() => taskLogs.id, { onDelete: "cascade" }),
    commit_sha: text("commit_sha").notNull(),
    commit_url: text("commit_url").notNull(),
    pesan: text("pesan").notNull(),
    authored_at: timestamp("authored_at", { withTimezone: true, mode: "string" }).notNull(),
    ditambahkan_oleh: integer("ditambahkan_oleh")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    created_at: createdAt(),
  },
  (t) => [unique().on(t.ditambahkan_oleh, t.commit_sha), index("idx_task_log_commits_task_log").on(t.task_log_id)],
);
