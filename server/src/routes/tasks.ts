import { requireLogin } from "../authz";
import { z } from "zod/v4";
import { and, asc, eq, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, first } from "../db";
import { taskLogs, tasks } from "../schema";
import { errorResponse, json } from "../http";
import { isActiveProjectMember } from "./projects";

interface TaskRow {
  id: number;
  project_id: number;
  deskripsi: string;
  tag: string | null;
  status: string;
  deskripsi_penutupan: string | null;
}

const taskColumns = {
  id: tasks.id,
  project_id: tasks.project_id,
  deskripsi: tasks.deskripsi,
  tag: tasks.tag,
  status: tasks.status,
  deskripsi_penutupan: tasks.deskripsi_penutupan,
};

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

async function getTask(taskId: number): Promise<TaskRow | undefined> {
  return db.select(taskColumns).from(tasks).where(eq(tasks.id, taskId)).then(first);
}

// Task tidak punya pemilik tetap (ADR-0010); dibaca-tulis siapa pun anggota aktif project-nya
// (ADR-0005) — bukan cuma admin, karena ini bagian pengisian kerja tenaga ahli sehari-hari.
export async function handleListTasks(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const projectId = Number(url.searchParams.get("projectId"));
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return errorResponse(400, "projectId wajib diisi.");
  }
  if (!(await isActiveProjectMember(ctx.user.id, projectId))) {
    return errorResponse(403, "Bukan anggota aktif project ini.");
  }

  const rows = await db
    .select(taskColumns)
    .from(tasks)
    .where(and(eq(tasks.project_id, projectId), eq(tasks.status, "open")))
    .orderBy(asc(tasks.deskripsi));
  return json({ tasks: rows.map(publicTask) });
}

const createTaskSchema = z.object({
  projectId: z.number().int().positive(),
  deskripsi: z.string().min(1, "Deskripsi wajib diisi."),
  tag: z.string().optional(),
});

export async function handleCreateTask(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  if (!(await isActiveProjectMember(ctx.user.id, parsed.data.projectId))) {
    return errorResponse(403, "Bukan anggota aktif project ini.");
  }

  const [row] = await db
    .insert(tasks)
    .values({ project_id: parsed.data.projectId, deskripsi: parsed.data.deskripsi, tag: parsed.data.tag ?? null })
    .returning(taskColumns);
  return json({ task: publicTask(row!) }, { status: 201 });
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
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => ({}));
  const parsed = closeTaskSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const task = await getTask(taskId);
  if (!task) return errorResponse(404, "Task tidak ditemukan.");
  if (!(await isActiveProjectMember(ctx.user.id, task.project_id))) {
    return errorResponse(403, "Bukan anggota aktif project ini.");
  }
  if (task.status === "closed") return errorResponse(409, "Task sudah ditutup.");

  const deskripsiPenutupan = parsed.data.deskripsiPenutupan?.trim() || null;

  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ status: "closed", deskripsi_penutupan: deskripsiPenutupan }).where(eq(tasks.id, taskId));

    // ADR-0009: catatan hasil realisasi wajib diisi. Prioritas: deskripsi penutupan yang baru
    // diisi > catatan rencana yang sudah ada duluan (jangan sampai checklist/notes yang sudah
    // ditulis tertimpa jadi generik) > fallback generik kalau memang keduanya kosong.
    const realisasi = alias(taskLogs, "r");
    const belumRealisasi = await tx
      .select({ userId: taskLogs.user_id, tanggal: taskLogs.tanggal, rencanaCatatan: taskLogs.catatan })
      .from(taskLogs)
      .where(
        and(
          eq(taskLogs.task_id, taskId),
          eq(taskLogs.jenis, "rencana"),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(realisasi)
              .where(
                and(
                  eq(realisasi.task_id, taskLogs.task_id),
                  eq(realisasi.user_id, taskLogs.user_id),
                  eq(realisasi.jenis, "realisasi"),
                  eq(realisasi.tanggal, taskLogs.tanggal),
                ),
              ),
          ),
        ),
      );

    for (const row of belumRealisasi) {
      const catatan = deskripsiPenutupan ?? row.rencanaCatatan ?? "Task ditutup.";
      await tx
        .insert(taskLogs)
        .values({ task_id: taskId, user_id: row.userId, tanggal: row.tanggal, jenis: "realisasi", catatan, is_extra: 0 });
    }
  });

  return json({ task: publicTask((await getTask(taskId))!) });
}
