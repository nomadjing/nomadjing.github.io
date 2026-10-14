import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBacklinks } from "./backlinks.js";
import { loadSiteContent, slugify } from "./content.js";
import { createImageAssets } from "./images.js";
import { createMarkdownRenderer } from "./markdown.js";
import { pageNavigation, siteViews, type Breadcrumb, type PageKind } from "./navigation.js";
import type { Note, SiteConfig } from "./types.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distRoot = path.join(projectRoot, "dist");

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>\"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[char]!,
  );
}

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(
    /{{([A-Z_]+)}}/g,
    (_, key: string) => values[key] ?? "",
  );
}

function metadata(note: Note): string {
  const tags = note.tags
    .map((tag) => `<a href="/tags/${slugify(tag)}/">${escapeHtml(tag)}</a>`)
    .join(" / ");
  const rows = [
    note.date && ["created", note.date],
    note.updated && ["updated", note.updated],
    note.status && ["status", note.status],
    note.tags.length && ["tags", tags],
  ].filter(Boolean) as string[][];
  return rows
    .map(
      ([key, value]) =>
        `<div><dt>${key}</dt><dd>${key === "tags" ? value : escapeHtml(value)}</dd></div>`,
    )
    .join("\n");
}

interface TreeNode {
  directories: Map<string, TreeNode>;
  notes: Note[];
}
function makeTree(notes: Note[]): TreeNode {
  const root: TreeNode = { directories: new Map(), notes: [] };
  for (const note of notes) {
    const segments = note.relativePath.replace(/\\/g, "/").split("/");
    let node = root;
    for (const directory of segments.slice(0, -1)) {
      if (!node.directories.has(directory))
        node.directories.set(directory, { directories: new Map(), notes: [] });
      node = node.directories.get(directory)!;
    }
    node.notes.push(note);
  }
  return root;
}
function renderTree(node: TreeNode, depth = 0, prefix: string[] = []): string {
  const directories = [...node.directories]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, child]) =>
        `<li class="tree-directory"><details${depth === 0 ? " open" : ""}><summary><a href="/${[...prefix, name].map(slugify).join("/")}/">${escapeHtml(name)}/</a></summary>${renderTree(child, depth + 1, [...prefix, name])}</details></li>`,
    );
  const notes = node.notes
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(
      (note) =>
        `<li class="tree-note" data-search="${escapeHtml(`${note.title} ${note.relativePath}`.toLocaleLowerCase())}"><a href="${note.url}">${escapeHtml(note.title)}</a></li>`,
    );
  return `<ul class="tree-list">${[...directories, ...notes].join("")}</ul>`;
}
function collectDirectoryPages(
  node: TreeNode,
  prefix: string[] = [],
): Array<{ title: string; url: string; node: TreeNode; parts: string[] }> {
  return [...node.directories].flatMap(([name, child]) => {
    const parts = [...prefix, name];
    const page = {
      title: name,
      url: `/${parts.map(slugify).join("/")}/`,
      node: child,
      parts,
    };
    return [page, ...collectDirectoryPages(child, parts)];
  });
}
function sectionPage(title: string, content: string): string {
  return `<section><h1>${escapeHtml(title)}</h1>${content}</section>`;
}

function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(
      /!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_match, target: string, label?: string) => label ?? target,
    )
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

function headerPath(breadcrumbs: Breadcrumb[]): string {
  const parts = [`<a class="path-home" href="/">${escapeHtml(breadcrumbs[0].label)}</a>`];
  if (breadcrumbs.length === 1) return parts[0];
  const hasMiddle = breadcrumbs.length > 3;
  const hiddenPaths = breadcrumbs.slice(2, -1).map((crumb) =>
    `<a href="${escapeHtml(crumb.url)}">${escapeHtml(crumb.label)}</a>`,
  ).join("");
  breadcrumbs.slice(1).forEach((crumb, index) => {
    const isLast = index === breadcrumbs.length - 2;
    parts.push(`<span class="path-separator">/</span>`);
    if (index === 1 && hasMiddle)
      parts.push(
        `<details class="path-ellipsis"><summary aria-label="Show hidden path segments">…</summary><div class="path-ellipsis-menu">${hiddenPaths}</div></details><span class="path-separator path-ellipsis">/</span>`,
      );
    if (isLast)
      parts.push(
        `<span class="path-current">${escapeHtml(crumb.label)}</span>`,
      );
    else parts.push(`<a class="${index === 0 ? "path-section" : "path-middle"}" href="${escapeHtml(crumb.url)}">${escapeHtml(crumb.label)}</a>`);
  });
  return parts.join("");
}

async function main(): Promise<void> {
  const config = JSON.parse(
    await readFile(path.join(projectRoot, "site.config.json"), "utf8"),
  ) as SiteConfig;
  const { root: contentRoot, notes } = await loadSiteContent(
    projectRoot,
    config,
    process.env.CONTENT_ROOT,
  );
  const aboutNote = notes.find((note) => note.url === "/about/") ?? notes.find(
    (note) => /(^|[\\/])about\.md$/i.test(note.relativePath) || note.title.toLowerCase() === "about",
  );
  const contentNotes = notes.filter((note) => note !== aboutNote);
  const tree = makeTree(contentNotes);
  const directoryPages = collectDirectoryPages(tree);
  const directoryLabels = new Map<string, string>();
  for (const note of notes) {
    const directories = note.relativePath.replace(/\\/g, "/").split("/").slice(0, -1);
    directories.forEach((name, index) => {
      directoryLabels.set(`/${directories.slice(0, index + 1).map(slugify).join("/")}/`, name);
    });
  }
  const images = await createImageAssets(contentRoot);
  const markdown = createMarkdownRenderer(notes, images.resolve);
  const backlinks = buildBacklinks(notes);
  const [layout, noteTemplate, indexTemplate] = await Promise.all([
    readFile(path.join(projectRoot, "templates/layout.html"), "utf8"),
    readFile(path.join(projectRoot, "templates/note.html"), "utf8"),
    readFile(path.join(projectRoot, "templates/index.html"), "utf8"),
  ]);

  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });
  await cp(path.join(projectRoot, "public"), distRoot, { recursive: true });
  await mkdir(path.join(distRoot, "vendor", "fonts"), { recursive: true });
  await cp(
    path.join(projectRoot, "node_modules/katex/dist/katex.min.css"),
    path.join(distRoot, "vendor/katex.min.css"),
  );
  await cp(
    path.join(projectRoot, "node_modules/katex/dist/fonts"),
    path.join(distRoot, "vendor/fonts"),
    { recursive: true },
  );

  const wrapPage = (
    title: string,
    description: string,
    content: string,
    url = "/",
    kind: PageKind = "note",
  ) => {
    const navigation = pageNavigation(config.siteName, url, title, kind, directoryLabels);
    const active = (name: "notes" | "tags" | "about") =>
      navigation.section === name ? `class="active" aria-current="${url === siteViews[name] ? "page" : "location"}"` : "";
    return fill(layout, {
      PAGE_TITLE:
        title === config.siteName
          ? escapeHtml(title)
          : `${escapeHtml(title)} · ${escapeHtml(config.siteName)}`,
      DESCRIPTION: escapeHtml(description),
      PARENT_LINK: navigation.parentUrl
        ? `<a class="path-up" id="parent-link" href="${escapeHtml(navigation.parentUrl)}" rel="up" aria-label="返回上一级" aria-keyshortcuts="Alt+ArrowUp" title="返回上一级 (Alt+↑)">‹</a>`
        : "",
      HEADER_PATH: headerPath(navigation.breadcrumbs),
      FULL_PATH: escapeHtml(navigation.breadcrumbs.map((crumb) => crumb.label).join("/")),
      DIRECTORY_PATH: escapeHtml(navigation.directory),
      NAV_NOTES_ATTR: active("notes"),
      NAV_TAGS_ATTR: active("tags"),
      NAV_ABOUT_ATTR: active("about"),
      CONTENT: content,
    });
  };

  for (const note of notes) {
    note.html = markdown.render(note.markdown, { note });
    const incoming = backlinks.get(note.url) ?? [];
    const backlinksHtml = incoming.length
      ? `<section class="backlinks"><h2>Referenced by</h2><ul>${incoming.map((source) => `<li>→ <a href="${source.url}">${escapeHtml(source.title)}</a></li>`).join("")}</ul></section>`
      : "";
    const body = fill(noteTemplate, {
      METADATA: metadata(note),
      CONTENT: note.html,
      BACKLINKS: backlinksHtml,
    });
    const page = wrapPage(
      note.title,
      note.markdown.replace(/\s+/g, " ").trim().slice(0, 160),
      body,
      note.url,
      note === aboutNote ? "about" : "note",
    );
    const output = path.join(distRoot, note.outputPath);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, page);
  }
  const copiedImages = await images.copyTo(distRoot);

  if (!notes.some((note) => note.url === "/about/")) {
    const output = path.join(distRoot, "about", "index.html");
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(
      output,
      wrapPage(
        "about",
        `About ${config.author}`,
        sectionPage(
          "About",
          aboutNote?.html ?? `<p>${escapeHtml(config.author)}</p>`,
        ),
        "/about/",
        "about",
      ),
    );
  }

  const notesPage = `<section class="archive-page"><h1>Notes</h1><input id="archive-query" class="archive-search" type="search" aria-label="Search notes" placeholder="Search notes…" autocomplete="off"><div class="tree archive-tree">${renderTree(tree)}</div><ul class="archive-results" id="archive-results" hidden></ul><p id="archive-empty" hidden>No matches.</p></section>`;
  await mkdir(path.join(distRoot, "notes"), { recursive: true });
  await writeFile(
    path.join(distRoot, "notes/index.html"),
    wrapPage("Notes", "All published notes", notesPage, "/notes/", "notes"),
  );
  await mkdir(path.join(distRoot, "archive"), { recursive: true });
  await writeFile(path.join(distRoot, "archive/index.html"), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/notes/"><link rel="canonical" href="/notes/"><title>Notes</title></head><body><a href="/notes/">Go to Notes</a></body></html>');
  for (const directory of directoryPages) {
    if (
      ["/archive/", "/notes/", "/tags/", "/about/"].includes(
        directory.url,
      ) ||
      notes.some((note) => note.url === directory.url)
    )
      continue;
    const output = path.join(
      distRoot,
      ...directory.url.split("/").filter(Boolean),
      "index.html",
    );
    await mkdir(path.dirname(output), { recursive: true });
    const content = `<div class="tree archive-tree">${renderTree(directory.node, 0, directory.parts)}</div>`;
    await writeFile(
      output,
      wrapPage(
        directory.title,
        `${directory.title} notes`,
        sectionPage(directory.title, content),
        directory.url,
        "directory",
      ),
    );
  }

  const researchKeywords = (config.researchKeywords ?? "").split("·").map((keyword) => keyword.trim()).filter(Boolean);
  const tags = new Map<string, { label: string; notes: Note[] }>();
  for (const note of contentNotes) {
    for (const tag of note.tags) {
      const slug = slugify(tag);
      if (!slug) continue;
      if (!tags.has(slug)) tags.set(slug, { label: tag, notes: [] });
      const tagged = tags.get(slug)!.notes;
      if (!tagged.includes(note)) tagged.push(note);
    }
  }
  for (const keyword of researchKeywords) {
    const slug = slugify(keyword);
    if (slug && !tags.has(slug)) tags.set(slug, { label: keyword, notes: [] });
  }
  await mkdir(path.join(distRoot, "tags"), { recursive: true });
  const tagLinks = [...tags]
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .map(
      ([slug, tag]) =>
        `<a href="/tags/${slug}/">${escapeHtml(tag.label)} (${tag.notes.length})</a>`,
    )
    .join("");
  await writeFile(
    path.join(distRoot, "tags/index.html"),
    wrapPage(
      "Tags",
      "Published note tags",
      sectionPage("Tags", `${tagLinks ? `<div class="tag-list">${tagLinks}</div>` : "<p>No tagged notes yet.</p>"}`),
      "/tags/",
      "tags",
    ),
  );
  for (const [slug, tag] of tags) {
    const output = path.join(distRoot, "tags", slug, "index.html");
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(
      output,
      wrapPage(
        `#${tag.label}`,
        `Notes tagged ${tag.label}`,
        sectionPage(
          `#${tag.label}`,
          `${tag.notes.length ? `<ul>${tag.notes.map((note) => `<li><a href="${note.url}">${escapeHtml(note.title)}</a></li>`).join("")}</ul>` : "<p>No published notes with this tag yet.</p>"}`,
        ),
        `/tags/${slug}/`,
        "tag",
      ),
    );
  }

  await writeFile(
    path.join(distRoot, "garden-index.json"),
    JSON.stringify({
      author: config.author,
      tagline: config.tagline,
      subtitle: config.subtitle,
      views: siteViews,
      directories: [
        ...Object.values(siteViews).map((url) => ({ path: url === "/" ? "/" : url.replace(/\/$/, ""), url })),
        ...[...tags.keys()].map((slug) => ({ path: `/tags/${slug}`, url: `/tags/${slug}/` })),
        ...directoryPages.map((directory) => ({ path: `/notes${directory.url.replace(/\/$/, "")}`, url: directory.url })),
      ],
      about: aboutNote ? { title: aboutNote.title, text: plainText(aboutNote.markdown) } : undefined,
      notes: contentNotes.map((note) => ({
        title: note.title,
        url: note.url,
        path: `/notes${note.url}`,
        date: note.date,
        updated: note.updated,
        tags: note.tags,
        text: plainText(note.markdown),
      })),
    }),
  );

  const now = notes.find(
    (note) =>
      /(^|[\\/])now\.md$/i.test(note.relativePath) ||
      note.title.toLowerCase() === "now",
  );
  const nowHtml = now
    ? `<section class="now"><h2>NOW</h2>${now.html}</section>`
    : "";
  const recent = [...contentNotes]
    .sort((a, b) =>
      (b.updated ?? b.date ?? "").localeCompare(a.updated ?? a.date ?? ""),
    )
    .slice(0, 3);
  const featured = (config.featuredWriting ?? []).map((reference) => contentNotes.find((note) => note.title === reference || note.url === reference || note.relativePath.replace(/\\/g, "/") === reference)).filter((note): note is Note => Boolean(note));
  const writing = [...featured, ...recent].filter((note, index, all) => all.findIndex((item) => item.url === note.url) === index).slice(0, 3);
  const homeBody = fill(indexTemplate, {
    DISPLAY_NAME: escapeHtml(config.displayName ?? config.author),
    TAGLINE: escapeHtml(config.tagline),
    INTRO: escapeHtml(config.intro ?? config.subtitle),
    RESEARCH_KEYWORDS: researchKeywords.map((keyword, index) => `${index ? '<span aria-hidden="true">·</span>' : ""}<a href="/tags/${slugify(keyword)}/">${escapeHtml(tags.get(slugify(keyword))?.label ?? keyword)}</a>`).join(""),
    HOBBIES: (config.hobbies ?? []).map((hobby) => `<span>${escapeHtml(hobby)}</span>`).join(""),
    PROJECTS: (config.projects ?? []).slice(0, 3).map((project) => {
      let title = escapeHtml(project.title);
      if (project.url) {
        try {
          const url = new URL(project.url);
          if (url.protocol === "https:") title = `<a href="${escapeHtml(url.href)}">${title}</a>`;
        } catch { /* An invalid URL leaves the project title as plain text. */ }
      }
      return `<div class="project-row"><div class="project-head"><h3>${title}</h3>${project.status ? `<span class="project-status">${escapeHtml(project.status)}</span>` : ""}</div><p>${escapeHtml(project.description)}</p></div>`;
    }).join(""),
    NOW: nowHtml,
    WRITING: writing
      .map((note) => {
        const date = note.updated ?? note.date;
        return `<li><a href="${note.url}">${escapeHtml(note.title)}</a>${date ? `<time datetime="${date}">${date}</time>` : ""}</li>`;
      })
      .join(""),
  });
  await writeFile(
    path.join(distRoot, "index.html"),
    wrapPage(config.siteName, config.subtitle, homeBody, "/", "home"),
  );
  console.log(`[build] ${notes.length} published note(s) from ${contentRoot}`);
  console.log(`[build] ${copiedImages} referenced image(s) copied`);
  console.log(`[build] output: ${distRoot}`);
}

await main();
