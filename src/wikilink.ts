import path from "node:path";
import type MarkdownIt from "markdown-it";
import type { Note } from "./types.js";

export interface WikiLink { target: string; label: string; }

export function extractWikiLinks(markdown: string): WikiLink[] {
  return [...markdown.matchAll(/(?<!!)\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g)].map((match) => ({
    target: match[1].trim(), label: (match[2] || match[1]).trim(),
  }));
}

function keys(note: Note): string[] {
  const noExtension = note.relativePath.replace(/\.md$/i, "").replace(/\\/g, "/");
  return [note.title, noExtension, path.posix.basename(noExtension)].map((key) => key.trim().toLowerCase());
}

export function createWikiResolver(notes: Note[]): (target: string) => Note | undefined {
  const index = new Map<string, Note[]>();
  for (const note of notes) for (const key of new Set(keys(note))) index.set(key, [...(index.get(key) ?? []), note]);
  return (target) => {
    const matches = index.get(target.replace(/\\/g, "/").replace(/\.md$/i, "").trim().toLowerCase());
    return matches?.length === 1 ? matches[0] : undefined;
  };
}

export function wikiLinkPlugin(md: MarkdownIt, resolve: (target: string) => Note | undefined): void {
  md.inline.ruler.before("link", "wikilink", (state, silent) => {
    const rest = state.src.slice(state.pos);
    const match = rest.match(/^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/);
    if (!match) return false;
    if (!silent) {
      const token = state.push("wikilink", "a", 0);
      token.meta = { target: match[1].trim(), label: (match[2] || match[1]).trim() };
    }
    state.pos += match[0].length;
    return true;
  });
  md.renderer.rules.wikilink = (tokens, index) => {
    const { target, label } = tokens[index].meta as WikiLink;
    const note = resolve(target);
    if (!note) {
      console.warn(`[wikilink] unresolved or ambiguous: [[${target}]]`);
      return `<span class="broken-link" title="Unresolved WikiLink">${md.utils.escapeHtml(label)}</span>`;
    }
    return `<a class="wikilink" href="${md.utils.escapeHtml(note.url)}">${md.utils.escapeHtml(label)}</a>`;
  };
}
