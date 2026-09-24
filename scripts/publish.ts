import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPublishedNotes } from "../src/content.js";
import type { SiteConfig } from "../src/types.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedRemote = /(?:github\.com[:/])nomadjing\/nomadjing\.github\.io(?:\.git)?$/i;

function run(command: string, args: string[], cwd = projectRoot, env = process.env): void {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status ?? "signal"})`);
}

function git(args: string[], cwd = projectRoot): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

async function main(): Promise<void> {
  const config = JSON.parse(await readFile(path.join(projectRoot, "site.config.json"), "utf8")) as SiteConfig;
  const vault = path.resolve(projectRoot, process.env.CONTENT_ROOT ?? config.contentRoot);
  if (!await stat(vault).then((info) => info.isDirectory(), () => false)) {
    throw new Error(`Notes directory does not exist: ${vault}`);
  }
  const notes = await loadPublishedNotes(vault);
  if (notes.length === 0) throw new Error(`No publish: true notes in ${vault}; refusing to replace the live site`);

  console.log(`[publish] ${notes.length} published note(s) from ${vault}`);
  run("npm", ["run", "typecheck"]);
  run("npm", ["test"]);
  run("npm", ["run", "build"], projectRoot, { ...process.env, CONTENT_ROOT: vault });

  const dist = path.join(projectRoot, "dist");
  if (!await stat(path.join(dist, "index.html")).then((info) => info.isFile(), () => false)) {
    throw new Error("Build did not produce dist/index.html");
  }
  console.log(`[publish] Built public site in ${dist}`);
  const remote = git(["remote", "get-url", "origin"]);
  if (!expectedRemote.test(remote)) {
    throw new Error(`origin must point to nomadjing/nomadjing.github.io; got ${remote}`);
  }

  const temporary = await mkdtemp(path.join(os.tmpdir(), "nomad-pages-"));
  try {
    run("git", ["init", "-b", "gh-pages", temporary]);
    run("git", ["remote", "add", "origin", remote], temporary);
    const check = spawnSync("git", ["ls-remote", "--exit-code", "origin", "refs/heads/gh-pages"], {
      cwd: temporary, stdio: "ignore",
    });
    if (check.error) throw check.error;
    if (check.status === 0) {
      run("git", ["fetch", "--depth", "1", "origin", "gh-pages"], temporary);
      run("git", ["checkout", "-B", "gh-pages", "FETCH_HEAD"], temporary);
    } else if (check.status !== 2) {
      throw new Error("Could not check the remote gh-pages branch");
    }

    for (const entry of await readdir(temporary)) {
      if (entry !== ".git") await rm(path.join(temporary, entry), { recursive: true, force: true });
    }
    for (const entry of await readdir(dist)) {
      await cp(path.join(dist, entry), path.join(temporary, entry), { recursive: true });
    }
    await writeFile(path.join(temporary, ".nojekyll"), "");
    run("git", ["add", "-A"], temporary);
    const diff = spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: temporary, stdio: "ignore" });
    if (diff.error) throw diff.error;
    if (diff.status === 0) {
      console.log("[publish] No changes to publish.");
      return;
    }
    if (diff.status !== 1) throw new Error("Could not compare the new site with gh-pages");
    run("git", ["-c", "user.name=nomadjing", "-c", "user.email=nomadjing@users.noreply.github.com", "commit", "-m", "Publish site"], temporary);
    run("git", ["push", "origin", "gh-pages"], temporary);
    console.log("[publish] Pushed public site to gh-pages.");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
