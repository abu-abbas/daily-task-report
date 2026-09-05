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
import { errorResponse, json } from "../http";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function handleLogin(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "Email atau password tidak valid.");

  const session = await login(parsed.data.email, parsed.data.password);
  if (!session) return errorResponse(401, "Email atau password salah.");

  const ctx = getAuthContext(session.token);
  return json(
    { user: publicUser(ctx!) },
    { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } },
  );
}

export function handleLogout(req: Request): Response {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  if (token) logout(token);
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

export function handleMe(req: Request): Response {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");
  return json({ user: publicUser(ctx) });
}

function publicUser(ctx: NonNullable<ReturnType<typeof getAuthContext>>) {
  return {
    id: ctx.user.id,
    nama: ctx.user.nama,
    email: ctx.user.email,
    roles: ctx.roles,
  };
}
