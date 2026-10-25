import { escapeHtml } from "../html.js";
import { countNotes, directoryUrl, latestDate, type SiteModel, type TreeNode } from "../site.js";
import type { WrapPage } from "./layout.js";
import { pageFile, type Page } from "./page.js";

/** URLs owned by generated pages; a directory with one of these URLs gets no listing page. */
const reservedUrls = ["/archive/", "/notes/", "/tags/", "/about/"];

function renderTree(node: TreeNode, depth = 0, prefix: string[] = []): string {
  const directories = [...node.directories]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, child]) => {
      const parts = [...prefix, name];
      return `<li class="tree-directory"><details${depth === 0 ? " open" : ""}><summary><a href="${directoryUrl(parts)}">${escapeHtml(name)}/</a></summary>${renderTree(child, depth + 1, parts)}</details></li>`;
    });
  const notes = [...node.notes]
    .sort((a, b) => (latestDate(b) ?? "").localeCompare(latestDate(a) ?? "") || a.title.localeCompare(b.title))
    .map((note) => {
      const date = latestDate(note);
      return `<li class="tree-note" data-search="${escapeHtml(`${note.title} ${note.relativePath}`.toLocaleLowerCase())}"><a href="${note.url}">${escapeHtml(note.title)}</a>${date ? `<time datetime="${date}">${date}</time>` : ""}</li>`;
    });
  return `<ul class="tree-list">${[...directories, ...notes].join("")}</ul>`;
}

function summary(node: TreeNode): string {
  const notes = countNotes(node);
  const directories = node.directories.size;
  return `<p class="page-summary">${notes} note${notes === 1 ? "" : "s"}${directories ? ` · ${directories} director${directories === 1 ? "y" : "ies"}` : ""}</p>`;
}

export function notesPages(site: SiteModel, wrap: WrapPage): Page[] {
  const index = `<section class="archive-page"><h1>Notes</h1>${summary(site.tree)}<label class="archive-search"><span aria-hidden="true">/</span><input id="archive-query" type="search" aria-label="Search notes" placeholder="search notes" aria-keyshortcuts="/" autocomplete="off"></label><div class="tree archive-tree">${renderTree(site.tree)}</div><ul class="archive-results" id="archive-results" hidden></ul><p class="archive-empty" id="archive-empty" hidden>no matches.</p></section>`;
  const pages: Page[] = [{
    file: "notes/index.html",
    html: wrap({ title: "Notes", description: "All published notes", content: index, url: "/notes/", kind: "notes" }),
  }];
  for (const directory of site.directoryPages) {
    if (reservedUrls.includes(directory.url) || site.notes.some((note) => note.url === directory.url)) continue;
    const content = `<section><h1>${escapeHtml(directory.title)}</h1>${summary(directory.node)}<div class="tree archive-tree">${renderTree(directory.node, 0, directory.parts)}</div></section>`;
    pages.push({
      file: pageFile(directory.url),
      html: wrap({ title: directory.title, description: `${directory.title} notes`, content, url: directory.url, kind: "directory" }),
    });
  }
  return pages;
}
