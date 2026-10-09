import { closeDb, driver, runMigrations } from "./db";

await runMigrations();
console.log(`[migrate] selesai (${driver})`);
await closeDb();
