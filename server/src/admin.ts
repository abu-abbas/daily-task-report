import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { revokeUserSessions } from "./auth";
import { db, first } from "./db";
import { userRoles, users } from "./schema";

const adminSchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi."),
  email: z.email("Email tidak valid."),
  password: z.string().min(8, "Password minimal 8 karakter."),
});

export type BuatAdminInput = z.input<typeof adminSchema>;

// Membuat admin pertama di server baru (dipakai skrip buat-admin). Kalau email sudah ada, akun itu
// dijadikan admin dan passwordnya diganti, sehingga skrip yang sama juga bisa dipakai untuk
// memulihkan akses admin yang lupa password. Sesi lama akun itu diakhiri.
export async function buatAdmin(input: BuatAdminInput): Promise<{ id: number; dibuat: boolean }> {
  const parsed = adminSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const { nama, email, password } = parsed.data;
  const passwordHash = await Bun.password.hash(password);

  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).then(first);
    let id: number;
    if (existing) {
      id = existing.id;
      await tx.update(users).set({ password_hash: passwordHash }).where(eq(users.id, id));
      await revokeUserSessions(id, undefined, tx);
    } else {
      [{ id }] = await tx.insert(users).values({ nama, email, password_hash: passwordHash }).returning({ id: users.id });
    }
    const hasAdmin = await tx
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.user_id, id), eq(userRoles.role, "admin")))
      .then(first);
    if (!hasAdmin) await tx.insert(userRoles).values({ user_id: id, role: "admin" });
    return { id, dibuat: !existing };
  });
}
