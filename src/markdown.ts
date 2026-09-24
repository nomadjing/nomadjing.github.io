import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import katex from "katex";
import katexPlugin from "markdown-it-katex";
import { createWikiResolver, wikiLinkPlugin } from "./wikilink.js";
import type { Note } from "./types.js";

export function createMarkdownRenderer(notes: Note[], resolveImage?: (target: string, note: Note) => string | undefined): MarkdownIt {
  const markdown: MarkdownIt = new MarkdownIt({ html: false, linkify: true, typographer: true, highlight(code, language): string {
    if (language && hljs.getLanguage(language)) return `<pre class="hljs"><code>${hljs.highlight(code, { language }).value}</code></pre>`;
    return `<pre class="hljs"><code>${markdown.utils.escapeHtml(code)}</code></pre>`;
  } });
  markdown.use(katexPlugin);
  markdown.renderer.rules.math_inline = (tokens, index) =>
    katex.renderToString(tokens[index].content, { throwOnError: false });
  markdown.renderer.rules.math_block = (tokens, index) =>
    `<p>${katex.renderToString(tokens[index].content, { displayMode: true, throwOnError: false })}</p>\n`;
  markdown.use(wikiLinkPlugin, createWikiResolver(notes));
  markdown.inline.ruler.before("wikilink", "obsidian_image", (state, silent) => {
    const match = state.src.slice(state.pos).match(/^!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (!match) return false;
    if (!silent) {
      const token = state.push("obsidian_image", "img", 0);
      token.meta = { target: match[1].trim(), alt: match[2]?.trim() };
    }
    state.pos += match[0].length;
    return true;
  });
  markdown.renderer.rules.obsidian_image = (tokens, index, _options, env) => {
    const { target, alt } = tokens[index].meta as { target: string; alt?: string };
    const note = (env as { note?: Note }).note;
    const url = note && resolveImage?.(target, note);
    if (!url) return `<span class="broken-link" title="Unresolved image">${markdown.utils.escapeHtml(alt ?? target)}</span>`;
    const description = alt ?? target.split("/").at(-1) ?? target;
    return `<img src="${markdown.utils.escapeHtml(url)}" alt="${markdown.utils.escapeHtml(description)}" loading="lazy" decoding="async">`;
  };
  const fallbackImage = markdown.renderer.rules.image!;
  markdown.renderer.rules.image = (tokens, index, options, env, self) => {
    const source = tokens[index].attrGet("src");
    const note = (env as { note?: Note }).note;
    if (source && note && resolveImage && !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(source)) {
      const url = resolveImage(source, note);
      if (!url) return `<span class="broken-link" title="Unresolved image">${markdown.utils.escapeHtml(tokens[index].content)}</span>`;
      tokens[index].attrSet("src", url);
    }
    tokens[index].attrSet("loading", "lazy");
    tokens[index].attrSet("decoding", "async");
    return fallbackImage(tokens, index, options, env, self);
  };
  const fallbackFence = markdown.renderer.rules.fence!;
  markdown.renderer.rules.fence = (tokens, index, options, env, self) => {
    if (tokens[index].info.trim() === "mermaid") return `<pre class="mermaid">${markdown.utils.escapeHtml(tokens[index].content)}</pre>`;
    return fallbackFence(tokens, index, options, env, self);
  };
  return markdown;
}
