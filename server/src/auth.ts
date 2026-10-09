import { and, eq, lt, ne } from "drizzle-orm";
import { db, first, type Tx } from "./db";
import { sessions, userRoles, users } from "./schema";
import type { AuthContext, Role } from "./types";

const SESSION_DURATION_MS = Number(process.env.SESSION_DURATION_MS ?? 7 * 24 * 60 * 60 * 1000); // default 7 hari
export const SESSION_COOKIE = process.env.SESSION_COOKIE ?? "session";

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function hashToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

// Hash argon2id asli (bukan string sembarang) untuk email yang tidak terdaftar. String yang formatnya
// tidak valid ditolak verify dalam hitungan mikrodetik, sedangkan hash asli butuh ~200 ms, sehingga
// selisih waktunya membocorkan email mana yang terdaftar. Dibuat sekali per proses.
const dummyHash = Bun.password.hash(randomToken());

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; expiresAt: Date } | null> {
  const user = await db.select().from(users).where(eq(users.email, email)).then(first);

  // Selalu jalankan verify walau user/password_hash kosong supaya waktu respons
  // tidak membocorkan apakah email terdaftar (mitigasi timing/enumeration).
  const hash = user?.password_hash ?? (await dummyHash);
  const valid = await Bun.password.verify(password, hash).catch(() => false);

  if (!user?.password_hash || !valid) return null;

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({
    token_hash: hashToken(token),
    user_id: user.id,
    expires_at: expiresAt,
  });

  return { token, expiresAt };
}

export async function logout(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token_hash, hashToken(token)));
}

// Akhiri semua sesi user, misalnya setelah password diganti. `exceptToken` mempertahankan sesi yang
// sedang dipakai (admin yang mengganti password dirinya sendiri tidak ikut ter-logout).
export async function revokeUserSessions(userId: number, exceptToken?: string, runner: Tx | typeof db = db): Promise<void> {
  const byUser = eq(sessions.user_id, userId);
  await runner
    .delete(sessions)
    .where(exceptToken ? and(byUser, ne(sessions.token_hash, hashToken(exceptToken))) : byUser);
}

// Sesi kedaluwarsa hanya terhapus saat tokennya dipakai lagi; sisanya dibersihkan berkala (index.ts).
export async function pruneExpiredSessions(): Promise<number> {
  const deleted = await db.delete(sessions).where(lt(sessions.expires_at, new Date())).returning({ id: sessions.id });
  return deleted.length;
}

export async function getAuthContext(token: string | undefined): Promise<AuthContext | null> {
  if (!token) return null;

  const row = await db
    .select({ user: users, expires_at: sessions.expires_at })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.user_id))
    .where(eq(sessions.token_hash, hashToken(token)))
    .then(first);

  if (!row) return null;
  if (row.expires_at.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.token_hash, hashToken(token)));
    return null;
  }

  const roles = (await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.user_id, row.user.id))).map(
    (r) => r.role as Role,
  );

  return { user: row.user, roles };
}

export function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export function sessionCookie(token: string, expiresAt: Date): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
