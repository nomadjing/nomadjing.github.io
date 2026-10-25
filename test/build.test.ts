import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSite } from "../src/build-site.js";
import { loadPublishedNotes } from "../src/content.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fm = (title: string, extra = "") => `---\ntitle: ${title}\npublish: true\n${extra}---\n`;

/** A throwaway project that shares this repo's templates, styles and dependencies. */
async function project(files: Record<string, string>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "nomad-build-"));
  for (const name of ["templates", "styles", "public"]) await cp(path.join(repo, name), path.join(root, name), { recursive: true });
  await cp(path.join(repo, "site.config.json"), path.join(root, "site.config.json"));
  await mkdir(path.join(root, "node_modules"));
  await cp(path.join(repo, "node_modules/katex"), path.join(root, "node_modules/katex"), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, "vault", name)), { recursive: true });
    await writeFile(path.join(root, "vault", name), body);
  }
  return root;
}

test("builds pages, a 404 page and plain-text descriptions", async () => {
  const root = await project({
    "research/Topic.md": `${fm("Topic", "lang: en\ntags: [ifds]\n")}# Topic heading\n\nSee **bold** [[Other]] and $x$.`,
    "research/Other.md": `${fm("Other", "created: 10/25/2026\n")}No heading here.`,
  });
  try {
    const outDir = path.join(root, "dist");
    const result = await buildSite({ projectRoot: root, outDir, contentRoot: path.join(root, "vault") });
    assert.equal(result.notes, 2);
    const notes = await readFile(path.join(outDir, "notes/index.html"), "utf8");
    assert.match(notes, /<a href="\/research\/other\/">Other<\/a><time datetime="2026-10-25">2026-10-25<\/time>/);
    const topic = await readFile(path.join(outDir, "research/topic/index.html"), "utf8");
    assert.match(topic, /<html lang="en">/);
    assert.match(topic, /<meta name="description" content="Topic heading See bold Other and \$x\$\.">/);
    assert.match(topic, /<h1 class="note-title">Topic heading<\/h1>/);
    assert.match(topic, /katex\.min\.css/);
    const version = topic.match(/\/style\.css\?v=([0-9a-f]{10})"/)?.[1];
    assert.ok(version, "stylesheet URL carries a content hash");
    assert.match(topic, new RegExp(`/main\\.js\\?v=${version}"`));
    assert.match(await readFile(path.join(outDir, "js/app.js"), "utf8"), new RegExp(`from "\\./theme\\.js\\?v=${version}"`));
    const other = await readFile(path.join(outDir, "research/other/index.html"), "utf8");
    assert.match(other, /<html lang="zh-CN">/);
    assert.match(other, /<h1 class="note-title">Other<\/h1>/);
    assert.doesNotMatch(other, /katex\.min\.css/);
    assert.match(other, /Referenced by|referenced by/);
    const notFound = await readFile(path.join(outDir, "404.html"), "utf8");
    assert.match(notFound, /data-request-path/);
    assert.match(await readFile(path.join(outDir, "style.css"), "utf8"), /--font-mono/);
    await assert.rejects(stat(path.join(outDir, "js/types.d.ts")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("directory notes sort newest first with undated notes last and title ties", async () => {
  const root = await project({
    "research/A.md": fm("A"),
    "research/B.md": fm("B", "created: 10/24/2026\n"),
    "research/C.md": fm("C", "date: 2026-10-24\n"),
    "research/D.md": fm("D", "created: 09/01/2026\nupdated: 2026-10-25\n"),
    "research/E.md": fm("E", "date: 2026-09-01\n"),
    "research/F.md": fm("F"),
    "research/nested/G.md": fm("G", "date: 2026-09-01\n"),
    "research/nested/H.md": fm("H", "date: 2026-10-25\n"),
  });
  try {
    const outDir = path.join(root, "dist");
    await buildSite({ projectRoot: root, outDir, contentRoot: path.join(root, "vault") });
    for (const file of ["notes/index.html", "research/index.html"]) {
      const html = await readFile(path.join(outDir, file), "utf8");
      const titles = [...html.matchAll(/class="tree-note"[^>]*><a[^>]*>([^<]+)<\/a>/g)].map((match) => match[1]);
      assert.deepEqual(titles, ["H", "G", "D", "B", "C", "E", "A", "F"], file);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("notes whose paths slugify to the same URL are rejected", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nomad-collide-"));
  try {
    await writeFile(path.join(root, "A B.md"), fm("one"));
    await writeFile(path.join(root, "a-b.md"), fm("two"));
    await assert.rejects(loadPublishedNotes(root), /URL collision at \/a-b\//);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
