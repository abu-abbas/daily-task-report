import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("Git menolak pesan nonkonvensional dan menerima commit termasuk breaking change", () => {
  const root = resolve(import.meta.dir, "..");
  const temporary = mkdtempSync(join(tmpdir(), "daily-task-hooks-"));
  const git = (...args: string[]) => Bun.spawnSync(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });

  try {
    expect(git("init", "--quiet", temporary).exitCode).toBe(0);
    for (const [message, accepted] of [
      ["update laporan", false],
      ["feature: tambah laporan", false],
      ["fix:", false],
      ["docs: catat keputusan dan tahapan laporan harian", true],
      ["feat(laporan): tambah input harian", true],
      ["fix(kalender): perbaiki tanggal sebelumnya", true],
      ["feat(api)!: ubah format laporan", true],
      ["feat(api): ubah format laporan\n\nBREAKING CHANGE: respons memakai struktur baru", true],
    ] as const) {
      const result = git(
        `--git-dir=${join(temporary, ".git")}`,
        `--work-tree=${root}`,
        "-c", `core.hooksPath=${join(root, ".githooks")}`,
        "-c", "user.name=Hook Test",
        "-c", "user.email=hook-test@example.invalid",
        "-c", "commit.gpgSign=false",
        "commit", "--allow-empty", "-m", message,
      );
      expect(result.exitCode === 0, `${message}\n${result.stderr.toString()}`).toBe(accepted);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}, 30_000);
