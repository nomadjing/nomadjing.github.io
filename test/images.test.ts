import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createImageAssets } from "../src/images.js";
import { createMarkdownRenderer } from "../src/markdown.js";
import type { Note } from "../src/types.js";

test("publishes only images referenced by a note", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "garden-images-"));
  try {
    const assets = path.join(root, "vault", "assets", "image");
    const notes = path.join(root, "vault", "notes");
    const output = path.join(root, "dist");
    await Promise.all([mkdir(assets, { recursive: true }), mkdir(notes, { recursive: true })]);
    await Promise.all([
      writeFile(path.join(assets, "Diagram One.png"), "published image"),
      writeFile(path.join(assets, "private.png"), "unreferenced image"),
    ]);
    const note = { sourcePath: path.join(notes, "Published.md"), relativePath: "notes/Published.md", title: "Published" } as Note;
    const images = await createImageAssets(path.join(root, "vault"));
    const renderer = createMarkdownRenderer([note], images.resolve);
    const html = renderer.render("![[Diagram One.png]]\n\n![diagram](../assets/image/Diagram%20One.png)", { note });
    assert.match(html, /src="\/media\/assets\/image\/Diagram%20One\.png"/);
    assert.equal((html.match(/<img /g) ?? []).length, 2);
    assert.equal(await images.copyTo(output), 1);
    assert.equal(await readFile(path.join(output, "media", "assets", "image", "Diagram One.png"), "utf8"), "published image");
    await assert.rejects(stat(path.join(output, "media", "assets", "image", "private.png")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
