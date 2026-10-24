import { commandNames } from "./commands.js?v=665390e630";
import { resolvePath } from "./paths.js?v=665390e630";

/** @param {string} text */
const escape = (text) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
/** @param {string} className @param {string} text */
const span = (className, text) => `<span class="${className}">${escape(text)}</span>`;

/**
 * Markup for an output line, or null for plain text. The markup's text is
 * always exactly `text`, so `textContent` (and the saved session) is unchanged.
 * @param {string} text
 * @param {string} type
 */
export function lineHtml(text, type) {
  if (type === "command") {
    const end = text.indexOf("$ ");
    return end < 0 ? null : span("line-prompt", text.slice(0, end + 1)) + escape(text.slice(end + 1));
  }
  if (type !== "listing") return null;
  // `ls` and `tree` output, coloured like `ls --color`: directories, notes, links.
  return text.split("\n").map((row) => {
    const [, branch = "", rest = ""] = row.match(/^(\s*(?:[├└]── )?)(.*)$/) ?? [];
    return span("ls-branch", branch) + rest.split(/( {2,})/).map((entry) => {
      if (!entry.trim()) return entry;
      if (entry.endsWith("/")) return span("ls-dir", entry);
      const arrow = entry.indexOf(" -> ");
      if (arrow > 0) return span("ls-link", entry.slice(0, arrow)) + span("ls-arrow", " -> ") + span("ls-target", entry.slice(arrow + 4));
      return span("ls-note", entry);
    }).join("");
  }).join("\n");
}

const pathCommands = new Set(["cd", "ls", "tree", "open"]);

/**
 * fish-style highlighting of the command line: the command name is coloured by
 * whether it exists, and arguments that resolve to a directory or note are underlined.
 * @param {string} value
 * @param {string} cwd
 * @param {import("../types.js?v=665390e630").Garden | null} garden
 * @param {string} [ghost] an autosuggestion, drawn faintly after the cursor
 */
export function inputHtml(value, cwd, garden, ghost = "") {
  const name = value.trimStart().split(/\s+/, 1)[0].toLowerCase();
  let seenName = false;
  return value.split(/(\s+)/).map((token) => {
    if (!token || /^\s+$/.test(token)) return token;
    if (!seenName) {
      seenName = true;
      const state = commandNames.includes(name) ? "cmd-ok" : commandNames.some((command) => command.startsWith(name)) ? "cmd-partial" : "cmd-bad";
      return span(state, token);
    }
    const valid = garden && pathCommands.has(name)
      && (garden.canonicalDirectory(resolvePath(cwd, token)) || (name === "open" && garden.findNote(cwd, token)));
    return valid ? span("arg-valid", token) : escape(token);
  }).join("") + (ghost ? span("ghost", ghost) : "");
}

/**
 * fish-style autosuggestion: the newest history entry extending `value`,
 * else the single completion for its last word. Returns only the missing tail.
 * @param {string} value
 * @param {string[]} history
 * @param {string} cwd
 * @param {import("../types.js?v=665390e630").Garden | null} garden
 */
export function suggestion(value, history, cwd, garden) {
  if (!value.trim()) return "";
  const previous = [...history].reverse().find((entry) => entry.length > value.length && entry.startsWith(value));
  if (previous) return previous.slice(value.length);
  if (!garden || /\s$/.test(value)) return "";
  const { parts, matches } = garden.completions(cwd, value, commandNames);
  const word = parts.at(-1) ?? "";
  if (matches.length !== 1 || matches[0].length <= word.length || !matches[0].toLowerCase().startsWith(word.toLowerCase())) return "";
  return matches[0].slice(word.length);
}
