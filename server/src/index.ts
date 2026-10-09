import { closeDb, runMigrations } from "./db";
import { app } from "./app";
import { pruneExpiredSessions } from "./auth";
import { errorMeta, log, pruneOldLogs } from "./logger";

await runMigrations();
// Retensi log dicek sekali saat startup, lalu otomatis tiap pergantian tanggal (ADR-0048).
pruneOldLogs();

// Sesi kedaluwarsa dibersihkan saat startup lalu sekali sehari.
async function cleanSessions() {
  try {
    const removed = await pruneExpiredSessions();
    if (removed > 0) log("info", "Sesi kedaluwarsa dibersihkan", { removed });
  } catch (err) {
    log("error", "Gagal membersihkan sesi kedaluwarsa", errorMeta(err));
  }
}
await cleanSessions();
setInterval(cleanSessions, 24 * 60 * 60 * 1000).unref();

const port = Number(process.env.PORT ?? 3001);

// Server diteruskan sebagai env supaya route bisa membaca IP klien (app.ts, clientIp).
const server = Bun.serve({ port, fetch: (req, srv) => app.fetch(req, { server: srv }) });

log("info", "Server berjalan", { port });
console.log(`[server] berjalan di http://localhost:${port}`);

// Berhenti dengan rapi saat systemd/Docker mengirim SIGTERM atau Ctrl+C: tunggu request yang sedang
// jalan selesai, lalu tutup koneksi database.
let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log("info", "Server berhenti", { signal });
  await server.stop();
  await closeDb();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
