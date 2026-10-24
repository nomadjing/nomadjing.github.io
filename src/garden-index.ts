import { plainText } from "./html.js";
import { siteViews } from "./navigation.js";
import type { SiteModel } from "./site.js";

/** The terminal's view of the site; fetched the first time the terminal opens. */
export function gardenIndex(site: SiteModel): string {
  const { config, tags, about, contentNotes, directoryPages } = site;
  return JSON.stringify({
    author: config.author,
    tagline: config.tagline,
    subtitle: config.subtitle,
    views: siteViews,
    links: tags.flatMap((tag) => tag.notes.map((note) => ({
      directory: `/tags/${tag.slug}`,
      path: `/tags/${tag.slug}${note.url}`,
      title: note.title,
      target: `/notes${note.url}`,
    }))),
    directories: [
      ...Object.values(siteViews).map((url) => ({ path: url === "/" ? "/" : url.replace(/\/$/, ""), url })),
      ...tags.map((tag) => ({ path: `/tags/${tag.slug}`, url: `/tags/${tag.slug}/` })),
      ...directoryPages.map((directory) => ({ path: `/notes${directory.url.replace(/\/$/, "")}`, url: directory.url })),
    ],
    about: about ? { title: about.title, text: plainText(about.markdown) } : undefined,
    notes: contentNotes.map((note) => ({
      title: note.title,
      url: note.url,
      path: `/notes${note.url}`,
      date: note.date,
      updated: note.updated,
      tags: note.tags,
      text: plainText(note.markdown),
    })),
  });
}
