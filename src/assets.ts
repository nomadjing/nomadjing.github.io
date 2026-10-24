import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
}

/**
 * Copies browser files, vendor CSS/fonts, and concatenates `styles/*.css` in filename order.
 * Returns a content hash of the CSS and JS; every relative module import is
 * suffixed with `?v=<hash>`, so a release never mixes with cached older modules.
 */
export async function copyStaticAssets(projectRoot: string, outDir: string): Promise<string> {
  await cp(path.join(projectRoot, "public"), outDir, {
    recursive: true,
    // Type declarations exist for the typechecker, not for visitors.
    filter: (source) => !source.endsWith(".d.ts"),
  });

  const katex = path.join(projectRoot, "node_modules/katex/dist");
  await mkdir(path.join(outDir, "vendor/fonts"), { recursive: true });
  await cp(path.join(katex, "katex.min.css"), path.join(outDir, "vendor/katex.min.css"));
  await cp(path.join(katex, "fonts"), path.join(outDir, "vendor/fonts"), { recursive: true });

  const styles = path.join(projectRoot, "styles");
  const sheets = (await readdir(styles)).filter((name) => name.endsWith(".css")).sort();
  const css = await Promise.all(sheets.map(async (name) => `/* ${name} */\n${await readFile(path.join(styles, name), "utf8")}`));
  await writeFile(path.join(outDir, "style.css"), css.join("\n"));

  const scripts = (await filesUnder(outDir)).filter((file) => file.endsWith(".js") && !file.includes(`${path.sep}vendor${path.sep}`)).sort();
  const hash = createHash("sha256");
  for (const file of [path.join(outDir, "style.css"), ...scripts]) hash.update(file.slice(outDir.length)).update(await readFile(file));
  const version = hash.digest("hex").slice(0, 10);
  for (const file of scripts) {
    const source = await readFile(file, "utf8");
    await writeFile(file, source.replace(/((?:from|import)\s*\(?\s*["'])(\.{1,2}\/[^"'?]+\.js)(["'])/g, `$1$2?v=${version}$3`));
  }
  return version;
}
