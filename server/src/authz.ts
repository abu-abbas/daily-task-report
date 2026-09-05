import { getAuthContext, parseCookie, SESSION_COOKIE } from "./auth";
import { errorResponse } from "./http";
import type { AuthContext } from "./types";

export function requireAdmin(req: Request): AuthContext | Response {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");
  if (!ctx.roles.includes("admin")) return errorResponse(403, "Khusus admin.");
  return ctx;
}
