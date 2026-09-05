import { runMigrations } from "./db";
import { handleLogin, handleLogout, handleMe } from "./routes/auth";

runMigrations();

const port = Number(process.env.PORT ?? 3001);

Bun.serve({
  port,
  routes: {
    "/api/login": { POST: handleLogin },
    "/api/logout": { POST: handleLogout },
    "/api/me": { GET: handleMe },
  },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
});

console.log(`[server] berjalan di http://localhost:${port}`);
