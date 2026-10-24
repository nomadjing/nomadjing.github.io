const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => entities[char]);
}

/** Replaces `{{KEY}}` placeholders; values are inserted verbatim, so escape them first. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/{{([A-Z_]+)}}/g, (_, key: string) => values[key] ?? "");
}

/** Markdown reduced to readable text, for descriptions and the terminal index. */
export function plainText(markdown: string, limit = 600): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\[![\w-]+\][+-]?/g, " ")
    .replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target: string, label?: string) => label ?? target)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

/** Rough reading time: ~400 CJK characters or ~220 Latin words per minute. */
export function readingMinutes(markdown: string): number {
  const text = plainText(markdown, Infinity);
  const cjk = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  const words = text.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}
