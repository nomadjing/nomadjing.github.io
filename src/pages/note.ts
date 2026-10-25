import { slugify } from "../content.js";
import { escapeHtml, fill, plainText, readingMinutes } from "../html.js";
import type { Note } from "../types.js";
import type { WrapPage } from "./layout.js";
import { pageFile, type Page } from "./page.js";

function metadata(note: Note): string {
  const tags = note.tags.map((tag) => `<a href="/tags/${slugify(tag)}/">#${escapeHtml(tag)}</a>`).join(" ");
  const rows: Array<[string, string]> = [];
  if (note.date) rows.push(["created", `<time datetime="${note.date}">${note.date}</time>`]);
  if (note.updated && note.updated !== note.date) rows.push(["updated", `<time datetime="${note.updated}">${note.updated}</time>`]);
  if (note.status) rows.push(["status", escapeHtml(note.status)]);
  rows.push(["read", `~${readingMinutes(note.markdown)} min`]);
  if (note.tags.length) rows.push(["tags", tags]);
  return rows.map(([key, value]) => `<div${key === "tags" ? ' class="metadata-tags"' : ""}><dt>${key}</dt><dd>${value}</dd></div>`).join("");
}

/** A note's leading `# heading` becomes the page title; otherwise the frontmatter title is shown. */
function splitTitle(note: Note): { title: string; body: string } {
  const match = note.html.match(/^\s*<h1[^>]*>([\s\S]*?)<\/h1>\s*/);
  if (match) return { title: `<h1 class="note-title">${match[1]}</h1>`, body: note.html.slice(match[0].length) };
  return { title: `<h1 class="note-title">${escapeHtml(note.title)}</h1>`, body: note.html };
}

export function notePage(note: Note, incoming: Note[], template: string, wrap: WrapPage, kind: "note" | "about"): Page {
  const backlinks = incoming.length
    ? `<section class="backlinks"><h2 class="section-title">referenced by</h2><ul>${incoming.map((source) => `<li><a href="${source.url}">${escapeHtml(source.title)}</a></li>`).join("")}</ul></section>`
    : "";
  const { title, body } = splitTitle(note);
  const content = fill(template, { TITLE: title, METADATA: metadata(note), CONTENT: body, BACKLINKS: backlinks });
  return {
    file: pageFile(note.url),
    html: wrap({
      title: note.title,
      description: plainText(note.markdown, 160),
      content,
      url: note.url,
      kind,
      lang: note.lang,
      math: note.html.includes('class="katex'),
    }),
  };
}
