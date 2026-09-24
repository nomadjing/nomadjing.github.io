import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildBacklinks } from "../src/backlinks.js";
import { loadPublishedNotes, loadSiteContent } from "../src/content.js";
import { createMarkdownRenderer } from "../src/markdown.js";

test("private by default and A/C link back to B", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nomad-garden-"));
  await mkdir(path.join(root, "notes"));
  const fm = (title: string, body = "") => `---\ntitle: ${title}\npublish: true\n---\n${body}`;
  await Promise.all([
    writeFile(path.join(root, "notes/A.md"), fm("A", "[[B]]")),
    writeFile(path.join(root, "notes/B.md"), fm("B", "$x^2$\n\n```mermaid\ngraph LR\nA-->B\n```")),
    writeFile(path.join(root, "notes/C.md"), fm("C", "[[B|page B]]")),
    writeFile(path.join(root, "notes/Quoted.md"), "---\ntitle: Quoted\npublish: \"true\"\n---\nvisible"),
    writeFile(path.join(root, "notes/False.md"), "---\ntitle: False\npublish: \"false\"\n---\nNEVER_PUBLISH"),
    writeFile(path.join(root, "secret.md"), "---\ntitle: Secret\n---\nNEVER_PUBLISH"),
  ]);
  const notes = await loadPublishedNotes(root);
  assert.deepEqual(notes.map((note) => note.title), ["A", "B", "C", "Quoted"]);
  const b = notes.find((note) => note.title === "B")!;
  assert.deepEqual(buildBacklinks(notes).get(b.url)?.map((note) => note.title), ["A", "C"]);
  const renderer = createMarkdownRenderer(notes);
  assert.match(renderer.render("[[B]]"), /class="wikilink"/);
  assert.match(renderer.render(b.markdown), /class="katex"/);
  assert.match(renderer.render(b.markdown), /class="mermaid"/);
});

test("renders boxed display math with the current KaTeX", () => {
  const formula = String.raw`$$
\boxed{ \text{Cost per successful task} = \frac{\text{token cost + tool cost + time cost}} {\Pr(\text{task solved correctly})} }
$$`;
  const html = createMarkdownRenderer([]).render(formula);
  assert.match(html, /class="katex-display"/);
  assert.match(html, /Cost per successful task/);
  assert.doesNotMatch(html, /katex-error/);
});

test("uses fallback notes when the primary vault has no published notes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nomad-content-"));
  const primary = path.join(root, "vault");
  const fallback = path.join(root, "content");
  const emptyOverride = path.join(root, "empty");
  try {
    await Promise.all([mkdir(primary), mkdir(fallback), mkdir(emptyOverride)]);
    await writeFile(path.join(primary, "draft.md"), "---\ntitle: Draft\n---\nprivate");
    await writeFile(path.join(fallback, "public.md"), "---\ntitle: Public\npublish: true\n---\nvisible");
    const config = { contentRoot: "vault", fallbackContentRoot: "content" };

    const selected = await loadSiteContent(root, config);
    assert.equal(selected.root, fallback);
    assert.deepEqual(selected.notes.map((note) => note.title), ["Public"]);

    await writeFile(path.join(primary, "published.md"), "---\ntitle: Primary\npublish: true\n---\nvisible");
    assert.equal((await loadSiteContent(root, config)).root, primary);
    assert.deepEqual((await loadSiteContent(root, config, emptyOverride)).notes, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
