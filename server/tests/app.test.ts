import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Lihat users.test.ts soal kenapa DATABASE_PATH dipaksa timpa sebelum import.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const { app } = await import("../src/app");
const { logDir } = await import("../src/logger");
const { todayJakarta } = await import("../src/kalender");

const ADMIN_EMAIL = "admin.app@example.test";
const TENAGA_EMAIL = "tenaga.app@example.test";
const PASSWORD = "kata-sandi-aman";

let adminToken: string;
let tenagaToken: string;

beforeAll(async () => {
  runMigrations();
  const hash = await Bun.password.hash(PASSWORD);
  for (const [nama, email, role] of [
    ["Admin App", ADMIN_EMAIL, "admin"],
    ["Tenaga App", TENAGA_EMAIL, "tenaga_ahli"],
  ] as const) {
    const id = Number(
      db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(nama, email, hash).lastInsertRowid,
    );
    db.query("INSERT INTO user_roles (user_id, role) VALUES (?, ?)").run(id, role);
  }
  adminToken = (await login(ADMIN_EMAIL, PASSWORD))!.token;
  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;

  // Route uji yang sengaja melempar exception, untuk memeriksa onError + logging.
  app.get("/api/__uji-error", () => {
    throw new Error("ledakan uji");
  });
});

function get(path: string, token?: string) {
  return app.request(path, { headers: token ? { Cookie: `session=${token}` } : {} });
}

describe("routing Hono (ADR-0049)", () => {
  test("route login-required menolak tanpa sesi", async () => {
    const res = await get("/api/me");
    expect(res.status).toBe(401);
  });

  test("route login-required meneruskan ke handler saat sesi valid", async () => {
    const res = await get("/api/me", tenagaToken);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe(TENAGA_EMAIL);
  });

  test("route admin menolak non-admin dan menerima admin", async () => {
    expect((await get("/api/users", tenagaToken)).status).toBe(403);
    expect((await get("/api/users", adminToken)).status).toBe(200);
  });

  test("parameter path diteruskan ke handler", async () => {
    const res = await app.request("/api/users/999999", {
      method: "PUT",
      headers: { Cookie: `session=${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ nama: "Tidak Ada" }),
    });
    expect(res.status).toBe(404);
  });

  test("path tidak dikenal menghasilkan 404", async () => {
    const res = await get("/api/tidak-ada");
    expect(res.status).toBe(404);
  });

  test("exception tak tertangani jadi 500 dan tercatat di log dengan stack", async () => {
    rmSync(logDir, { recursive: true, force: true });
    const res = await get("/api/__uji-error", tenagaToken);
    expect(res.status).toBe(500);
    const lines = readFileSync(join(logDir, `app-${todayJakarta()}.log`), "utf-8").trim().split("\n");
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!);
    expect(entry.level).toBe("error");
    expect(entry.error).toBe("ledakan uji");
    expect(entry.path).toBe("/api/__uji-error");
    expect(typeof entry.userId).toBe("number");
    expect(entry.stack).toContain("ledakan uji");
  });
});
