import { defineConfig } from "drizzle-kit";

// Konfigurasi drizzle-kit (ADR-0049 tahap 3). `bun run db:generate` membandingkan
// src/schema.ts dengan snapshot terakhir dan menulis migration SQL baru ke docs/schema/postgres/.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "../docs/schema/postgres",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://laporan:laporan@localhost:5432/laporan_harian",
  },
});
