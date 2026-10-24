import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Copies browser files, vendor CSS/fonts, and concatenates `styles/*.css` in filename order. */
export async function copyStaticAssets(projectRoot: string, outDir: string): Promise<void> {
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
}
