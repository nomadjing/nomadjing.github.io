import { baseName, cleanPath, depthFrom, isWithin, parentPath, resolvePath } from "./paths.js?v=12883d6848";

/**
 * The site as a file system, built from `/garden-index.json`. Notes live at
 * `/notes/<dir>/<note>`; tag directories hold links (`title -> /notes/...`)
 * instead of copies.
 * @param {import("../types.js?v=12883d6848").GardenIndex} index
 */
export function createGarden(index) {
  const notes = index.notes ?? [];
  const links = index.links ?? [];
  const directoryUrls = new Map((index.directories ?? []).map((directory) => [directory.path, directory.url]));
  const directories = [...directoryUrls.keys()];
  const notePath = (/** @type {import("../types.js?v=12883d6848").GardenNote} */ note) => cleanPath(note.path);

  /** @param {string} target */
  const canonicalDirectory = (target) =>
    directories.find((directory) => directory.toLowerCase() === target.toLowerCase());
  /** @param {string | undefined} directory */
  const childDirectories = (directory) =>
    directories.filter((item) => item !== directory && parentPath(item) === directory);
  /** @param {string | undefined} directory */
  const notesIn = (directory) => notes.filter((note) => parentPath(notePath(note)) === directory);
  /** @param {string | undefined} directory */
  const linksIn = (directory) => links.filter((link) => link.directory === directory);

  /**
   * Finds a note by path, tag link, exact title, or unique title prefix in `cwd`.
   * @param {string} cwd
   * @param {string} query
   */
  const findNote = (cwd, query) => {
    const resolved = resolvePath(cwd, query);
    const lowered = query.toLowerCase();
    const exactLink = links.find((link) => cleanPath(link.path).toLowerCase() === resolved.toLowerCase());
    const localLinks = linksIn(parentPath(resolved));
    const linkName = baseName(resolved).toLowerCase();
    const matches = localLinks.filter((link) => link.title.toLowerCase() === linkName);
    const candidates = matches.length ? matches : localLinks.filter((link) => link.title.toLowerCase().startsWith(linkName));
    if (!exactLink && candidates.length > 1) return null;
    const link = exactLink ?? candidates[0];
    if (link) return notes.find((note) => notePath(note) === cleanPath(link.target));
    return notes.find((note) => notePath(note).toLowerCase() === resolved.toLowerCase())
      ?? notes.find((note) => note.title.toLowerCase() === lowered)
      ?? notes.find((note) => parentPath(notePath(note)) === cwd && note.title.toLowerCase().startsWith(lowered));
  };

  /** @param {string} cwd @param {string} target */
  const list = (cwd, target) => {
    const directory = canonicalDirectory(resolvePath(cwd, target));
    if (!directory) return null;
    return [
      ...childDirectories(directory).map(baseName).sort().map((name) => `${name}/`),
      ...notesIn(directory).map((note) => note.title).sort(),
      ...linksIn(directory).map((link) => `${link.title} -> ${cleanPath(link.target)}`).sort(),
    ];
  };

  /** @param {string} cwd @param {string} target */
  const tree = (cwd, target) => {
    const root = canonicalDirectory(resolvePath(cwd, target));
    if (!root) return null;
    const rows = [root === "/" ? "." : baseName(root)];
    for (const directory of directories.filter((item) => item !== root && isWithin(item, root)).sort())
      rows.push(`${"  ".repeat(depthFrom(directory, root))}├── ${baseName(directory)}/`);
    for (const note of notes.filter((item) => isWithin(notePath(item), root)).sort((a, b) => notePath(a).localeCompare(notePath(b))))
      rows.push(`${"  ".repeat(depthFrom(notePath(note), root))}└── ${note.title}`);
    for (const link of links.filter((item) => item.directory === root || isWithin(item.directory, root)))
      rows.push(`${"  ".repeat(depthFrom(link.directory, root) + 1)}└── ${link.title} -> ${cleanPath(link.target)}`);
    return rows.join("\n");
  };

  /**
   * Tab-completion candidates for the last word of `value`.
   * @param {string} cwd
   * @param {string} value
   * @param {string[]} commandNames
   */
  const completions = (cwd, value, commandNames) => {
    const parts = value.split(/\s+/);
    const argument = parts.at(-1) ?? "";
    const prefix = argument.slice(0, argument.lastIndexOf("/") + 1);
    const context = canonicalDirectory(resolvePath(cwd, prefix || "."));
    const command = parts[0].toLowerCase();
    const directoryCandidates = childDirectories(context).map((directory) => prefix + baseName(directory));
    const candidates = parts.length === 1 ? commandNames
      : ["cd", "ls", "tree"].includes(command) ? directoryCandidates
        : command === "open" ? directoryCandidates.concat(
          notesIn(context).map((note) => prefix ? prefix + baseName(notePath(note)) : note.title),
          linksIn(context).map((link) => prefix + link.title),
        )
          : command === "cat" ? ["about", "now"] : [];
    const fragment = argument.toLowerCase();
    return { parts, matches: [...new Set(candidates)].filter((candidate) => candidate.toLowerCase().startsWith(fragment)) };
  };

  return { index, notes, directoryUrls, canonicalDirectory, findNote, list, tree, completions };
}
