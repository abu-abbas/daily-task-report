import { beforeAll, beforeEach, describe, expect, test } from "bun:test";

const { runMigrations } = await import("../src/db");
const { db } = await import("./raw-db");
const { handleLogin } = await import("../src/routes/auth");
const { FailureLimiter, loginEmailLimiter, loginIpLimiter } = await import("../src/rate-limit");
const { resolveGitlabToken } = await import("../src/gitlab");

const EMAIL = "rate.limit@example.test";
const PASSWORD = "kata-sandi-aman";

beforeAll(async () => {
  await runMigrations();
  await db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Rate Limit",
    EMAIL,
    await Bun.password.hash(PASSWORD),
  );
});

beforeEach(() => {
  loginEmailLimiter.clear();
  loginIpLimiter.clear();
});

function loginReq(email: string, password: string) {
  return handleLogin(new Request("http://localhost/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }));
}

describe("FailureLimiter", () => {
  test("memblokir setelah batas gagal dan lepas setelah jendela habis", () => {
    const limiter = new FailureLimiter(2, 1000);
    limiter.recordFailure("k", 0);
    expect(limiter.retryAfterSeconds("k", 0)).toBe(0);
    limiter.recordFailure("k", 0);
    expect(limiter.retryAfterSeconds("k", 500)).toBe(1);
    expect(limiter.retryAfterSeconds("k", 1000)).toBe(0);
  });
});

describe("POST /api/login dibatasi", () => {
  test("setelah 10 kali gagal untuk satu email, password benar pun ditolak 429", async () => {
    for (let i = 0; i < 10; i++) expect((await loginReq(EMAIL, "salah-terus")).status).toBe(401);
    const res = await loginReq(EMAIL.toUpperCase(), PASSWORD);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  test("login berhasil mengosongkan hitungan gagal", async () => {
    for (let i = 0; i < 9; i++) await loginReq(EMAIL, "salah-terus");
    expect((await loginReq(EMAIL, PASSWORD)).status).toBe(200);
    expect((await loginReq(EMAIL, "salah-terus")).status).toBe(401);
  });
});

describe("resolveGitlabToken", () => {
  test("fallback token .env tidak dipakai di produksi", () => {
    const awal = { env: process.env.NODE_ENV, token: process.env.GITLAB_SELFHOSTED_PRIVATE_TOKEN };
    process.env.GITLAB_SELFHOSTED_PRIVATE_TOKEN = "token-bersama";
    try {
      process.env.NODE_ENV = "development";
      expect(resolveGitlabToken(null)).toBe("token-bersama");
      process.env.NODE_ENV = "production";
      expect(resolveGitlabToken(null)).toBeNull();
      expect(resolveGitlabToken("token-pribadi")).toBe("token-pribadi");
    } finally {
      process.env.NODE_ENV = awal.env;
      if (awal.token === undefined) delete process.env.GITLAB_SELFHOSTED_PRIVATE_TOKEN;
      else process.env.GITLAB_SELFHOSTED_PRIVATE_TOKEN = awal.token;
    }
  });
});
