import { z } from "zod/v4";
import { asc, and, eq } from "drizzle-orm";
import { db, isUniqueViolation, first } from "../db";
import { userRoles, users } from "../schema";
import { errorResponse, json } from "../http";
import { requireAdmin } from "../authz";
import type { Role } from "../types";

const ROLE_VALUES = ["tenaga_ahli", "supervisi", "atasan", "admin"] as const;

const userPayloadSchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi."),
  email: z.email("Email tidak valid."),
  password: z.string().min(8, "Password minimal 8 karakter.").optional(),
  roles: z.array(z.enum(ROLE_VALUES)).min(1, "Pilih minimal satu peran."),
  atasanId: z.number().int().positive().nullable(),
  supervisiId: z.number().int().positive().nullable(),
});

interface UserRow {
  id: number;
  nama: string;
  email: string;
  atasan_id: number | null;
  supervisi_id: number | null;
}

function publicUser(row: UserRow, roles: Role[]) {
  return {
    id: row.id,
    nama: row.nama,
    email: row.email,
    roles,
    atasanId: row.atasan_id,
    supervisiId: row.supervisi_id,
  };
}

const userColumns = {
  id: users.id,
  nama: users.nama,
  email: users.email,
  atasan_id: users.atasan_id,
  supervisi_id: users.supervisi_id,
};

async function getUserRow(id: number): Promise<UserRow | undefined> {
  return (await db.select(userColumns).from(users).where(eq(users.id, id)).then(first)) as UserRow | undefined;
}

async function hasRole(userId: number, role: Role): Promise<boolean> {
  const row = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.user_id, userId), eq(userRoles.role, role)))
    .then(first);
  return row !== undefined;
}

// Validasi peran atasan_id/supervisi_id lintas tabel (SQLite CHECK tidak bisa) — ADR-0036.
async function validateHierarchy(
  atasanId: number | null,
  supervisiId: number | null,
  selfId: number | null,
): Promise<string | null> {
  if (atasanId !== null) {
    if (atasanId === selfId) return "Atasan tidak boleh diri sendiri.";
    if (!(await hasRole(atasanId, "atasan"))) return "User yang dipilih sebagai atasan tidak berperan atasan.";
  }
  if (supervisiId !== null) {
    if (supervisiId === selfId) return "Supervisi tidak boleh diri sendiri.";
    if (!(await hasRole(supervisiId, "supervisi"))) return "User yang dipilih sebagai supervisi tidak berperan supervisi.";
  }
  return null;
}

export async function handleListUsers(req: Request): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  const userRows = (await db.select(userColumns).from(users).orderBy(asc(users.id))) as UserRow[];
  const roleRows = await db.select({ user_id: userRoles.user_id, role: userRoles.role }).from(userRoles);
  const rolesByUser = new Map<number, Role[]>();
  for (const r of roleRows) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  }

  return json({ users: userRows.map((u) => publicUser(u, rolesByUser.get(u.id) ?? [])) });
}

export async function handleCreateUser(req: Request): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = userPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");
  if (!parsed.data.password) return errorResponse(400, "Password wajib diisi.");

  const hierarchyError = await validateHierarchy(parsed.data.atasanId, parsed.data.supervisiId, null);
  if (hierarchyError) return errorResponse(400, hierarchyError);

  const passwordHash = await Bun.password.hash(parsed.data.password);

  let userId: number;
  try {
    userId = await db.transaction(async (tx) => {
      const [{ id }] = await tx
        .insert(users)
        .values({
          nama: parsed.data.nama,
          email: parsed.data.email,
          password_hash: passwordHash,
          atasan_id: parsed.data.atasanId,
          supervisi_id: parsed.data.supervisiId,
        })
        .returning({ id: users.id });
      await tx.insert(userRoles).values(parsed.data.roles.map((role) => ({ user_id: id, role })));
      return id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) return errorResponse(409, "Email sudah dipakai.");
    throw err;
  }

  const row = (await getUserRow(userId))!;
  return json({ user: publicUser(row, parsed.data.roles) }, { status: 201 });
}

export async function handleUpdateUser(req: Request, id: number): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(id)) return errorResponse(400, "ID tidak valid.");
  if (!(await getUserRow(id))) return errorResponse(404, "User tidak ditemukan.");

  const body = await req.json().catch(() => null);
  const parsed = userPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const hierarchyError = await validateHierarchy(parsed.data.atasanId, parsed.data.supervisiId, id);
  if (hierarchyError) return errorResponse(400, hierarchyError);

  const passwordHash = parsed.data.password ? await Bun.password.hash(parsed.data.password) : null;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          nama: parsed.data.nama,
          email: parsed.data.email,
          atasan_id: parsed.data.atasanId,
          supervisi_id: parsed.data.supervisiId,
          ...(passwordHash ? { password_hash: passwordHash } : {}),
        })
        .where(eq(users.id, id));
      await tx.delete(userRoles).where(eq(userRoles.user_id, id));
      await tx.insert(userRoles).values(parsed.data.roles.map((role) => ({ user_id: id, role })));
    });
  } catch (err) {
    if (isUniqueViolation(err)) return errorResponse(409, "Email sudah dipakai.");
    throw err;
  }

  const row = (await getUserRow(id))!;
  return json({ user: publicUser(row, parsed.data.roles) });
}
