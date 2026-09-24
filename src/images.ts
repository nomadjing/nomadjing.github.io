import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import type { Note } from "./types.js";

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"]);

async function imageFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    if (entry.name.startsWith(".")) return [];
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return imageFiles(file);
    return entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()) ? [file] : [];
  }))).flat();
}

export async function createImageAssets(contentRoot: string): Promise<{
  resolve: (target: string, note: Note) => string | undefined;
  copyTo: (outputRoot: string) => Promise<number>;
}> {
  const root = path.resolve(contentRoot);
  const files = await imageFiles(root);
  const available = new Set(files);
  const byName = new Map<string, string[]>();
  for (const file of files) {
    const name = path.basename(file).toLowerCase();
    byName.set(name, [...(byName.get(name) ?? []), file]);
  }
  const referenced = new Map<string, string>();

  const resolve = (target: string, note: Note): string | undefined => {
    let decoded: string;
    try { decoded = decodeURIComponent(target.split(/[?#]/, 1)[0]); }
    catch { console.warn(`[image] invalid path: ${target}`); return undefined; }
    const location = decoded.replace(/\\/g, "/");
    const relative = location.replace(/^\/+/, "");
    const candidates = [
      path.resolve(path.dirname(note.sourcePath), location),
      path.resolve(root, relative),
    ];
    let file = candidates.find((candidate) => available.has(candidate));
    if (!file && !relative.includes("/")) {
      const matches = byName.get(relative.toLowerCase()) ?? [];
      if (matches.length === 1) file = matches[0];
      else if (matches.length > 1) console.warn(`[image] ambiguous: ${target} in ${note.relativePath}`);
    }
    if (!file) {
      console.warn(`[image] unresolved: ${target} in ${note.relativePath}`);
      return undefined;
    }
    const sourceRelative = path.relative(root, file);
    referenced.set(file, sourceRelative);
    return `/media/${sourceRelative.split(path.sep).map(encodeURIComponent).join("/")}`;
  };

  const copyTo = async (outputRoot: string): Promise<number> => {
    for (const [source, relative] of referenced) {
      const destination = path.join(outputRoot, "media", relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
    return referenced.size;
  };

  return { resolve, copyTo };
}
