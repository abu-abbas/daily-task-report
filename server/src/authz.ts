import { getAuthContext, parseCookie, SESSION_COOKIE } from "./auth";
import { errorResponse } from "./http";
import type { AuthContext } from "./types";

// Sesi di-resolve sekali per request (ADR-0049): middleware Hono (app.ts) mengisi cache ini
// lebih dulu, lalu handler membaca hasil yang sama lewat requireLogin/requireAdmin tanpa query
// sesi kedua. Handler yang dipanggil langsung tanpa middleware (test unit) tetap aman karena
// cache kosong jatuh ke resolve biasa. WeakMap supaya entri ikut hilang bersama Request-nya.
const authCache = new WeakMap<Request, AuthContext | null>();

export function resolveAuth(req: Request): AuthContext | null {
  if (authCache.has(req)) return authCache.get(req)!;
  const ctx = getAuthContext(parseCookie(req.headers.get("Cookie"), SESSION_COOKIE));
  authCache.set(req, ctx);
  return ctx;
}

export function requireLogin(req: Request): AuthContext | Response {
  return resolveAuth(req) ?? errorResponse(401, "Belum login.");
}

export function requireAdmin(req: Request): AuthContext | Response {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;
  if (!ctx.roles.includes("admin")) return errorResponse(403, "Khusus admin.");
  return ctx;
}
