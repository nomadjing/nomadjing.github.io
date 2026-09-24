import { createWikiResolver, extractWikiLinks } from "./wikilink.js";
import type { Note } from "./types.js";

export function buildBacklinks(notes: Note[]): Map<string, Note[]> {
  const resolve = createWikiResolver(notes);
  const backlinks = new Map(notes.map((note) => [note.url, [] as Note[]]));
  for (const source of notes) {
    for (const link of extractWikiLinks(source.markdown)) {
      const target = resolve(link.target);
      if (target && target.url !== source.url && !backlinks.get(target.url)!.some((note) => note.url === source.url)) backlinks.get(target.url)!.push(source);
    }
  }
  return backlinks;
}
