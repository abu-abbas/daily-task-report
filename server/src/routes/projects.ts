import { z } from "zod/v4";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, type Tx, first } from "../db";
import { projects, tasks, userProject, users } from "../schema";
import { errorResponse, json } from "../http";
import { requireAdmin, requireLogin } from "../authz";

interface ProjectRow {
  id: number;
  nama: string;
  is_active: number;
  belum_direkonsiliasi: number;
}

interface MemberRow {
  id: number;
  nama: string;
}

async function getActiveMembers(projectId: number): Promise<MemberRow[]> {
  return db
    .select({ id: users.id, nama: users.nama })
    .from(userProject)
    .innerJoin(users, eq(users.id, userProject.user_id))
    .where(and(eq(userProject.project_id, projectId), isNull(userProject.ended_at)))
    .orderBy(asc(users.nama));
}

async function publicProject(row: ProjectRow) {
  return {
    id: row.id,
    nama: row.nama,
    isActive: row.is_active === 1,
    belumDirekonsiliasi: row.belum_direkonsiliasi === 1,
    members: await getActiveMembers(row.id),
  };
}

const projectColumns = {
  id: projects.id,
  nama: projects.nama,
  is_active: projects.is_active,
  belum_direkonsiliasi: projects.belum_direkonsiliasi,
};

async function getProjectRow(id: number): Promise<ProjectRow | undefined> {
  return db.select(projectColumns).from(projects).where(eq(projects.id, id)).then(first);
}

async function getMembership(userId: number, projectId: number): Promise<{ ended_at: string | null } | undefined> {
  return db
    .select({ ended_at: userProject.ended_at })
    .from(userProject)
    .where(and(eq(userProject.user_id, userId), eq(userProject.project_id, projectId)))
    .then(first);
}

// Dipakai handleAddMember (admin) dan handleMergeProject (ADR-0042, memindahkan anggota
// project usulan ke project tujuan) — satu sumber logika "aktifkan lagi baris lama, jangan
// menggandakan" (ADR-0034). Satu upsert atomik di primary key (user_id, project_id), jadi dua
// request bersamaan tidak bisa sama-sama lolos cek lalu menulis ganda.
async function activateMembership(tx: Tx | typeof db, userId: number, projectId: number): Promise<void> {
  await tx
    .insert(userProject)
    .values({ user_id: userId, project_id: projectId, ended_at: null })
    .onConflictDoUpdate({ target: [userProject.user_id, userProject.project_id], set: { ended_at: null } });
}

// Aturan inti ADR-0005: tenaga ahli hanya boleh bertindak (mencatat pekerjaan, dst.) pada
// project yang keanggotaannya aktif (ended_at NULL). Diekspor supaya endpoint pencatatan
// kerja (Stage 3) memanggil fungsi ini langsung alih-alih menulis ulang query yang sama —
// satu sumber kebenaran untuk "boleh/tidak boleh", bukan logic yang gampang lupa dipasang
// di satu endpoint tertentu.
export async function isActiveProjectMember(userId: number, projectId: number): Promise<boolean> {
  const row = await db
    .select({ user_id: userProject.user_id })
    .from(userProject)
    .where(and(eq(userProject.user_id, userId), eq(userProject.project_id, projectId), isNull(userProject.ended_at)))
    .then(first);
  return row !== undefined;
}

const projectPayloadSchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi."),
  isActive: z.boolean(),
});

const memberPayloadSchema = z.object({
  userId: z.number().int().positive(),
});

export async function handleListProjects(req: Request): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  const rows = await db.select(projectColumns).from(projects).orderBy(asc(projects.id));
  return json({ projects: await Promise.all(rows.map(publicProject)) });
}

// Project yang diikuti user yang sedang login (keanggotaan aktif) — dipakai filter pilihan
// project di sidebar, dan nantinya Stage 3 untuk mencatat pekerjaan (ADR-0005).
export async function handleListMyProjects(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select(projectColumns)
    .from(userProject)
    .innerJoin(projects, eq(projects.id, userProject.project_id))
    .where(and(eq(userProject.user_id, ctx.user.id), isNull(userProject.ended_at)))
    .orderBy(asc(projects.nama));
  return json({ projects: await Promise.all(rows.map(publicProject)) });
}

// Usulan "Lainnya" (ADR-0042) dibuat langsung di handleSaveDailyInput (server/src/routes/task-logs.ts),
// dalam transaksi yang sama dengan task & log-nya — bukan lewat endpoint terpisah di sini, supaya
// draft yang batal/di-refresh sebelum "Simpan" tidak menyisakan project nyantol tanpa task apa pun.

// Admin menyatakan usulan "Lainnya" sah berdiri sendiri sebagai project (ADR-0042). Rename
// project ini (kalau perlu) tetap lewat PUT /api/projects/:id yang sudah ada, bukan diulang di sini.
export async function handleConfirmProject(req: Request, id: number): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(id)) return errorResponse(400, "ID tidak valid.");
  const row = await getProjectRow(id);
  if (!row) return errorResponse(404, "Project tidak ditemukan.");
  if (row.belum_direkonsiliasi !== 1) return errorResponse(409, "Project ini bukan usulan yang menunggu rekonsiliasi.");

  await db.update(projects).set({ belum_direkonsiliasi: 0 }).where(eq(projects.id, id));
  return json({ project: await publicProject((await getProjectRow(id))!) });
}

const mergePayloadSchema = z.object({
  targetProjectId: z.number().int().positive(),
});

// Admin menggabungkan usulan "Lainnya" ke project existing yang ternyata sudah ada (ADR-0042):
// pindahkan task & keanggotaan ke project tujuan, lalu hapus project usulannya. Dibatasi ke
// project berflag belum_direkonsiliasi supaya jalur ini tidak dipakai menggabung project resmi
// mana pun sembarangan.
export async function handleMergeProject(req: Request, id: number): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(id)) return errorResponse(400, "ID tidak valid.");
  const source = await getProjectRow(id);
  if (!source) return errorResponse(404, "Project tidak ditemukan.");
  if (source.belum_direkonsiliasi !== 1) {
    return errorResponse(409, "Project ini bukan usulan yang menunggu rekonsiliasi.");
  }

  const body = await req.json().catch(() => null);
  const parsed = mergePayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  if (parsed.data.targetProjectId === id) return errorResponse(400, "Tidak bisa digabung ke project itu sendiri.");
  const target = await getProjectRow(parsed.data.targetProjectId);
  if (!target) return errorResponse(404, "Project tujuan tidak ditemukan.");

  const members = await getActiveMembers(id);

  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ project_id: target.id }).where(eq(tasks.project_id, id));
    for (const member of members) await activateMembership(tx, member.id, target.id);
    await tx.delete(projects).where(eq(projects.id, id));
  });

  return json({ project: await publicProject((await getProjectRow(target.id))!) });
}

export async function handleCreateProject(req: Request): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = projectPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const [row] = await db
    .insert(projects)
    .values({ nama: parsed.data.nama, is_active: parsed.data.isActive ? 1 : 0 })
    .returning(projectColumns);
  return json({ project: await publicProject(row!) }, { status: 201 });
}

export async function handleUpdateProject(req: Request, id: number): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(id)) return errorResponse(400, "ID tidak valid.");
  if (!(await getProjectRow(id))) return errorResponse(404, "Project tidak ditemukan.");

  const body = await req.json().catch(() => null);
  const parsed = projectPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  await db
    .update(projects)
    .set({ nama: parsed.data.nama, is_active: parsed.data.isActive ? 1 : 0 })
    .where(eq(projects.id, id));
  return json({ project: await publicProject((await getProjectRow(id))!) });
}

// Tambah anggota. Kalau user sebelumnya pernah jadi anggota lalu keluar (ended_at terisi),
// aktifkan lagi baris yang sama (bukan baris baru) supaya histori lama tetap satu jejak,
// bukan menghapus/mengganda — sejalan dengan ADR-0034 (akses histori tidak boleh hilang).
export async function handleAddMember(req: Request, projectId: number): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(projectId)) return errorResponse(400, "ID tidak valid.");
  if (!(await getProjectRow(projectId))) return errorResponse(404, "Project tidak ditemukan.");

  const body = await req.json().catch(() => null);
  const parsed = memberPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const user = await db.select({ id: users.id }).from(users).where(eq(users.id, parsed.data.userId)).then(first);
  if (!user) return errorResponse(404, "User tidak ditemukan.");

  const existing = await getMembership(parsed.data.userId, projectId);

  if (existing && existing.ended_at === null) {
    return errorResponse(409, "User sudah menjadi anggota project ini.");
  }

  await activateMembership(db, parsed.data.userId, projectId);

  return json({ project: await publicProject((await getProjectRow(projectId))!) }, { status: 201 });
}

// Mengakhiri keanggotaan (ended_at = sekarang), bukan menghapus baris — histori realisasi
// milik user tetap terbaca setelah keluar project (ADR-0034).
export async function handleEndMembership(
  req: Request,
  projectId: number,
  userId: number,
): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(projectId) || !Number.isInteger(userId)) return errorResponse(400, "ID tidak valid.");

  const existing = await getMembership(userId, projectId);
  if (!existing || existing.ended_at !== null) {
    return errorResponse(404, "Keanggotaan aktif tidak ditemukan.");
  }

  await db
    .update(userProject)
    .set({ ended_at: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(userProject.user_id, userId), eq(userProject.project_id, projectId)));

  return json({ project: await publicProject((await getProjectRow(projectId))!) });
}
