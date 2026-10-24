import { escapeHtml, fill } from "../html.js";
import { pageNavigation, siteViews, type Breadcrumb, type PageKind } from "../navigation.js";
import type { SiteModel } from "../site.js";

export interface PageOptions {
  title: string;
  description: string;
  content: string;
  url: string;
  kind: PageKind;
  lang?: string;
  /** Only pages that render math pull in the KaTeX stylesheet. */
  math?: boolean;
}
export type WrapPage = (options: PageOptions) => string;

function headerPath(breadcrumbs: Breadcrumb[]): string {
  const parts = [`<a class="path-home" href="/">${escapeHtml(breadcrumbs[0].label)}</a>`];
  if (breadcrumbs.length === 1) return parts[0];
  const hasMiddle = breadcrumbs.length > 3;
  const hiddenPaths = breadcrumbs.slice(2, -1)
    .map((crumb) => `<a href="${escapeHtml(crumb.url)}">${escapeHtml(crumb.label)}</a>`)
    .join("");
  breadcrumbs.slice(1).forEach((crumb, index) => {
    const isLast = index === breadcrumbs.length - 2;
    parts.push(`<span class="path-separator">/</span>`);
    if (index === 1 && hasMiddle)
      parts.push(`<details class="path-ellipsis"><summary aria-label="Show hidden path segments">…</summary><div class="path-ellipsis-menu">${hiddenPaths}</div></details><span class="path-separator path-ellipsis">/</span>`);
    if (isLast) parts.push(`<span class="path-current">${escapeHtml(crumb.label)}</span>`);
    else parts.push(`<a class="${index === 0 ? "path-section" : "path-middle"}" href="${escapeHtml(crumb.url)}">${escapeHtml(crumb.label)}</a>`);
  });
  return parts.join("");
}

function footer(site: SiteModel): string {
  const { config } = site;
  const name = escapeHtml(config.displayName ?? config.author);
  return `<span>© ${new Date().getFullYear()} ${name}</span><span class="footer-hint">press <kbd>\`</kbd> to open the terminal</span>`;
}

export function createLayout(template: string, site: SiteModel): WrapPage {
  const { config } = site;
  const footerHtml = footer(site);
  return ({ title, description, content, url, kind, lang, math }) => {
    const navigation = pageNavigation(config.siteName, url, title, kind, site.directoryLabels);
    const active = (name: "notes" | "tags" | "about") =>
      navigation.section === name ? `class="active" aria-current="${url === siteViews[name] ? "page" : "location"}"` : "";
    return fill(template, {
      LANG: escapeHtml(lang ?? config.lang),
      PAGE_TITLE: title === config.siteName ? escapeHtml(title) : `${escapeHtml(title)} · ${escapeHtml(config.siteName)}`,
      DESCRIPTION: escapeHtml(description),
      HEAD_EXTRA: math ? `<link rel="stylesheet" href="/vendor/katex.min.css">` : "",
      PAGE_KIND: kind,
      PARENT_LINK: navigation.parentUrl
        ? `<a class="path-up" id="parent-link" href="${escapeHtml(navigation.parentUrl)}" rel="up" aria-label="返回上一级" aria-keyshortcuts="Alt+ArrowUp" title="返回上一级 (Alt+↑)">‹</a>`
        : "",
      HEADER_PATH: headerPath(navigation.breadcrumbs),
      FULL_PATH: escapeHtml(navigation.breadcrumbs.map((crumb) => crumb.label).join("/")),
      DIRECTORY_PATH: escapeHtml(navigation.directory),
      NAV_NOTES_ATTR: active("notes"),
      NAV_TAGS_ATTR: active("tags"),
      NAV_ABOUT_ATTR: active("about"),
      CONTENT: content,
      FOOTER: footerHtml,
    });
  };
}
