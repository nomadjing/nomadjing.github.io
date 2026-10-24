import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { copyStaticAssets } from "./assets.js";
import { buildBacklinks } from "./backlinks.js";
import { loadConfig } from "./config.js";
import { loadSiteContent } from "./content.js";
import { gardenIndex } from "./garden-index.js";
import { createImageAssets } from "./images.js";
import { createMarkdownRenderer } from "./markdown.js";
import { homePage } from "./pages/home.js";
import { createLayout } from "./pages/layout.js";
import { aboutPage, archiveRedirect, notFoundPage } from "./pages/misc.js";
import { notePage } from "./pages/note.js";
import { notesPages } from "./pages/notes.js";
import type { Page } from "./pages/page.js";
import { tagPages } from "./pages/tags.js";
import { createSiteModel } from "./site.js";

export interface BuildOptions {
  projectRoot: string;
  outDir: string;
  /** Overrides the config's content roots (the `CONTENT_ROOT` environment variable). */
  contentRoot?: string;
}

export async function buildSite({ projectRoot, outDir, contentRoot: override }: BuildOptions) {
  const config = await loadConfig(projectRoot);
  const { root: contentRoot, notes } = await loadSiteContent(projectRoot, config, override);
  const site = createSiteModel(config, notes);

  const images = await createImageAssets(contentRoot);
  const markdown = createMarkdownRenderer(notes, images.resolve);
  for (const note of notes) note.html = markdown.render(note.markdown, { note });

  const template = (name: string) => readFile(path.join(projectRoot, "templates", name), "utf8");
  const [layout, noteTemplate, indexTemplate, notFoundTemplate] = await Promise.all(
    ["layout.html", "note.html", "index.html", "not-found.html"].map(template),
  );
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const assetVersion = await copyStaticAssets(projectRoot, outDir);
  const wrap = createLayout(layout, site, assetVersion);
  const backlinks = buildBacklinks(notes);

  const pages: Page[] = [
    ...notes.map((note) => notePage(note, backlinks.get(note.url) ?? [], noteTemplate, wrap, note === site.about ? "about" : "note")),
    ...[aboutPage(site, wrap)].filter((page): page is Page => Boolean(page)),
    ...notesPages(site, wrap),
    ...tagPages(site, wrap),
    homePage(site, indexTemplate, wrap),
    notFoundPage(notFoundTemplate, wrap),
    archiveRedirect,
  ];
  const owners = new Set<string>();
  for (const page of pages) {
    if (owners.has(page.file)) throw new Error(`Two pages would be written to ${page.file}; rename the note or directory that uses this URL`);
    owners.add(page.file);
  }

  for (const page of pages) {
    const output = path.join(outDir, page.file);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, page.html);
  }
  await writeFile(path.join(outDir, "garden-index.json"), gardenIndex(site));
  const copiedImages = await images.copyTo(outDir);
  return { contentRoot, notes: notes.length, pages: pages.length, images: copiedImages };
}
