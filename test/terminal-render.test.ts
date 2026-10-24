import assert from "node:assert/strict";
import test from "node:test";
import { createGarden } from "../public/js/terminal/garden.js";
import { inputHtml, lineHtml, suggestion } from "../public/js/terminal/render.js";

const garden = createGarden({
  author: "nomad", tagline: "", subtitle: "",
  views: { home: "/", notes: "/notes/", tags: "/tags/", about: "/about/" },
  directories: [{ path: "/", url: "/" }, { path: "/notes", url: "/notes/" }, { path: "/notes/research", url: "/research/" }],
  notes: [{ title: "Lambda", url: "/research/lambda/", path: "/notes/research/lambda/" }],
});
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

test("command lines are coloured like fish without changing their text", () => {
  assert.match(inputHtml("cd research", "/notes", garden), /<span class="cmd-ok">cd<\/span> <span class="arg-valid">research<\/span>/);
  assert.match(inputHtml("tre", "/", garden), /cmd-partial/);
  assert.match(inputHtml("rm -rf <x>", "/", garden), /cmd-bad/);
  assert.equal(text(inputHtml("open <Lambda>", "/notes/research", garden)), "open <Lambda>");
});

test("suggestions prefer history, then a unique completion", () => {
  assert.equal(suggestion("cd r", ["cd research", "ls"], "/notes", garden), "esearch");
  assert.equal(suggestion("op", [], "/", garden), "en");
  assert.equal(suggestion("open La", [], "/notes/research", garden), "mbda");
  assert.equal(suggestion("open ", [], "/notes/research", garden), "");
  assert.equal(suggestion("zzz", [], "/", null), "");
});

test("ls and tree output keep their exact text when coloured", () => {
  for (const line of ["about/  notes/  tags/", ".\n├── research/\n  └── Lambda", "Note -> /notes/research/note"])
    assert.equal(text(lineHtml(line, "listing")!), line);
  assert.match(lineHtml("about/  Lambda", "listing")!, /ls-dir">about\/<\/span>  <span class="ls-note">Lambda/);
  assert.equal(lineHtml("plain", "hint"), null);
});

test("404 suggests the closest note and measures wide characters", async () => {
  const { closestNote, displayWidth } = await import("../public/js/not-found.js");
  const notes = [{ url: "/vibe-coding/lec03-版本管理/", path: "/notes/vibe-coding/lec03-版本管理/" }, { url: "/dipl/类型系统/", path: "/notes/dipl/类型系统/" }];
  assert.equal(closestNote("/vibe-coding/lec03/", notes)?.url, "/vibe-coding/lec03-版本管理/");
  assert.equal(closestNote("/dipl/类型系通/", notes)?.url, "/dipl/类型系统/");
  assert.equal(closestNote("/completely-unrelated/", notes), undefined);
  assert.equal(displayWidth("/a/版本"), 7);
});
