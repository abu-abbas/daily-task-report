import { z } from "zod/v4";
import { db } from "../db";
import { errorResponse, json } from "../http";
import { requireAdmin } from "../authz";
import { getAuthContext, parseCookie, SESSION_COOKIE } from "../auth";

interface ProjectRow {
  id: number;
  nama: string;
  is_active: number;
}

interface MemberRow {
  id: number;
  nama: string;
}

function getActiveMembers(projectId: number): MemberRow[] {
  return db
    .query<MemberRow, [number]>(
      `SELECT users.id, users.nama
       FROM user_project
       JOIN users ON users.id = user_project.user_id
       WHERE user_project.project_id = ? AND user_project.ended_at IS NULL
       ORDER BY users.nama`,
    )
    .all(projectId);
}

function publicProject(row: ProjectRow) {
  return {
    id: row.id,
    nama: row.nama,
    isActive: row.is_active === 1,
    members: getActiveMembers(row.id),
  };
}

function getProjectRow(id: number): ProjectRow | null {
  return db.query<ProjectRow, [number]>("SELECT id, nama, is_active FROM projects WHERE id = ?").get(id);
}

const projectPayloadSchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi."),
  isActive: z.boolean(),
});

const memberPayloadSchema = z.object({
  userId: z.number().int().positive(),
});

export function handleListProjects(req: Request): Response {
  const ctx = requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  const rows = db.query<ProjectRow, []>("SELECT id, nama, is_active FROM projects ORDER BY id").all();
  return json({ projects: rows.map(publicProject) });
}

// Project yang diikuti user yang sedang login (keanggotaan aktif) — dipakai filter pilihan
// project di sidebar, dan nantinya Stage 3 untuk mencatat pekerjaan (ADR-0005).
export function handleListMyProjects(req: Request): Response {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const rows = db
    .query<ProjectRow, [number]>(
      `SELECT projects.id, projects.nama, projects.is_active
       FROM user_project
       JOIN projects ON projects.id = user_project.project_id
       WHERE user_project.user_id = ? AND user_project.ended_at IS NULL
       ORDER BY projects.nama`,
    )
    .all(ctx.user.id);
  return json({ projects: rows.map(publicProject) });
}

export async function handleCreateProject(req: Request): Promise<Response> {
  const ctx = requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = projectPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const result = db
    .query("INSERT INTO projects (nama, is_active) VALUES (?, ?)")
    .run(parsed.data.nama, parsed.data.isActive ? 1 : 0);
  const row = getProjectRow(Number(result.lastInsertRowid))!;
  return json({ project: publicProject(row) }, { status: 201 });
}

export async function handleUpdateProject(req: Request, id: number): Promise<Response> {
  const ctx = requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(id)) return errorResponse(400, "ID tidak valid.");
  if (!getProjectRow(id)) return errorResponse(404, "Project tidak ditemukan.");

  const body = await req.json().catch(() => null);
  const parsed = projectPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  db.query("UPDATE projects SET nama = ?, is_active = ? WHERE id = ?").run(
    parsed.data.nama,
    parsed.data.isActive ? 1 : 0,
    id,
  );
  return json({ project: publicProject(getProjectRow(id)!) });
}

// Tambah anggota. Kalau user sebelumnya pernah jadi anggota lalu keluar (ended_at terisi),
// aktifkan lagi baris yang sama (bukan baris baru) supaya histori lama tetap satu jejak,
// bukan menghapus/mengganda — sejalan dengan ADR-0034 (akses histori tidak boleh hilang).
export async function handleAddMember(req: Request, projectId: number): Promise<Response> {
  const ctx = requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(projectId)) return errorResponse(400, "ID tidak valid.");
  if (!getProjectRow(projectId)) return errorResponse(404, "Project tidak ditemukan.");

  const body = await req.json().catch(() => null);
  const parsed = memberPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const user = db.query<{ id: number }, [number]>("SELECT id FROM users WHERE id = ?").get(parsed.data.userId);
  if (!user) return errorResponse(404, "User tidak ditemukan.");

  const existing = db
    .query<{ ended_at: string | null }, [number, number]>(
      "SELECT ended_at FROM user_project WHERE user_id = ? AND project_id = ?",
    )
    .get(parsed.data.userId, projectId);

  if (existing && existing.ended_at === null) {
    return errorResponse(409, "User sudah menjadi anggota project ini.");
  }

  if (existing) {
    db.query("UPDATE user_project SET ended_at = NULL WHERE user_id = ? AND project_id = ?").run(
      parsed.data.userId,
      projectId,
    );
  } else {
    db.query("INSERT INTO user_project (user_id, project_id, ended_at) VALUES (?, ?, NULL)").run(
      parsed.data.userId,
      projectId,
    );
  }

  return json({ project: publicProject(getProjectRow(projectId)!) }, { status: 201 });
}

// Mengakhiri keanggotaan (ended_at = sekarang), bukan menghapus baris — histori realisasi
// milik user tetap terbaca setelah keluar project (ADR-0034).
export async function handleEndMembership(
  req: Request,
  projectId: number,
  userId: number,
): Promise<Response> {
  const ctx = requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(projectId) || !Number.isInteger(userId)) return errorResponse(400, "ID tidak valid.");

  const existing = db
    .query<{ ended_at: string | null }, [number, number]>(
      "SELECT ended_at FROM user_project WHERE user_id = ? AND project_id = ?",
    )
    .get(userId, projectId);
  if (!existing || existing.ended_at !== null) {
    return errorResponse(404, "Keanggotaan aktif tidak ditemukan.");
  }

  db.query(
    "UPDATE user_project SET ended_at = CURRENT_TIMESTAMP WHERE user_id = ? AND project_id = ?",
  ).run(userId, projectId);

  return json({ project: publicProject(getProjectRow(projectId)!) });
}
