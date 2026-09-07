import { z } from "zod/v4";
import { db } from "../db";
import { errorResponse, json } from "../http";
import { getAuthContext, parseCookie, SESSION_COOKIE } from "../auth";
import { previousWorkday, todayJakarta } from "../kalender";
import { isActiveProjectMember } from "./projects";

interface ChecklistRow {
  taskId: number;
  deskripsi: string;
  tag: string | null;
  projectId: number;
  projectNama: string;
}

// Checklist realisasi hari ini = rencana milik user pada hari kerja sebelumnya (ADR-0006).
// Rencana yang diisi hari ini bertanggal hari ini juga (tanggal laporan), bukan besok — satu
// submit boleh berisi realisasi kemarin dan rencana hari ini sekaligus (ADR-0007). Kerjaan
// tambahan/rencana memakai tabel yang sama, dibedakan lewat jenis/is_extra.
// tanggalOverride: hanya dipakai test untuk mensimulasikan "hari ini" tertentu tanpa
// bergantung pada tanggal asli saat test dijalankan. Route asli (index.ts) memanggil tanpa
// argumen ini, selalu memakai todayJakarta() sungguhan.
export function handleGetTodayInput(req: Request, tanggalOverride?: string): Response {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const tanggal = tanggalOverride ?? todayJakarta();
  const hariKerjaSebelumnya = previousWorkday(tanggal);

  const checklistRows = db
    .query<ChecklistRow, [number, string]>(
      `SELECT tl.task_id AS taskId, t.deskripsi, t.tag, t.project_id AS projectId, p.nama AS projectNama
       FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE tl.user_id = ? AND tl.tanggal = ? AND tl.jenis = 'rencana'
       ORDER BY t.deskripsi`,
    )
    .all(ctx.user.id, hariKerjaSebelumnya);

  const realisasiRows = db
    .query<{ taskId: number; catatan: string | null; isExtra: number }, [number, string]>(
      `SELECT task_id AS taskId, catatan, is_extra AS isExtra FROM task_logs
       WHERE user_id = ? AND tanggal = ? AND jenis = 'realisasi'`,
    )
    .all(ctx.user.id, hariKerjaSebelumnya);
  const realisasiByTask = new Map(
    realisasiRows.filter((r) => r.isExtra === 0).map((r) => [r.taskId, r.catatan]),
  );

  const checklist = checklistRows.map((r) => ({ ...r, realisasiCatatan: realisasiByTask.get(r.taskId) ?? null }));

  const tambahan = db
    .query<ChecklistRow & { catatan: string | null }, [number, string]>(
      `SELECT tl.task_id AS taskId, tl.catatan, t.deskripsi, t.tag, t.project_id AS projectId, p.nama AS projectNama
       FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE tl.user_id = ? AND tl.tanggal = ? AND tl.jenis = 'realisasi' AND tl.is_extra = 1
       ORDER BY t.deskripsi`,
    )
    .all(ctx.user.id, hariKerjaSebelumnya);

  const rencanaHariIni = db
    .query<ChecklistRow, [number, string]>(
      `SELECT tl.task_id AS taskId, t.deskripsi, t.tag, t.project_id AS projectId, p.nama AS projectNama
       FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE tl.user_id = ? AND tl.tanggal = ? AND tl.jenis = 'rencana'
       ORDER BY t.deskripsi`,
    )
    .all(ctx.user.id, tanggal);

  return json({ tanggal, hariKerjaSebelumnya, checklist, tambahan, rencanaHariIni });
}

// projectBaru (bukan projectId): usulan project "Lainnya" (ADR-0042) dibuat di saveItem()
// dalam transaksi yang sama dengan task-nya, bukan lebih dulu secara terpisah lewat
// /projects/usulan — supaya draft yang batal/di-refresh sebelum "Simpan" tidak menyisakan
// project nyantol tanpa task/catatan apa pun (simpan tetap semua-atau-tidak-sama-sekali).
const newTaskSchema = z
  .object({
    projectId: z.number().int().positive().optional(),
    projectBaru: z.string().min(1).optional(),
    deskripsi: z.string().min(1, "Deskripsi task wajib diisi."),
    tag: z.string().optional(),
  })
  .refine((v) => (v.projectId !== undefined) !== (v.projectBaru !== undefined), {
    message: "Isi salah satu: projectId atau projectBaru pada newTask.",
  });

const logItemSchema = z
  .object({
    taskId: z.number().int().positive().optional(),
    newTask: newTaskSchema.optional(),
    jenis: z.enum(["rencana", "realisasi"]),
    catatan: z.string().optional(),
    isExtra: z.boolean().optional(),
  })
  .refine((v) => (v.taskId !== undefined) !== (v.newTask !== undefined), {
    message: "Isi salah satu: taskId atau newTask.",
  });

const saveInputSchema = z.object({
  items: z.array(logItemSchema).min(1, "Minimal satu item."),
});

type LogItem = z.infer<typeof logItemSchema>;

function getTaskProjectId(taskId: number): number | null {
  const row = db.query<{ project_id: number }, [number]>("SELECT project_id FROM tasks WHERE id = ?").get(taskId);
  return row?.project_id ?? null;
}

function upsertTaskLog(
  userId: number,
  taskId: number,
  tanggal: string,
  jenis: "rencana" | "realisasi",
  catatan: string | null,
  isExtra: boolean,
): void {
  // ADR-0041: satu baris per (user_id, task_id, tanggal, jenis) — submit ulang meng-update,
  // bukan menggandakan.
  const existing = db
    .query<{ id: number }, [number, number, string, string]>(
      "SELECT id FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = ?",
    )
    .get(userId, taskId, tanggal, jenis);

  if (existing) {
    db.query("UPDATE task_logs SET catatan = ?, is_extra = ? WHERE id = ?").run(
      catatan,
      isExtra ? 1 : 0,
      existing.id,
    );
  } else {
    db.query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan, is_extra) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(taskId, userId, tanggal, jenis, catatan, isExtra ? 1 : 0);
  }
}

export async function handleSaveTodayInput(req: Request, tanggalOverride?: string): Promise<Response> {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const body = await req.json().catch(() => null);
  const parsed = saveInputSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const tanggal = tanggalOverride ?? todayJakarta();
  const hariKerjaSebelumnya = previousWorkday(tanggal);

  // Validasi seluruh item DULU sebelum menulis apa pun — kegagalan satu bagian tidak boleh
  // menyisakan simpan parsial (cakupan Stage 3). projectBaru dilewati di sini: project dan
  // keanggotaannya baru dibuat (dan otomatis sah) di saveItem(), belum ada project_id untuk dicek.
  for (const item of parsed.data.items) {
    if (item.jenis === "realisasi" && !item.catatan?.trim()) {
      return errorResponse(400, "Catatan hasil wajib diisi untuk realisasi.");
    }
    if (item.newTask?.projectBaru !== undefined) continue;
    const projectId = item.newTask?.projectId ?? getTaskProjectId(item.taskId!);
    if (projectId === null) return errorResponse(404, "Task tidak ditemukan.");
    if (!isActiveProjectMember(ctx.user.id, projectId)) {
      return errorResponse(403, "Bukan anggota aktif project ini.");
    }
  }

  // ADR-0042: usulan "Lainnya" dibuat di sini, dalam transaksi yang sama dengan task & log-nya
  // (bukan lebih dulu lewat endpoint terpisah) — supaya project baru tidak pernah nyantol tanpa
  // task/catatan kalau submit ini gagal atau dibatalkan.
  function resolveProjectId(newTask: NonNullable<LogItem["newTask"]>): number {
    if (newTask.projectId !== undefined) return newTask.projectId;
    const result = db
      .query("INSERT INTO projects (nama, is_active, belum_direkonsiliasi) VALUES (?, 1, 1)")
      .run(newTask.projectBaru!);
    const projectId = Number(result.lastInsertRowid);
    db.query("INSERT INTO user_project (user_id, project_id, ended_at) VALUES (?, ?, NULL)").run(
      ctx!.user.id,
      projectId,
    );
    return projectId;
  }

  function saveItem(item: LogItem) {
    let taskId = item.taskId;
    if (taskId === undefined && item.newTask) {
      const projectId = resolveProjectId(item.newTask);
      const result = db
        .query("INSERT INTO tasks (project_id, deskripsi, tag) VALUES (?, ?, ?)")
        .run(projectId, item.newTask.deskripsi, item.newTask.tag ?? null);
      taskId = Number(result.lastInsertRowid);
    }
    const tanggalItem = item.jenis === "realisasi" ? hariKerjaSebelumnya : tanggal;
    upsertTaskLog(ctx!.user.id, taskId!, tanggalItem, item.jenis, item.catatan?.trim() || null, item.isExtra ?? false);
  }

  db.transaction(() => {
    for (const item of parsed.data.items) saveItem(item);
  })();

  return json({ tanggal, hariKerjaSebelumnya });
}
