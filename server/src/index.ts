import { runMigrations } from "./db";
import { handleLogin, handleLogout, handleMe } from "./routes/auth";
import { handleCreateUser, handleListUsers, handleUpdateUser } from "./routes/users";

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
  },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
});

console.log(`[server] berjalan di http://localhost:${port}`);
