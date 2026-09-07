import { z } from "zod/v4";
import { db } from "../db";
import { errorResponse, json } from "../http";
import { getAuthContext, parseCookie, SESSION_COOKIE } from "../auth";
import { isActiveProjectMember } from "./projects";

interface TaskRow {
  id: number;
  project_id: number;
  deskripsi: string;
  tag: string | null;
  status: string;
  deskripsi_penutupan: string | null;
}

const TASK_COLUMNS = "id, project_id, deskripsi, tag, status, deskripsi_penutupan";

function publicTask(row: TaskRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    deskripsi: row.deskripsi,
    tag: row.tag,
    status: row.status,
    deskripsiPenutupan: row.deskripsi_penutupan,
  };
}

function getTask(taskId: number): TaskRow | null {
  return db.query<TaskRow, [number]>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(taskId);
}

// Task tidak punya pemilik tetap (ADR-0010); dibaca-tulis siapa pun anggota aktif project-nya
// (ADR-0005) — bukan cuma admin, karena ini bagian pengisian kerja tenaga ahli sehari-hari.
export function handleListTasks(req: Request): Response {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const url = new URL(req.url);
  const projectId = Number(url.searchParams.get("projectId"));
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return errorResponse(400, "projectId wajib diisi.");
  }
  if (!isActiveProjectMember(ctx.user.id, projectId)) {
    return errorResponse(403, "Bukan anggota aktif project ini.");
  }

  const rows = db
    .query<TaskRow, [number]>(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE project_id = ? AND status = 'open' ORDER BY deskripsi`,
    )
    .all(projectId);
  return json({ tasks: rows.map(publicTask) });
}

const createTaskSchema = z.object({
  projectId: z.number().int().positive(),
  deskripsi: z.string().min(1, "Deskripsi wajib diisi."),
  tag: z.string().optional(),
});

export async function handleCreateTask(req: Request): Promise<Response> {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const body = await req.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  if (!isActiveProjectMember(ctx.user.id, parsed.data.projectId)) {
    return errorResponse(403, "Bukan anggota aktif project ini.");
  }

  const result = db
    .query("INSERT INTO tasks (project_id, deskripsi, tag) VALUES (?, ?, ?)")
    .run(parsed.data.projectId, parsed.data.deskripsi, parsed.data.tag ?? null);

  const row = getTask(Number(result.lastInsertRowid))!;
  return json({ task: publicTask(row) }, { status: 201 });
}

const closeTaskSchema = z.object({
  deskripsiPenutupan: z.string().optional(),
});

// ADR-0012/Q-04 (revisi): siapa pun anggota aktif project-nya boleh menutup (task tanpa pemilik
// tetap, konsisten ADR-0010/ADR-0005). Tidak ada reopen (YAGNI, belum dibutuhkan). Rencana yang
// belum direalisasi di task ini DIKONVERSI jadi realisasi (bukan dihapus, koreksi dari revisi
// awal) — menutup task berarti pekerjaan yang direncanakan dianggap selesai/terealisasi, bukan
// batal begitu saja; deskripsi penutupan dipakai sebagai catatan hasilnya.
export async function handleCloseTask(req: Request, taskId: number): Promise<Response> {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const body = await req.json().catch(() => ({}));
  const parsed = closeTaskSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const task = getTask(taskId);
  if (!task) return errorResponse(404, "Task tidak ditemukan.");
  if (!isActiveProjectMember(ctx.user.id, task.project_id)) {
    return errorResponse(403, "Bukan anggota aktif project ini.");
  }
  if (task.status === "closed") return errorResponse(409, "Task sudah ditutup.");

  const deskripsiPenutupan = parsed.data.deskripsiPenutupan?.trim() || null;
  // ADR-0009: catatan hasil realisasi wajib diisi — deskripsi penutupan jadi catatannya kalau
  // ada, kalau tidak diisi tetap butuh catatan generik (bukan kosong).
  const catatanRealisasi = deskripsiPenutupan ?? "Task ditutup.";

  db.transaction(() => {
    db.query("UPDATE tasks SET status = 'closed', deskripsi_penutupan = ? WHERE id = ?").run(
      deskripsiPenutupan,
      taskId,
    );

    const belumRealisasi = db
      .query<{ userId: number; tanggal: string }, [number]>(
        `SELECT tl.user_id AS userId, tl.tanggal FROM task_logs tl
         WHERE tl.task_id = ? AND tl.jenis = 'rencana'
         AND NOT EXISTS (
           SELECT 1 FROM task_logs r
           WHERE r.task_id = tl.task_id AND r.user_id = tl.user_id AND r.jenis = 'realisasi' AND r.tanggal = tl.tanggal
         )`,
      )
      .all(taskId);

    for (const row of belumRealisasi) {
      db.query(
        "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan, is_extra) VALUES (?, ?, ?, 'realisasi', ?, 0)",
      ).run(taskId, row.userId, row.tanggal, catatanRealisasi);
    }
  })();

  return json({ task: publicTask(getTask(taskId)!) });
}
