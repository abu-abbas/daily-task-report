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
import { handleCreateTask, handleListTasks } from "./routes/tasks";
import { handleGetTodayInput, handleSaveTodayInput } from "./routes/task-logs";

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
    "/api/task-logs/today": { GET: (req) => handleGetTodayInput(req) },
    "/api/task-logs": { POST: (req) => handleSaveTodayInput(req) },
  },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
});

console.log(`[server] berjalan di http://localhost:${port}`);
