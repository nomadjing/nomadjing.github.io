import { slugify } from "../content.js";
import { escapeHtml, fill } from "../html.js";
import { latestDate, type SiteModel } from "../site.js";
import type { Note } from "../types.js";
import type { WrapPage } from "./layout.js";
import type { Page } from "./page.js";
import { noteList } from "./note-list.js";

const writingCount = 5;

/** Only https URLs become links; anything else stays plain text. */
function safeHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function homePage(site: SiteModel, template: string, wrap: WrapPage): Page {
  const { config, contentNotes } = site;
  const recent = [...contentNotes].sort((a, b) => (latestDate(b) ?? "").localeCompare(latestDate(a) ?? ""));
  const featured = (config.featuredWriting ?? [])
    .map((reference) => contentNotes.find((note) => note.title === reference || note.url === reference || note.relativePath.replace(/\\/g, "/") === reference))
    .filter((note): note is Note => Boolean(note));
  const writing = [...new Set([...featured, ...recent])].slice(0, writingCount);

  const facts: Array<[string, string]> = [];
  if (config.hobbies?.length)
    facts.push(["off the clock", config.hobbies.map((hobby) => `<span>${escapeHtml(hobby)}</span>`).join("")]);

  const content = fill(template, {
    DISPLAY_NAME: escapeHtml(config.displayName ?? config.author),
    TAGLINE: escapeHtml(config.tagline),
    INTRO: escapeHtml(config.intro ?? config.subtitle),
    RESEARCH_KEYWORDS: site.researchKeywords
      .map((keyword) => `<a href="/tags/${slugify(keyword)}/">#${escapeHtml(site.tags.find((tag) => tag.slug === slugify(keyword))?.label ?? keyword)}</a>`)
      .join(""),
    FACTS: facts.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join(""),
    PROJECTS: (config.projects ?? []).slice(0, 3).map((project) => {
      const href = safeHref(project.url);
      const title = href ? `<a href="${escapeHtml(href)}">${escapeHtml(project.title)}</a>` : escapeHtml(project.title);
      return `<div class="project-row"><div class="project-head"><h3>${title}</h3>${project.status ? `<span class="project-status">[${escapeHtml(project.status)}]</span>` : ""}</div><p>${escapeHtml(project.description)}</p></div>`;
    }).join(""),
    NOW: site.now ? `<section class="home-section now"><h2 class="section-title">now</h2><div class="prose">${site.now.html}</div></section>` : "",
    WRITING: noteList(writing),
  });
  return {
    file: "index.html",
    html: wrap({ title: config.siteName, description: config.subtitle, content, url: "/", kind: "home", math: Boolean(site.now?.html.includes('class="katex')) }),
  };
}
