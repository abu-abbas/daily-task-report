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
}

function publicTask(row: TaskRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    deskripsi: row.deskripsi,
    tag: row.tag,
    status: row.status,
  };
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
      "SELECT id, project_id, deskripsi, tag, status FROM tasks WHERE project_id = ? AND status = 'open' ORDER BY deskripsi",
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

  const row = db
    .query<TaskRow, [number]>(
      "SELECT id, project_id, deskripsi, tag, status FROM tasks WHERE id = ?",
    )
    .get(Number(result.lastInsertRowid))!;
  return json({ task: publicTask(row) }, { status: 201 });
}
