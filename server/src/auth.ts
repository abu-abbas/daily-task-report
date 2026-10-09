import { eq } from "drizzle-orm";
import { db } from "./db";
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

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; expiresAt: Date } | null> {
  const user = await db.select().from(users).where(eq(users.email, email)).get();

  // Selalu jalankan verify walau user/password_hash kosong supaya waktu respons
  // tidak membocorkan apakah email terdaftar (mitigasi timing/enumeration).
  const hash = user?.password_hash ?? "$argon2id$dummy$hash$untuk$timing$konsisten";
  const valid = await Bun.password.verify(password, hash).catch(() => false);

  if (!user?.password_hash || !valid) return null;

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({
    token_hash: hashToken(token),
    user_id: user.id,
    expires_at: expiresAt.toISOString(),
  });

  return { token, expiresAt };
}

export async function logout(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token_hash, hashToken(token)));
}

export async function getAuthContext(token: string | undefined): Promise<AuthContext | null> {
  if (!token) return null;

  const row = await db
    .select({ user: users, expires_at: sessions.expires_at })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.user_id))
    .where(eq(sessions.token_hash, hashToken(token)))
    .get();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
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
