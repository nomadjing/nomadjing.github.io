import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { Note, NoteStatus, SiteConfig } from "./types.js";

async function markdownFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    if (entry.name.startsWith(".")) return [];
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) return markdownFiles(root, fullPath);
    return entry.isFile() && entry.name.toLowerCase().endsWith(".md") ? [fullPath] : [];
  }))).flat();
}

export function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function isoDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" || typeof value === "number") return String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
}

function noteUrl(relativePath: string): string {
  const parts = relativePath.replace(/\.md$/i, "").split(path.sep).map(slugify).filter(Boolean);
  return `/${parts.join("/")}/`;
}

export async function loadPublishedNotes(contentRoot: string): Promise<Note[]> {
  const notes: Note[] = [];
  for (const sourcePath of await markdownFiles(contentRoot)) {
    const parsed = matter(await readFile(sourcePath, "utf8"));
    if (parsed.data.publish !== true && parsed.data.publish !== "true") continue;
    const relativePath = path.relative(contentRoot, sourcePath);
    const url = noteUrl(relativePath);
    const status = ["seed", "growing", "stable"].includes(parsed.data.status) ? parsed.data.status as NoteStatus : undefined;
    notes.push({ sourcePath, relativePath, url, outputPath: path.join(...url.split("/").filter(Boolean), "index.html"), markdown: parsed.content, html: "",
      title: typeof parsed.data.title === "string" ? parsed.data.title : path.basename(sourcePath, path.extname(sourcePath)),
      date: isoDate(parsed.data.date), updated: isoDate(parsed.data.updated), tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [], status });
  }
  return notes.sort((a, b) => a.title.localeCompare(b.title));
}

export async function loadSiteContent(projectRoot: string, config: Pick<SiteConfig, "contentRoot" | "fallbackContentRoot">, override?: string): Promise<{ root: string; notes: Note[] }> {
  if (override) {
    const root = path.resolve(override);
    return { root, notes: await loadPublishedNotes(root) };
  }

  const primary = path.resolve(projectRoot, config.contentRoot);
  const candidates = [primary, ...(config.fallbackContentRoot ? [path.resolve(projectRoot, config.fallbackContentRoot)] : [])];
  let firstExisting: { root: string; notes: Note[] } | undefined;
  for (const root of new Set(candidates)) {
    if (!await stat(root).then((info) => info.isDirectory(), () => false)) continue;
    const result = { root, notes: await loadPublishedNotes(root) };
    firstExisting ??= result;
    if (result.notes.length) {
      if (root !== primary) console.warn(`[content] no published notes in ${primary}; using ${root}`);
      return result;
    }
  }
  if (firstExisting) return firstExisting;
  throw new Error(`Content roots do not exist: ${candidates.join(", ")}`);
}
