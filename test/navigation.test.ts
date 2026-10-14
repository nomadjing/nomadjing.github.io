import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { pageNavigation, siteViews, type PageKind } from "../src/navigation.js";

class Element {
  handlers = new Map<string, (event: any) => void>();
  children: Element[] = [];
  textContent = "";
  value = "";
  hidden = true;
  scrollHeight = 0;
  scrollTop = 0;
  href = "/research/topic/";
  dataset = { directory: "/" };
  attributes = new Map<string, string>();
  style = { setProperty() {} };
  addEventListener(name: string, handler: (event: any) => void) {
    this.handlers.set(name, handler);
  }
  append(child: Element) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  focus() {}
  setSelectionRange() {}
  getBoundingClientRect() { return { top: 100, height: 300 }; }
}

async function page(pathname = "/research/topic/note/", withTerminal = true, kind: PageKind = pathname === "/" ? "home" : "note", storage = new Map<string, string>()) {
  const nodes = new Map<string, Element>();
  const navigation = pageNavigation("nomad_", pathname, "Note", kind);
  if (navigation.parentUrl) {
    const parent = new Element();
    parent.href = navigation.parentUrl;
    nodes.set("#parent-link", parent);
  }
  if (withTerminal) {
    for (const name of ["terminal", "terminal-form", "terminal-input", "terminal-output", "terminal-cwd", "terminal-toggle", "terminal-close", "terminal-resize"])
      nodes.set(`#${name}`, new Element());
    const main = new Element();
    main.dataset.directory = navigation.directory;
    nodes.set("main", main);
  }
  const keyHandlers: Array<(event: any) => void> = [];
  const location = { pathname, href: pathname };
  const source = (await readFile(new URL("../public/main.js", import.meta.url), "utf8"))
    .replace(/^import .*;\n/, "");
  vm.runInNewContext(source, {
    document: {
      querySelector: (selector: string) => nodes.get(selector) ?? null,
      querySelectorAll: () => [],
      addEventListener: (name: string, handler: (event: any) => void) => {
        if (name === "keydown") keyHandlers.push(handler);
      },
      createElement: () => new Element(),
      body: { classList: { add() {}, remove() {} } },
      activeElement: nodes.get("#terminal-toggle"),
    },
    HTMLElement: Element,
    URL,
    window: { location, innerHeight: 900, scrollY: 0, scrollTo() {} },
    localStorage: { getItem: () => null },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    fetch: async () => ({ ok: true, json: async () => ({
      views: siteViews,
      links: [{ directory: "/tags/ifds", path: "/tags/ifds/research/topic/note/", title: "Note", target: "/notes/research/topic/note/" }],
      directories: [
        { path: "/", url: "/" },
        { path: "/notes", url: "/notes/" },
        { path: "/tags", url: "/tags/" },
        { path: "/tags/ifds", url: "/tags/ifds/" },
        { path: "/tags/algorithms", url: "/tags/algorithms/" },
        { path: "/about", url: "/about/" },
        { path: "/notes/research", url: "/research/" },
        { path: "/notes/research/topic", url: "/research/topic/" },
      ],
      notes: [
        { title: "Note", path: "/notes/research/topic/note/", url: "/research/topic/note/" },
        { title: "Agent", path: "/notes/research/topic/agent/", url: "/research/topic/agent/" },
      ],
    }) }),
    console: { warn: (message: string, error: Error) => { throw error; } },
  });
  await new Promise((resolve) => setImmediate(resolve));
  return {
    location,
    nodes,
    key(overrides: Record<string, unknown> = {}) {
      const event = {
        key: "ArrowUp", altKey: true, defaultPrevented: false,
        target: { closest: () => null },
        preventDefault() { this.defaultPrevented = true; },
        ...overrides,
      };
      keyHandlers.forEach((handler) => handler(event));
      return event;
    },
    command(value: string) {
      nodes.get("#terminal-input")!.value = value;
      nodes.get("#terminal-form")!.handlers.get("submit")!({ preventDefault() {} });
    },
  };
}

test("Alt+Up follows the parent link without requiring the terminal or index", async () => {
  const current = await page(undefined, false);
  assert.equal(current.key().defaultPrevented, true);
  assert.equal(current.location.href, "/research/topic/");
});

test("breadcrumbs put directories under Notes and tag pages under Tags", () => {
  const cases: Array<[PageKind, string, string | undefined, string]> = [
    ["home", "/", undefined, "/"],
    ["notes", "/notes/", "/", "/notes"],
    ["tags", "/tags/", "/", "/tags"],
    ["tag", "/tags/ifds/", "/tags/", "/tags/ifds"],
    ["about", "/about/", "/", "/about"],
    ["directory", "/research/", "/notes/", "/notes/research"],
    ["directory", "/research/topic/", "/research/", "/notes/research/topic"],
    ["note", "/root-note/", "/notes/", "/notes"],
    ["note", "/research/topic/note/", "/research/topic/", "/notes/research/topic"],
  ];
  for (const [kind, url, parentUrl, directory] of cases) {
    const navigation = pageNavigation("nomad_", url, "Title", kind);
    assert.equal(navigation.parentUrl, parentUrl, url);
    assert.equal(navigation.directory, directory, url);
    if (kind === "tags" || kind === "tag") {
      assert.equal(navigation.section, "tags");
      assert.equal(navigation.breadcrumbs[1].label, "Tags");
    } else if (!["home", "about"].includes(kind)) {
      assert.equal(navigation.section, "notes");
      assert.equal(navigation.breadcrumbs[1].label, "Notes");
    }
  }
  const named = pageNavigation("nomad_", "/research/topic/note/", "Title", "note", new Map([["/research/", "研究"]]));
  assert.deepEqual(named.breadcrumbs.map((crumb) => crumb.label), ["nomad_", "Notes", "研究", "topic", "Title"]);
});

test("up and shortcuts share the UI parent for directories, root notes and tag views", async () => {
  for (const [url, kind, parent] of [
    ["/research/", "directory", "/notes/"],
    ["/root-note/", "note", "/notes/"],
    ["/tags/ifds/", "tag", "/tags/"],
    ["/tags/", "tags", "/"],
    ["/notes/", "notes", "/"],
    ["/about/", "about", "/"],
  ] as const) {
    const current = await page(url, true, kind);
    current.command("up");
    assert.equal(current.location.href, parent);
    current.location.href = url;
    current.key();
    assert.equal(current.location.href, parent);
    if (kind !== "note") {
      current.command("cd ..");
      assert.equal(current.location.href, parent);
    }
  }
});

test("terminal root and site commands land on the same pages as UI links", async () => {
  const current = await page();
  for (const [name, url] of Object.entries(siteViews)) {
    const path = url === "/" ? "/" : url.replace(/\/$/, "");
    for (const command of [name, `cd ${path}`, `open ${path}`]) {
      current.command(command);
      assert.equal(current.location.href, url, command);
    }
  }
  current.command("ls /");
  assert.equal(current.nodes.get("#terminal-output")!.children.at(-1)!.textContent, "about/  notes/  tags/");
  current.command("ls /notes");
  assert.equal(current.nodes.get("#terminal-output")!.children.at(-1)!.textContent, "research/");
  current.command("cd /notes/research/topic");
  assert.equal(current.location.href, "/research/topic/");
  current.command("open Note");
  assert.equal(current.location.href, "/research/topic/note/");

});

test("cd keeps the terminal open with history and output after page navigation", async () => {
  const storage = new Map<string, string>();
  const before = await page("/", true, "home", storage);
  before.nodes.get("#terminal-toggle")!.handlers.get("click")!({});
  before.command("cd /tags/ifds");
  assert.equal(before.location.href, "/tags/ifds/");
  const after = await page("/tags/ifds/", true, "tag", storage);
  assert.equal(after.nodes.get("#terminal")!.hidden, false);
  assert.equal(after.nodes.get("#terminal-cwd")!.textContent, "~/tags/ifds");
  assert.ok(after.nodes.get("#terminal-output")!.children.some((line) => line.textContent.includes("moving to /tags/ifds")));
  after.command("history");
  assert.match(after.nodes.get("#terminal-output")!.children.at(-1)!.textContent, /cd \/tags\/ifds/);
  after.command("cd /notes");
  after.key({ key: "Escape", altKey: false });
  const closed = await page("/notes/", true, "notes", storage);
  assert.equal(closed.nodes.get("#terminal")!.hidden, true);
});

test("tag directories list links and open them at the canonical note URL", async () => {
  const current = await page("/tags/ifds/", true, "tag");
  current.command("ls");
  assert.equal(current.nodes.get("#terminal-output")!.children.at(-1)!.textContent, "Note -> /notes/research/topic/note");
  current.command("tree");
  assert.match(current.nodes.get("#terminal-output")!.children.at(-1)!.textContent, /Note -> \/notes\/research\/topic\/note/);
  for (const name of ["Note", "/tags/ifds/research/topic/note", "/notes/research/topic/note"]) {
    current.command(`open ${name}`);
    assert.equal(current.location.href, "/research/topic/note/");
  }
  current.nodes.get("#terminal-input")!.value = "open No";
  current.nodes.get("#terminal-input")!.handlers.get("keydown")!({ key: "Tab", preventDefault() {} });
  assert.equal(current.nodes.get("#terminal-input")!.value, "open Note");
});

test("directory command completion excludes matching note titles", async () => {
  const current = await page("/tags/", true, "tags");
  const input = current.nodes.get("#terminal-input")!;
  for (const command of ["cd", "ls", "tree"]) {
    input.value = `${command} a`;
    input.handlers.get("keydown")!({ key: "Tab", preventDefault() {} });
    assert.equal(input.value, `${command} algorithms`);
  }
  input.value = "cd /tags/a";
  input.handlers.get("keydown")!({ key: "Tab", preventDefault() {} });
  assert.equal(input.value, "cd /tags/algorithms");
  input.value = "open Ag";
  input.handlers.get("keydown")!({ key: "Tab", preventDefault() {} });
  assert.equal(input.value, "open Ag");
  input.value = "cat a";
  input.handlers.get("keydown")!({ key: "Tab", preventDefault() {} });
  assert.equal(input.value, "cat about");
});

test("completion scopes notes and paths to the current or specified directory", async () => {
  const current = await page();
  const input = current.nodes.get("#terminal-input")!;
  for (const [value, expected] of [
    ["open Ag", "open Agent"],
    ["cd ../t", "cd ../topic"],
    ["cd /notes/r", "cd /notes/research"],
    ["open /notes/research/topic/ag", "open /notes/research/topic/agent"],
    ["open /tags/ifds/No", "open /tags/ifds/Note"],
    ["open /tags/algorithms/Ag", "open /tags/algorithms/Ag"],
    ["cd /missing/a", "cd /missing/a"],
  ]) {
    input.value = value;
    input.handlers.get("keydown")!({ key: "Tab", preventDefault() {} });
    assert.equal(input.value, expected, value);
  }
  current.command("open /tags/ifds/Note");
  assert.equal(current.location.href, "/research/topic/note/");
  current.command("cd /tags");
  input.value = "open Ag";
  input.handlers.get("keydown")!({ key: "Tab", preventDefault() {} });
  assert.equal(input.value, "open Ag");
});

test("terminal button toggles both ways and maintains its accessible state", async () => {
  const current = await page();
  const toggle = current.nodes.get("#terminal-toggle")!;
  toggle.handlers.get("click")!({});
  assert.equal(current.nodes.get("#terminal")!.hidden, false);
  assert.equal(toggle.attributes.get("aria-expanded"), "true");
  assert.equal(toggle.attributes.get("aria-label"), "Close terminal");
  toggle.handlers.get("click")!({});
  assert.equal(current.nodes.get("#terminal")!.hidden, true);
  assert.equal(toggle.attributes.get("aria-label"), "Open terminal");
});

test("Escape restores focus quietly while Tab and blur restore normal focus styling", async () => {
  const current = await page();
  const toggle = current.nodes.get("#terminal-toggle")!;
  toggle.handlers.get("click")!({});
  current.key({ key: "Escape", altKey: false });
  assert.equal(current.nodes.get("#terminal")!.hidden, true);
  assert.equal(toggle.attributes.has("data-restored-focus"), true);
  current.key({ key: "Tab", altKey: false });
  assert.equal(toggle.attributes.has("data-restored-focus"), false);
  toggle.handlers.get("click")!({});
  current.key({ key: "Escape", altKey: false });
  toggle.handlers.get("blur")!({});
  assert.equal(toggle.attributes.has("data-restored-focus"), false);
});

test("parent shortcut preserves editing, composition, and other key combinations", async () => {
  const current = await page();
  for (const overrides of [
    { target: { closest: () => ({ tagName: "INPUT" }) } },
    { target: { isContentEditable: true } },
    { isComposing: true }, { repeat: true },
    { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: false },
  ]) {
    assert.equal(current.key(overrides).defaultPrevented, false);
    assert.equal(current.location.href, "/research/topic/note/");
  }
});

test("up returns to the note's directory while cd .. keeps shell directory semantics", async () => {
  const current = await page();
  current.command("up");
  assert.equal(current.location.href, "/research/topic/");
  current.command("cd ..");
  assert.equal(current.location.href, "/research/");
});

test("home has no parent navigation and the terminal explains it", async () => {
  const current = await page("/");
  assert.equal(current.key().defaultPrevented, false);
  current.command("up");
  assert.equal(current.location.href, "/");
  assert.equal(current.nodes.get("#terminal-output")!.children.at(-1)!.textContent, "Already at the site root.");
});
