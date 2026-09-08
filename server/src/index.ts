import { runMigrations } from "./db";
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
import { handleMonthlyReportPdf } from "./routes/reports";

runMigrations();

const port = Number(process.env.PORT ?? 3001);

Bun.serve({
  port,
  routes: {
    "/api/login": { POST: handleLogin },
    "/api/logout": { POST: handleLogout },
    "/api/me": { GET: handleMe },
    "/api/users": { GET: handleListUsers, POST: handleCreateUser },
    "/api/users/:id": { PUT: (req) => handleUpdateUser(req, Number(req.params.id)) },
    "/api/holidays": { GET: handleListHolidays, POST: handleCreateHoliday },
    "/api/holidays/:id": { DELETE: (req) => handleDeleteHoliday(req, Number(req.params.id)) },
    "/api/projects": { GET: handleListProjects, POST: handleCreateProject },
    "/api/projects/mine": { GET: handleListMyProjects },
    "/api/projects/:id": { PUT: (req) => handleUpdateProject(req, Number(req.params.id)) },
    "/api/projects/:id/konfirmasi": {
      POST: (req) => handleConfirmProject(req, Number(req.params.id)),
    },
    "/api/projects/:id/gabung": {
      POST: (req) => handleMergeProject(req, Number(req.params.id)),
    },
    "/api/projects/:id/members": {
      POST: (req) => handleAddMember(req, Number(req.params.id)),
    },
    "/api/projects/:id/members/:userId": {
      DELETE: (req) => handleEndMembership(req, Number(req.params.id), Number(req.params.userId)),
    },
    "/api/tasks": { GET: handleListTasks, POST: handleCreateTask },
    "/api/tasks/:id/tutup": { POST: (req) => handleCloseTask(req, Number(req.params.id)) },
    "/api/task-logs/daily": { GET: (req) => handleGetDailyInput(req) },
    "/api/task-logs": { POST: (req) => handleSaveDailyInput(req) },
    "/api/leaves": { POST: (req) => handleSaveLeave(req) },
    "/api/leaves/:tanggal": { DELETE: (req) => handleCancelLeave(req, req.params.tanggal) },
    "/api/bottlenecks": { POST: (req) => handleCreateKendala(req) },
    "/api/bottlenecks/:id": { DELETE: (req) => handleDeleteKendala(req, Number(req.params.id)) },
    "/api/bottlenecks/:id/resolve": { POST: (req) => handleResolveKendala(req, Number(req.params.id)) },
    "/api/attachments": { POST: (req) => handleUploadAttachment(req) },
    "/api/attachments/:id": { DELETE: (req) => handleDeleteAttachment(req, Number(req.params.id)) },
    "/api/attachments/:id/file": { GET: (req) => handleGetAttachmentFile(req, Number(req.params.id)) },
    "/api/activity-heatmap": { GET: (req) => handleGetActivityHeatmap(req) },
    "/api/activity-log": { GET: (req) => handleListActivityLog(req) },
    "/api/history/:tanggal": { GET: (req) => handleGetRiwayatDetail(req, req.params.tanggal) },
    "/api/reports/monthly": { GET: (req) => handleMonthlyReportPdf(req) },
  },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
});

console.log(`[server] berjalan di http://localhost:${port}`);
