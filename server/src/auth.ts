import { db } from "./db";
import type { AuthContext, Role, User } from "./types";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari
export const SESSION_COOKIE = "session";

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
  const user = db
    .query<User, [string]>("SELECT * FROM users WHERE email = ?")
    .get(email);

  // Selalu jalankan verify walau user/password_hash kosong supaya waktu respons
  // tidak membocorkan apakah email terdaftar (mitigasi timing/enumeration).
  const hash = user?.password_hash ?? "$argon2id$dummy$hash$untuk$timing$konsisten";
  const valid = await Bun.password.verify(password, hash).catch(() => false);

  if (!user?.password_hash || !valid) return null;

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  db.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(hashToken(token), user.id, expiresAt.toISOString());

  return { token, expiresAt };
}

export function logout(token: string): void {
  db.query("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function getAuthContext(token: string | undefined): AuthContext | null {
  if (!token) return null;

  const row = db
    .query<
      User & { expires_at: string },
      [string]
    >(
      `SELECT users.* , sessions.expires_at
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?`,
    )
    .get(hashToken(token));

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.query("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    return null;
  }

  const roles = db
    .query<{ role: Role }, [number]>(
      "SELECT role FROM user_roles WHERE user_id = ?",
    )
    .all(row.id)
    .map((r) => r.role);

  const { expires_at, ...user } = row;
  return { user, roles };
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
