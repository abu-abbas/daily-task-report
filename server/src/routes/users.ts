import { z } from "zod/v4";
import { db } from "../db";
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

function getUserRow(id: number): UserRow | null {
  return db
    .query<UserRow, [number]>(
      "SELECT id, nama, email, atasan_id, supervisi_id FROM users WHERE id = ?",
    )
    .get(id);
}

// Validasi peran atasan_id/supervisi_id lintas tabel (SQLite CHECK tidak bisa) — ADR-0036.
function validateHierarchy(
  atasanId: number | null,
  supervisiId: number | null,
  selfId: number | null,
): string | null {
  if (atasanId !== null) {
    if (atasanId === selfId) return "Atasan tidak boleh diri sendiri.";
    const target = db
      .query<{ role: Role }, [number]>(
        "SELECT role FROM user_roles WHERE user_id = ? AND role = 'atasan'",
      )
      .get(atasanId);
    if (!target) return "User yang dipilih sebagai atasan tidak berperan atasan.";
  }
  if (supervisiId !== null) {
    if (supervisiId === selfId) return "Supervisi tidak boleh diri sendiri.";
    const target = db
      .query<{ role: Role }, [number]>(
        "SELECT role FROM user_roles WHERE user_id = ? AND role = 'supervisi'",
      )
      .get(supervisiId);
    if (!target) return "User yang dipilih sebagai supervisi tidak berperan supervisi.";
  }
  return null;
}

export function handleListUsers(req: Request): Response {
  const ctx = requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  const users = db
    .query<UserRow, []>("SELECT id, nama, email, atasan_id, supervisi_id FROM users ORDER BY id")
    .all();
  const roleRows = db.query<{ user_id: number; role: Role }, []>("SELECT user_id, role FROM user_roles").all();
  const rolesByUser = new Map<number, Role[]>();
  for (const r of roleRows) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  }

  return json({ users: users.map((u) => publicUser(u, rolesByUser.get(u.id) ?? [])) });
}

export async function handleCreateUser(req: Request): Promise<Response> {
  const ctx = requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = userPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");
  if (!parsed.data.password) return errorResponse(400, "Password wajib diisi.");

  const hierarchyError = validateHierarchy(parsed.data.atasanId, parsed.data.supervisiId, null);
  if (hierarchyError) return errorResponse(400, hierarchyError);

  const passwordHash = await Bun.password.hash(parsed.data.password);

  let userId: number;
  try {
    userId = db.transaction(() => {
      const result = db
        .query(
          "INSERT INTO users (nama, email, password_hash, atasan_id, supervisi_id) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          parsed.data.nama,
          parsed.data.email,
          passwordHash,
          parsed.data.atasanId,
          parsed.data.supervisiId,
        );
      const id = Number(result.lastInsertRowid);
      const insertRole = db.query("INSERT INTO user_roles (user_id, role) VALUES (?, ?)");
      for (const role of parsed.data.roles) insertRole.run(id, role);
      return id;
    })();
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) return errorResponse(409, "Email sudah dipakai.");
    throw err;
  }

  const row = getUserRow(userId)!;
  return json({ user: publicUser(row, parsed.data.roles) }, { status: 201 });
}

export async function handleUpdateUser(req: Request, id: number): Promise<Response> {
  const ctx = requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(id)) return errorResponse(400, "ID tidak valid.");
  if (!getUserRow(id)) return errorResponse(404, "User tidak ditemukan.");

  const body = await req.json().catch(() => null);
  const parsed = userPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const hierarchyError = validateHierarchy(parsed.data.atasanId, parsed.data.supervisiId, id);
  if (hierarchyError) return errorResponse(400, hierarchyError);

  const passwordHash = parsed.data.password ? await Bun.password.hash(parsed.data.password) : null;

  try {
    db.transaction(() => {
      if (passwordHash) {
        db.query(
          "UPDATE users SET nama = ?, email = ?, password_hash = ?, atasan_id = ?, supervisi_id = ? WHERE id = ?",
        ).run(parsed.data.nama, parsed.data.email, passwordHash, parsed.data.atasanId, parsed.data.supervisiId, id);
      } else {
        db.query(
          "UPDATE users SET nama = ?, email = ?, atasan_id = ?, supervisi_id = ? WHERE id = ?",
        ).run(parsed.data.nama, parsed.data.email, parsed.data.atasanId, parsed.data.supervisiId, id);
      }
      db.query("DELETE FROM user_roles WHERE user_id = ?").run(id);
      const insertRole = db.query("INSERT INTO user_roles (user_id, role) VALUES (?, ?)");
      for (const role of parsed.data.roles) insertRole.run(id, role);
    })();
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) return errorResponse(409, "Email sudah dipakai.");
    throw err;
  }

  const row = getUserRow(id)!;
  return json({ user: publicUser(row, parsed.data.roles) });
}
