import { client, runMigrations } from "./db";

await runMigrations();
console.log("[migrate] selesai");
await client.close();
