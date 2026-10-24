import { escapeHtml } from "../html.js";
import { latestDate, type SiteModel } from "../site.js";
import type { WrapPage } from "./layout.js";
import { noteList } from "./note-list.js";
import type { Page } from "./page.js";

export function tagPages(site: SiteModel, wrap: WrapPage): Page[] {
  const links = site.tags
    .map((tag) => `<a href="/tags/${tag.slug}/"><span>#${escapeHtml(tag.label)}</span><span class="tag-count">${tag.notes.length}</span></a>`)
    .join("");
  const index = `<section><h1>Tags</h1><p class="page-summary">${site.tags.length} tag${site.tags.length === 1 ? "" : "s"}</p>${links ? `<div class="tag-list">${links}</div>` : "<p>No tagged notes yet.</p>"}</section>`;
  return [
    { file: "tags/index.html", html: wrap({ title: "Tags", description: "Published note tags", content: index, url: "/tags/", kind: "tags" }) },
    ...site.tags.map((tag) => {
      const notes = [...tag.notes].sort((a, b) => (latestDate(b) ?? "").localeCompare(latestDate(a) ?? "") || a.title.localeCompare(b.title));
      const content = `<section><h1>#${escapeHtml(tag.label)}</h1><p class="page-summary">${notes.length} note${notes.length === 1 ? "" : "s"}</p>${notes.length ? noteList(notes) : "<p>No published notes with this tag yet.</p>"}</section>`;
      return {
        file: `tags/${tag.slug}/index.html`,
        html: wrap({ title: `#${tag.label}`, description: `Notes tagged ${tag.label}`, content, url: `/tags/${tag.slug}/`, kind: "tag" }),
      };
    }),
  ];
}
