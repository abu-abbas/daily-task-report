import { requireLogin } from "../authz";
import { z } from "zod/v4";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { taskLogCommits, users } from "../schema";
import { errorResponse, json } from "../http";
import type { AuthContext } from "../types";
import { errorMeta, log } from "../logger";
import {
  fetchCommitsForDate,
  fetchGitlabIdentity,
  fetchGitlabProjects,
  gitlabHostConfigured,
  resolveGitlabToken,
} from "../gitlab";

const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/;

function requireGitlabToken(ctx: AuthContext): string | Response {
  if (!gitlabHostConfigured()) {
    return errorResponse(500, "Integrasi GitLab belum dikonfigurasi di server.");
  }
  const gitlabToken = resolveGitlabToken(ctx.user.gitlab_private_token);
  if (!gitlabToken) {
    return errorResponse(400, "Token GitLab belum tersedia untuk akun ini.");
  }
  return gitlabToken;
}

// Daftar repo GitLab yang bisa diakses token ini — dipilih user LEBIH DULU sebelum commit
// di-fetch (lihat handleListGitlabCommits), supaya fetch commit gak perlu nge-loop semua repo.
export async function handleListGitlabProjects(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const gitlabToken = requireGitlabToken(ctx);
  if (typeof gitlabToken !== "string") return gitlabToken;

  try {
    const projects = await fetchGitlabProjects(gitlabToken);
    return json({ projects });
  } catch (err) {
    log("error", "Gagal mengambil daftar repo GitLab", { userId: ctx.user.id, ...errorMeta(err) });
    return errorResponse(502, "Gagal menghubungi GitLab, coba lagi.");
  }
}

// Lazy per tanggal+repo (ADR-0047) — dipanggil cuma setelah user pilih repo GitLab di modal
// "Impor commit GitLab", bukan prefetch atau nge-loop semua repo yang bisa diakses.
export async function handleListGitlabCommits(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const gitlabToken = requireGitlabToken(ctx);
  if (typeof gitlabToken !== "string") return gitlabToken;
  if (!ctx.user.email) {
    return errorResponse(400, "Akun belum punya email, tidak bisa mencocokkan commit GitLab.");
  }

  const url = new URL(req.url);
  const tanggal = url.searchParams.get("tanggal") ?? "";
  if (!TANGGAL_RE.test(tanggal)) return errorResponse(400, "tanggal wajib diisi (YYYY-MM-DD).");
  const gitlabProjectId = Number(url.searchParams.get("projectId"));
  if (!Number.isInteger(gitlabProjectId) || gitlabProjectId <= 0) {
    return errorResponse(400, "projectId (repo GitLab) wajib diisi.");
  }

  try {
    const commits = await fetchCommitsForDate(gitlabProjectId, tanggal, ctx.user.email, gitlabToken);

    // Tandai commit yang sudah pernah diimpor (task_log_commits, ADR-0039/0047) — dicek per
    // commit_sha milik user ini, bukan discope ulang per tanggal/repo (SHA git unik global).
    const shas = commits.map((c) => c.sha);
    const imported = new Set<string>();
    if (shas.length > 0) {
      const rows = await db
        .select({ commit_sha: taskLogCommits.commit_sha })
        .from(taskLogCommits)
        .where(and(eq(taskLogCommits.ditambahkan_oleh, ctx.user.id), inArray(taskLogCommits.commit_sha, shas)));
      for (const r of rows) imported.add(r.commit_sha);
    }

    return json({ commits: commits.map((c) => ({ ...c, alreadyImported: imported.has(c.sha) })) });
  } catch (err) {
    log("error", "Gagal mengambil commit GitLab", { userId: ctx.user.id, gitlabProjectId, tanggal, ...errorMeta(err) });
    return errorResponse(502, "Gagal menghubungi GitLab, coba lagi.");
  }
}

const saveTokenSchema = z.object({ token: z.string().min(1, "Token wajib diisi.") });

// Verifikasi dulu ke GitLab (GET /api/v4/user) sebelum disimpan (ADR-0047: identitas token
// dicocokkan ke email akun yang login) — token yang gagal/invalid tidak pernah ditulis ke DB,
// jadi kolom lama tidak ketiban token baru yang ternyata salah.
export async function handleSaveGitlabToken(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  if (!gitlabHostConfigured()) {
    return errorResponse(500, "Integrasi GitLab belum dikonfigurasi di server.");
  }

  const body = await req.json().catch(() => null);
  const parsed = saveTokenSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  let identity;
  try {
    identity = await fetchGitlabIdentity(parsed.data.token);
  } catch (err) {
    // Biasanya token salah (bukan error server), tetap dicatat level warn supaya kegagalan
    // koneksi ke GitLab bisa dibedakan dari token salah saat ditelusuri.
    log("warn", "Verifikasi token GitLab gagal", { userId: ctx.user.id, ...errorMeta(err) });
    return errorResponse(400, "Token GitLab tidak valid atau gagal terhubung.");
  }

  if (ctx.user.email && identity.email && identity.email.toLowerCase() !== ctx.user.email.toLowerCase()) {
    return errorResponse(
      400,
      `Token ini milik akun GitLab dengan email ${identity.email}, beda dengan email akunmu.`,
    );
  }

  await db
    .update(users)
    .set({
      gitlab_username: identity.username,
      gitlab_avatar_url: identity.avatarUrl,
      gitlab_private_token: parsed.data.token,
    })
    .where(eq(users.id, ctx.user.id));

  return json({ gitlabUsername: identity.username, gitlabAvatarUrl: identity.avatarUrl });
}
