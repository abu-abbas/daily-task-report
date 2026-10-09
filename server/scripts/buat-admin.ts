// Membuat akun admin, atau menjadikan akun yang sudah ada admin dan mengganti passwordnya.
//
//   bun --cwd=server run buat-admin --email admin@kantor.go.id --password 'rahasia123' [--nama 'Admin']
//
// Login aplikasi memakai email, jadi --email adalah "username"-nya. Password ditulis polos di sini
// lalu di-hash Argon2id sebelum disimpan. Migration dijalankan dulu supaya bisa dipakai di server baru.
import { parseArgs } from "node:util";
import { buatAdmin } from "../src/admin";
import { closeDb, runMigrations } from "../src/db";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    nama: { type: "string", default: "Administrator" },
  },
});

if (!values.email || !values.password) {
  console.error("Pemakaian: bun --cwd=server run buat-admin --email <email> --password <password> [--nama <nama>]");
  process.exit(1);
}

try {
  await runMigrations();
  const { id, dibuat } = await buatAdmin({ email: values.email, password: values.password, nama: values.nama! });
  console.log(
    dibuat
      ? `[buat-admin] admin baru dibuat: ${values.email} (id ${id})`
      : `[buat-admin] ${values.email} sudah ada (id ${id}): dijadikan admin dan passwordnya diganti`,
  );
} catch (err) {
  console.error(`[buat-admin] gagal: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
