import { slugify } from "./content.js";
import type { Note, SiteConfig } from "./types.js";

export interface TreeNode {
  directories: Map<string, TreeNode>;
  notes: Note[];
}
export interface DirectoryPage { title: string; url: string; node: TreeNode; parts: string[]; }
export interface Tag { slug: string; label: string; notes: Note[]; }

/** Everything the pages derive from the published notes, computed once. */
export interface SiteModel {
  config: SiteConfig;
  notes: Note[];
  /** Notes shown in the tree, tags and terminal: everything except the about page. */
  contentNotes: Note[];
  about?: Note;
  now?: Note;
  tree: TreeNode;
  directoryPages: DirectoryPage[];
  directoryLabels: Map<string, string>;
  tags: Tag[];
  researchKeywords: string[];
}

const posix = (relativePath: string) => relativePath.replace(/\\/g, "/");
const directoriesOf = (note: Note) => posix(note.relativePath).split("/").slice(0, -1);
export const directoryUrl = (parts: string[]) => `/${parts.map(slugify).join("/")}/`;
export const latestDate = (note: Note) => note.updated ?? note.date;

function makeTree(notes: Note[]): TreeNode {
  const root: TreeNode = { directories: new Map(), notes: [] };
  for (const note of notes) {
    let node = root;
    for (const directory of directoriesOf(note)) {
      if (!node.directories.has(directory)) node.directories.set(directory, { directories: new Map(), notes: [] });
      node = node.directories.get(directory)!;
    }
    node.notes.push(note);
  }
  return root;
}

function collectDirectoryPages(node: TreeNode, prefix: string[] = []): DirectoryPage[] {
  return [...node.directories].flatMap(([name, child]) => {
    const parts = [...prefix, name];
    return [{ title: name, url: directoryUrl(parts), node: child, parts }, ...collectDirectoryPages(child, parts)];
  });
}

export function countNotes(node: TreeNode): number {
  return node.notes.length + [...node.directories.values()].reduce((sum, child) => sum + countNotes(child), 0);
}

export function createSiteModel(config: SiteConfig, notes: Note[]): SiteModel {
  const about = notes.find((note) => note.url === "/about/")
    ?? notes.find((note) => /(^|[\\/])about\.md$/i.test(note.relativePath) || note.title.toLowerCase() === "about");
  const now = notes.find((note) => /(^|[\\/])now\.md$/i.test(note.relativePath) || note.title.toLowerCase() === "now");
  const contentNotes = notes.filter((note) => note !== about);
  const tree = makeTree(contentNotes);

  const directoryLabels = new Map<string, string>();
  for (const note of notes) {
    const directories = directoriesOf(note);
    directories.forEach((name, index) => directoryLabels.set(directoryUrl(directories.slice(0, index + 1)), name));
  }

  const researchKeywords = (config.researchKeywords ?? "").split("·").map((keyword) => keyword.trim()).filter(Boolean);
  const tags = new Map<string, Tag>();
  for (const note of contentNotes) {
    for (const label of note.tags) {
      const slug = slugify(label);
      if (!slug) continue;
      if (!tags.has(slug)) tags.set(slug, { slug, label, notes: [] });
      const tagged = tags.get(slug)!.notes;
      if (!tagged.includes(note)) tagged.push(note);
    }
  }
  for (const keyword of researchKeywords) {
    const slug = slugify(keyword);
    if (slug && !tags.has(slug)) tags.set(slug, { slug, label: keyword, notes: [] });
  }

  return {
    config, notes, contentNotes, about, now, tree,
    directoryPages: collectDirectoryPages(tree),
    directoryLabels,
    tags: [...tags.values()].sort((a, b) => a.label.localeCompare(b.label)),
    researchKeywords,
  };
}
