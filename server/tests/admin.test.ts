import { beforeAll, describe, expect, test } from "bun:test";

const { runMigrations } = await import("../src/db");
const { db } = await import("./raw-db");
const { login, getAuthContext } = await import("../src/auth");
const { buatAdmin } = await import("../src/admin");

beforeAll(async () => {
  await runMigrations();
});

describe("buatAdmin", () => {
  test("membuat admin baru yang bisa login", async () => {
    const hasil = await buatAdmin({ nama: "Admin Pertama", email: "admin.pertama@example.test", password: "rahasia-123" });
    expect(hasil.dibuat).toBe(true);

    const session = await login("admin.pertama@example.test", "rahasia-123");
    const ctx = await getAuthContext(session!.token);
    expect(ctx?.roles).toEqual(["admin"]);
  });

  test("email yang sudah ada dijadikan admin, password diganti, sesi lama diakhiri", async () => {
    const email = "sudah.ada@example.test";
    const { lastInsertRowid: id } = await db
      .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
      .run("Sudah Ada", email, await Bun.password.hash("password-lama"));
    await db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(id);
    const lama = (await login(email, "password-lama"))!.token;

    const hasil = await buatAdmin({ nama: "Diabaikan", email, password: "password-baru" });
    expect(hasil).toEqual({ id, dibuat: false });
    expect(await getAuthContext(lama)).toBeNull();
    expect(await login(email, "password-lama")).toBeNull();
    const ctx = await getAuthContext((await login(email, "password-baru"))!.token);
    expect(ctx?.roles.sort()).toEqual(["admin", "tenaga_ahli"]);
    expect(ctx?.user.nama).toBe("Sudah Ada");

    // Dijalankan ulang tidak menggandakan peran admin.
    await buatAdmin({ nama: "x", email, password: "password-baru" });
    expect(await db.query("SELECT role FROM user_roles WHERE user_id = ? AND role = 'admin'").all(id)).toHaveLength(1);
  });

  test("menolak password pendek", async () => {
    await expect(buatAdmin({ nama: "A", email: "pendek@example.test", password: "123" })).rejects.toThrow(
      "Password minimal 8 karakter.",
    );
  });
});
