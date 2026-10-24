import path from "node:path";
import type MarkdownIt from "markdown-it";
import type { Note } from "./types.js";

export type Severity = "note" | "help" | "warning" | "error";

/** Obsidian callout types, mapped onto compiler-diagnostic severities. */
const severities: Record<string, Severity> = {
  note: "note", info: "note", abstract: "note", summary: "note", tldr: "note", todo: "note",
  example: "note", quote: "note", cite: "note", success: "note", check: "note", done: "note",
  tip: "help", hint: "help", important: "help", question: "help", help: "help", faq: "help",
  warning: "warning", caution: "warning", attention: "warning",
  danger: "error", error: "error", failure: "error", fail: "error", missing: "error", bug: "error",
};
export const severityOf = (kind: string): Severity => severities[kind] ?? "note";

interface CalloutMeta { kind: string; fold: string; title: string; line?: number; }

/**
 * Renders Obsidian callouts (`> [!tip] Title`) like rustc diagnostics:
 *
 *   help: Title
 *     --> note.md:42
 *      │ body…
 *
 * `[!kind]-` / `[!kind]+` fold closed / open, as in Obsidian.
 */
export function calloutPlugin(md: MarkdownIt): void {
  md.core.ruler.before("inline", "callout", (state) => {
    const tokens = state.tokens;
    for (let index = 0; index < tokens.length; index += 1) {
      const open = tokens[index];
      const inline = tokens[index + 2];
      if (open.type !== "blockquote_open" || tokens[index + 1]?.type !== "paragraph_open" || inline?.type !== "inline") continue;
      const match = inline.content.match(/^\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)(?:\n([\s\S]*))?$/);
      if (!match) continue;
      let depth = 0;
      const close = tokens.findIndex((token, at) => {
        if (at < index) return false;
        if (token.type === "blockquote_open") depth += 1;
        else if (token.type === "blockquote_close") depth -= 1;
        return depth === 0;
      });
      if (close < 0) continue;
      const [, kind, fold, title, rest = ""] = match;
      const meta: CalloutMeta = { kind: kind.toLowerCase(), fold, title: title.trim(), line: open.map?.[0] };
      open.type = "callout_open";
      open.meta = meta;
      tokens[close].type = "callout_close";
      tokens[close].meta = meta;
      // The first paragraph held only the marker line: drop it, or keep the rest of it.
      if (rest.trim()) inline.content = rest;
      else tokens.splice(index + 1, 3);
    }
  });

  md.renderer.rules.callout_open = (tokens, index, _options, env) => {
    const { kind, fold, title, line } = tokens[index].meta as CalloutMeta;
    const severity = severityOf(kind);
    const note = (env as { note?: Note }).note;
    const label = title || (kind === severity ? "" : kind);
    const head = `<span class="callout-severity">${severity}</span>${label ? `<span class="callout-title">: ${md.utils.escapeHtml(label)}</span>` : ""}`;
    const location = note && line !== undefined
      ? `<p class="callout-source"><span aria-hidden="true">--&gt;</span> ${md.utils.escapeHtml(path.basename(note.relativePath))}:${(note.bodyLine ?? 1) + line}</p>`
      : "";
    const classes = `callout callout-${severity}`;
    if (fold) return `<details class="${classes}" data-callout="${md.utils.escapeHtml(kind)}"${fold === "+" ? " open" : ""}><summary class="callout-head">${head}</summary>${location}<div class="callout-body">\n`;
    return `<aside class="${classes}" data-callout="${md.utils.escapeHtml(kind)}"><p class="callout-head">${head}</p>${location}<div class="callout-body">\n`;
  };
  md.renderer.rules.callout_close = (tokens, index) =>
    `</div></${(tokens[index].meta as CalloutMeta).fold ? "details" : "aside"}>\n`;
}
