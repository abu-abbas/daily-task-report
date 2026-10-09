import { z } from "zod/v4";
import {
  clearSessionCookie,
  getAuthContext,
  login,
  logout,
  parseCookie,
  sessionCookie,
  SESSION_COOKIE,
} from "../auth";
import { requireLogin } from "../authz";
import type { AuthContext } from "../types";
import { errorResponse, json } from "../http";
import { loginEmailLimiter, loginIpLimiter } from "../rate-limit";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

function tooManyAttempts(retryAfter: number): Response {
  const res = errorResponse(429, "Terlalu banyak percobaan login gagal. Coba lagi nanti.");
  res.headers.set("Retry-After", String(retryAfter));
  return res;
}

// `ip` diisi app.ts dari koneksi (atau header proxy kalau TRUST_PROXY=1); kosong berarti batas
// per IP dilewati dan hanya batas per email yang berlaku.
export async function handleLogin(req: Request, ip?: string): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "Email atau password tidak valid.");

  const emailKey = parsed.data.email.toLowerCase();
  const retryAfter = Math.max(
    loginEmailLimiter.retryAfterSeconds(emailKey),
    ip ? loginIpLimiter.retryAfterSeconds(ip) : 0,
  );
  if (retryAfter > 0) return tooManyAttempts(retryAfter);

  const session = await login(parsed.data.email, parsed.data.password);
  if (!session) {
    loginEmailLimiter.recordFailure(emailKey);
    if (ip) loginIpLimiter.recordFailure(ip);
    return errorResponse(401, "Email atau password salah.");
  }
  loginEmailLimiter.reset(emailKey);

  const ctx = await getAuthContext(session.token);
  return json(
    { user: publicUser(ctx!) },
    { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } },
  );
}

export async function handleLogout(req: Request): Promise<Response> {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  if (token) await logout(token);
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

export async function handleMe(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;
  return json({ user: publicUser(ctx) });
}

function publicUser(ctx: AuthContext) {
  return {
    id: ctx.user.id,
    nama: ctx.user.nama,
    email: ctx.user.email,
    roles: ctx.roles,
    // Token GitLab TIDAK PERNAH dikirim ke client (ADR-0047) — cuma status koneksi buat
    // ditampilkan masked di UI ("terhubung sebagai @username").
    gitlabUsername: ctx.user.gitlab_username,
    gitlabAvatarUrl: ctx.user.gitlab_avatar_url,
    hasGitlabToken: ctx.user.gitlab_private_token !== null,
  };
}
