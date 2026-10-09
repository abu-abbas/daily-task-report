import { Hono, type MiddlewareHandler } from "hono";
import { requireAdmin, requireLogin, resolveAuth } from "./authz";
import { errorResponse } from "./http";
import { errorMeta, log } from "./logger";
import { handleLogin, handleLogout, handleMe } from "./routes/auth";
import { handleCreateUser, handleListUsers, handleUpdateUser } from "./routes/users";
import { handleCreateHoliday, handleDeleteHoliday, handleListHolidays } from "./routes/holidays";
import {
  handleAddMember,
  handleConfirmProject,
  handleCreateProject,
  handleEndMembership,
  handleListMyProjects,
  handleListProjects,
  handleMergeProject,
  handleUpdateProject,
} from "./routes/projects";
import { handleCloseTask, handleCreateTask, handleListTasks } from "./routes/tasks";
import { handleGetDailyInput, handleSaveDailyInput } from "./routes/task-logs";
import { handleCancelLeave, handleSaveLeave } from "./routes/leaves";
import { handleCreateKendala, handleDeleteKendala, handleResolveKendala } from "./routes/kendala";
import { handleDeleteAttachment, handleGetAttachmentFile, handleUploadAttachment } from "./routes/attachments";
import { handleGetActivityHeatmap, handleGetRiwayatDetail, handleListActivityLog } from "./routes/riwayat";
import { handleMonthlyReportPdf, handleMonthlyReportPreview, handleMonthlyReportWord } from "./routes/reports";
import {
  handleDeleteLaporanTemplate,
  handleGetMyLaporanTemplate,
  handleUploadLaporanTemplate,
} from "./routes/laporan-template";
import { handleGetSaran, handleSaveSaran } from "./routes/saran";
import { handleListGitlabCommits, handleListGitlabProjects, handleSaveGitlabToken } from "./routes/gitlab";

// Routing HTTP via Hono (ADR-0049 tahap 1). Handler tetap fungsi Request → Response yang sama
// seperti sebelumnya; app ini cuma mendaftarkan route dan memasang middleware lintas route.
export const app = new Hono();

// Logging (ADR-0048): setiap response 5xx dicatat. Exception yang lolos dari handler sudah
// dicatat lengkap (dengan stack) oleh onError di bawah, jadi tidak dicatat dua kali di sini.
app.use("*", async (c, next) => {
  await next();
  if (c.res.status >= 500 && !c.error) {
    log("error", "Response 5xx", {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      userId: resolveAuth(c.req.raw)?.user.id,
    });
  }
});

// Jaring pengaman terakhir untuk exception yang tidak ditangkap handler mana pun.
app.onError((err, c) => {
  log("error", "Exception tidak tertangani", {
    method: c.req.method,
    path: c.req.path,
    userId: resolveAuth(c.req.raw)?.user.id,
    ...errorMeta(err),
  });
  return errorResponse(500, "Terjadi kesalahan di server.");
});

app.notFound(() => new Response("Not found", { status: 404 }));

// Guard sesi per route. Handler masih memanggil requireLogin/requireAdmin sendiri (pertahanan
// berlapis dan supaya test unit yang memanggil handler langsung tetap valid), tapi sesi cuma
// di-query sekali per request karena hasilnya di-cache per Request (authz.ts).
const loginRequired: MiddlewareHandler = async (c, next) => {
  const ctx = requireLogin(c.req.raw);
  if (ctx instanceof Response) return ctx;
  await next();
};

const adminOnly: MiddlewareHandler = async (c, next) => {
  const ctx = requireAdmin(c.req.raw);
  if (ctx instanceof Response) return ctx;
  await next();
};

const id = (raw: string | undefined) => Number(raw);

// Publik: login/logout.
app.post("/api/login", (c) => handleLogin(c.req.raw));
app.post("/api/logout", (c) => handleLogout(c.req.raw));

// Khusus admin.
app.get("/api/users", adminOnly, (c) => handleListUsers(c.req.raw));
app.post("/api/users", adminOnly, (c) => handleCreateUser(c.req.raw));
app.put("/api/users/:id", adminOnly, (c) => handleUpdateUser(c.req.raw, id(c.req.param("id"))));
app.post("/api/holidays", adminOnly, (c) => handleCreateHoliday(c.req.raw));
app.delete("/api/holidays/:id", adminOnly, (c) => handleDeleteHoliday(c.req.raw, id(c.req.param("id"))));
app.get("/api/projects", adminOnly, (c) => handleListProjects(c.req.raw));
app.post("/api/projects", adminOnly, (c) => handleCreateProject(c.req.raw));
app.put("/api/projects/:id", adminOnly, (c) => handleUpdateProject(c.req.raw, id(c.req.param("id"))));
app.post("/api/projects/:id/konfirmasi", adminOnly, (c) => handleConfirmProject(c.req.raw, id(c.req.param("id"))));
app.post("/api/projects/:id/gabung", adminOnly, (c) => handleMergeProject(c.req.raw, id(c.req.param("id"))));
app.post("/api/projects/:id/members", adminOnly, (c) => handleAddMember(c.req.raw, id(c.req.param("id"))));
app.delete("/api/projects/:id/members/:userId", adminOnly, (c) =>
  handleEndMembership(c.req.raw, id(c.req.param("id")), id(c.req.param("userId"))),
);

// Semua user yang login.
app.get("/api/me", loginRequired, (c) => handleMe(c.req.raw));
app.put("/api/me/gitlab-token", loginRequired, (c) => handleSaveGitlabToken(c.req.raw));
app.get("/api/holidays", loginRequired, (c) => handleListHolidays(c.req.raw));
app.get("/api/projects/mine", loginRequired, (c) => handleListMyProjects(c.req.raw));
app.get("/api/tasks", loginRequired, (c) => handleListTasks(c.req.raw));
app.post("/api/tasks", loginRequired, (c) => handleCreateTask(c.req.raw));
app.post("/api/tasks/:id/tutup", loginRequired, (c) => handleCloseTask(c.req.raw, id(c.req.param("id"))));
app.get("/api/task-logs/daily", loginRequired, (c) => handleGetDailyInput(c.req.raw));
app.post("/api/task-logs", loginRequired, (c) => handleSaveDailyInput(c.req.raw));
app.post("/api/leaves", loginRequired, (c) => handleSaveLeave(c.req.raw));
app.delete("/api/leaves/:tanggal", loginRequired, (c) => handleCancelLeave(c.req.raw, c.req.param("tanggal")));
app.post("/api/bottlenecks", loginRequired, (c) => handleCreateKendala(c.req.raw));
app.delete("/api/bottlenecks/:id", loginRequired, (c) => handleDeleteKendala(c.req.raw, id(c.req.param("id"))));
app.post("/api/bottlenecks/:id/resolve", loginRequired, (c) =>
  handleResolveKendala(c.req.raw, id(c.req.param("id"))),
);
app.post("/api/attachments", loginRequired, (c) => handleUploadAttachment(c.req.raw));
app.delete("/api/attachments/:id", loginRequired, (c) => handleDeleteAttachment(c.req.raw, id(c.req.param("id"))));
app.get("/api/attachments/:id/file", loginRequired, (c) =>
  handleGetAttachmentFile(c.req.raw, id(c.req.param("id"))),
);
app.get("/api/activity-heatmap", loginRequired, (c) => handleGetActivityHeatmap(c.req.raw));
app.get("/api/activity-log", loginRequired, (c) => handleListActivityLog(c.req.raw));
app.get("/api/history/:tanggal", loginRequired, (c) => handleGetRiwayatDetail(c.req.raw, c.req.param("tanggal")));
app.get("/api/reports/monthly", loginRequired, (c) => handleMonthlyReportPdf(c.req.raw));
app.get("/api/reports/monthly-word", loginRequired, (c) => handleMonthlyReportWord(c.req.raw));
app.get("/api/reports/monthly-preview", loginRequired, (c) => handleMonthlyReportPreview(c.req.raw));
app.get("/api/laporan-template", loginRequired, (c) => handleGetMyLaporanTemplate(c.req.raw));
app.post("/api/laporan-template", loginRequired, (c) => handleUploadLaporanTemplate(c.req.raw));
app.delete("/api/laporan-template", loginRequired, (c) => handleDeleteLaporanTemplate(c.req.raw));
app.get("/api/saran", loginRequired, (c) => handleGetSaran(c.req.raw));
app.put("/api/saran", loginRequired, (c) => handleSaveSaran(c.req.raw));
app.get("/api/gitlab/projects", loginRequired, (c) => handleListGitlabProjects(c.req.raw));
app.get("/api/gitlab/commits", loginRequired, (c) => handleListGitlabCommits(c.req.raw));
