import { escapeHtml } from "../html.js";
import type { SiteModel } from "../site.js";
import type { WrapPage } from "./layout.js";
import type { Page } from "./page.js";

/** An about page for sites whose about note lives elsewhere, or that have none. */
export function aboutPage(site: SiteModel, wrap: WrapPage): Page | undefined {
  if (site.notes.some((note) => note.url === "/about/")) return undefined;
  const body = site.about?.html ?? `<p>${escapeHtml(site.config.author)}</p>`;
  return {
    file: "about/index.html",
    html: wrap({ title: "about", description: `About ${site.config.author}`, content: `<section><h1>About</h1><div class="prose">${body}</div></section>`, url: "/about/", kind: "about", lang: site.about?.lang }),
  };
}

/** `/archive/` was the old notes URL; keep old links working. */
export const archiveRedirect: Page = {
  file: "archive/index.html",
  html: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/notes/"><link rel="canonical" href="/notes/"><title>Notes</title></head><body><a href="/notes/">Go to Notes</a></body></html>',
};

/** GitHub Pages serves `/404.html` for every missing path, so all its links are absolute. */
export function notFoundPage(template: string, wrap: WrapPage): Page {
  return {
    file: "404.html",
    html: wrap({ title: "404", description: "Page not found", content: template, url: "/404/", kind: "not-found", lang: "en" }),
  };
}
