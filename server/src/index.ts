import { runMigrations } from "./db";
import { app } from "./app";
import { log, pruneOldLogs } from "./logger";

await runMigrations();
// Retensi log dicek sekali saat startup, lalu otomatis tiap pergantian tanggal (ADR-0048).
pruneOldLogs();

const port = Number(process.env.PORT ?? 3001);

Bun.serve({ port, fetch: app.fetch });

log("info", "Server berjalan", { port });
console.log(`[server] berjalan di http://localhost:${port}`);
