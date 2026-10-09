import { getAuthContext, parseCookie, SESSION_COOKIE } from "./auth";
import { errorResponse } from "./http";
import type { AuthContext } from "./types";

// Sesi di-resolve sekali per request (ADR-0049): middleware Hono (app.ts) mengisi cache ini
// lebih dulu, lalu handler membaca hasil yang sama lewat requireLogin/requireAdmin tanpa query
// sesi kedua. Handler yang dipanggil langsung tanpa middleware (test unit) tetap aman karena
// cache kosong jatuh ke resolve biasa. WeakMap supaya entri ikut hilang bersama Request-nya.
// Yang di-cache Promise-nya, supaya pemanggilan bersamaan pun tetap berbagi satu query sesi.
const authCache = new WeakMap<Request, Promise<AuthContext | null>>();

export function resolveAuth(req: Request): Promise<AuthContext | null> {
  let ctx = authCache.get(req);
  if (!ctx) {
    ctx = getAuthContext(parseCookie(req.headers.get("Cookie"), SESSION_COOKIE));
    authCache.set(req, ctx);
  }
  return ctx;
}

export async function requireLogin(req: Request): Promise<AuthContext | Response> {
  return (await resolveAuth(req)) ?? errorResponse(401, "Belum login.");
}

export async function requireAdmin(req: Request): Promise<AuthContext | Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;
  if (!ctx.roles.includes("admin")) return errorResponse(403, "Khusus admin.");
  return ctx;
}
