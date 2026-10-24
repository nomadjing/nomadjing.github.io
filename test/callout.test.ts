import assert from "node:assert/strict";
import test from "node:test";
import { createMarkdownRenderer } from "../src/markdown.js";
import type { Note } from "../src/types.js";

const note = { relativePath: "dir/Lec04.md", bodyLine: 6 } as Note;
const render = (markdown: string) => createMarkdownRenderer([]).render(markdown, { note });

test("callouts render as diagnostics citing file and line", () => {
  const html = render("intro\n\n> [!tip] Insights\n> body **text**\n");
  assert.match(html, /<aside class="callout callout-help" data-callout="tip"><p class="callout-head"><span class="callout-severity">help<\/span><span class="callout-title">: Insights<\/span><\/p>/);
  assert.match(html, /--&gt;<\/span> Lec04\.md:8<\/p>/);
  assert.match(html, /<div class="callout-body">\n<p>body <strong>text<\/strong><\/p>\n<\/div><\/aside>/);
  assert.doesNotMatch(html, /\[!tip\]/);
});

test("callout kinds map to severities, fold markers make details", () => {
  assert.match(render("> [!danger]\n> x"), /callout-error[^>]*><p class="callout-head"><span class="callout-severity">error<\/span><span class="callout-title">: danger<\/span>/);
  assert.match(render("> [!note]\n> x"), /<span class="callout-severity">note<\/span><\/p>/);
  assert.match(render("> [!warning]- Careful\n> x"), /<details class="callout callout-warning" data-callout="warning"><summary/);
  assert.match(render("> [!faq]+ Q\n> x"), /<details[^>]* open><summary/);
  assert.match(render("> plain quote"), /<blockquote>/);
});
