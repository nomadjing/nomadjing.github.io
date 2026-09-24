import { renderNoteHeatmap } from "./heatmap.js";

const themeToggle = document.querySelector("#theme-toggle");
if (themeToggle) {
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let manuallySelected = false;
  try {
    manuallySelected = ["light", "dark"].includes(
      localStorage.getItem("site-theme"),
    );
  } catch {
    /* Storage may be unavailable. */
  }
  const updateThemeToggle = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    themeToggle.textContent = dark ? "☼" : "☾";
    themeToggle.setAttribute(
      "aria-label",
      dark ? "Switch to light mode" : "Switch to dark mode",
    );
    themeToggle.title = dark ? "Light mode" : "Dark mode";
  };
  themeToggle.addEventListener("click", () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    manuallySelected = true;
    try {
      localStorage.setItem("site-theme", next);
    } catch {
      /* Keep the current-page choice. */
    }
    updateThemeToggle();
  });
  systemTheme.addEventListener("change", () => {
    if (manuallySelected) return;
    document.documentElement.dataset.theme = systemTheme.matches
      ? "dark"
      : "light";
    updateThemeToggle();
  });
  updateThemeToggle();
}

const diagrams = document.querySelectorAll(".mermaid");
if (diagrams.length) {
  import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs")
    .then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      mermaid.run({ nodes: diagrams });
    })
    .catch((error) => console.warn("Mermaid could not be loaded", error));
}

const readingArticle = document.querySelector("main > article");
if (readingArticle) {
  const progress = document.createElement("div");
  progress.className = "reading-progress";
  progress.innerHTML =
    '<span class="reading-progress-track" role="slider" tabindex="0" aria-label="Article reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="reading-progress-fill"></span><span class="reading-progress-mark"></span></span><span class="reading-progress-label" aria-hidden="true">0%</span>';
  document.body.append(progress);

  const track = progress.querySelector(".reading-progress-track");
  const label = progress.querySelector(".reading-progress-label");
  const headings = [...readingArticle.querySelectorAll(".prose h2, .prose h3")];
  let outlineLinks = [];
  let outlineNav = null;
  let activeHeading = -1;
  const revealActiveHeading = () => {
    const link = outlineLinks[activeHeading];
    if (!link || !outlineNav?.getClientRects().length) return;
    const navBounds = outlineNav.getBoundingClientRect();
    const linkBounds = link.getBoundingClientRect();
    if (linkBounds.top < navBounds.top)
      outlineNav.scrollTop += linkBounds.top - navBounds.top;
    else if (linkBounds.bottom > navBounds.bottom)
      outlineNav.scrollTop += linkBounds.bottom - navBounds.bottom;
  };
  if (headings.length >= 3) {
    document.body.classList.add("has-reading-outline");
    const outline = document.createElement("aside");
    outline.className = "reading-outline";
    const toggle = document.createElement("button");
    toggle.className = "reading-outline-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-controls", "reading-outline-list");
    const nav = document.createElement("nav");
    nav.id = "reading-outline-list";
    nav.setAttribute("aria-label", "文章目录");
    outlineNav = nav;
    const list = document.createElement("ol");
    const wideOutline = window.matchMedia("(min-width: 1100px)");
    const setOutlineOpen = (open) => {
      outline.classList.toggle("collapsed", wideOutline.matches && !open);
      outline.classList.toggle("open", !wideOutline.matches && open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "收起大纲" : "展开大纲");
      toggle.textContent = open ? "›" : "‹";
      if (open) requestAnimationFrame(revealActiveHeading);
    };
    outlineLinks = headings.map((heading, index) => {
      if (!heading.id) heading.id = `article-section-${index + 1}`;
      const item = document.createElement("li");
      if (heading.tagName === "H3")
        item.className = "reading-outline-subsection";
      const link = document.createElement("a");
      link.href = `#${encodeURIComponent(heading.id)}`;
      link.textContent = heading.textContent.trim();
      link.title = link.textContent;
      link.addEventListener("click", () => {
        if (!wideOutline.matches) setOutlineOpen(false);
      });
      item.append(link);
      list.append(item);
      return link;
    });
    nav.append(list);
    outline.append(toggle, nav);
    document.body.append(outline);
    setOutlineOpen(wideOutline.matches);
    toggle.addEventListener("click", () => {
      setOutlineOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    wideOutline.addEventListener("change", () =>
      setOutlineOpen(wideOutline.matches),
    );
    document.addEventListener("click", (event) => {
      if (outline.classList.contains("open") && !outline.contains(event.target))
        setOutlineOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && outline.classList.contains("open")) {
        setOutlineOpen(false);
        toggle.focus();
      }
    });
    if (window.location.hash) {
      try {
        const target = document.getElementById(
          decodeURIComponent(window.location.hash.slice(1)),
        );
        if (headings.includes(target))
          requestAnimationFrame(() => target.scrollIntoView());
      } catch {
        /* Ignore malformed fragments. */
      }
    }
  }

  const readingRange = () => {
    const bounds = readingArticle.getBoundingClientRect();
    return {
      start: bounds.top + window.scrollY,
      end: bounds.bottom + window.scrollY - window.innerHeight,
    };
  };
  const jumpToFraction = (fraction) => {
    const { start, end } = readingRange();
    if (end <= start) return;
    window.scrollTo(
      0,
      start + Math.min(1, Math.max(0, fraction)) * (end - start),
    );
  };
  track.addEventListener("click", (event) => {
    const bounds = track.getBoundingClientRect();
    const fraction = window.matchMedia("(max-width: 900px)").matches
      ? (event.clientX - bounds.left) / bounds.width
      : (event.clientY - bounds.top) / bounds.height;
    jumpToFraction(fraction);
  });
  track.addEventListener("keydown", (event) => {
    const steps = {
      ArrowDown: 0.05,
      ArrowRight: 0.05,
      ArrowUp: -0.05,
      ArrowLeft: -0.05,
      PageDown: 0.2,
      PageUp: -0.2,
    };
    if (event.key === "Home" || event.key === "End" || event.key in steps) {
      event.preventDefault();
      const { start, end } = readingRange();
      const current =
        end > start
          ? Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)))
          : 0;
      jumpToFraction(
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? 1
            : current + steps[event.key],
      );
    }
  });

  let updatePending = false;
  const updateProgress = () => {
    updatePending = false;
    const { start, end } = readingRange();
    progress.hidden = end <= start;
    if (!progress.hidden) {
      const fraction = Math.min(
        1,
        Math.max(0, (window.scrollY - start) / (end - start)),
      );
      const percent = Math.round(fraction * 100);
      progress.style.setProperty("--reading-progress", String(fraction));
      track.setAttribute("aria-valuenow", String(percent));
      track.setAttribute(
        "aria-orientation",
        window.matchMedia("(max-width: 900px)").matches
          ? "horizontal"
          : "vertical",
      );
      label.textContent = `${percent}%`;
    }
    if (outlineLinks.length) {
      const active = headings.findLastIndex(
        (heading) =>
          heading.getBoundingClientRect().top <= window.innerHeight * 0.35,
      );
      const changed = active !== activeHeading;
      activeHeading = active;
      outlineLinks.forEach((link, index) => {
        link.classList.toggle("active", index === active);
        if (index === active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      if (changed) revealActiveHeading();
    }
  };
  const scheduleProgressUpdate = () => {
    if (updatePending) return;
    updatePending = true;
    requestAnimationFrame(updateProgress);
  };
  window.addEventListener("scroll", scheduleProgressUpdate, { passive: true });
  window.addEventListener("resize", scheduleProgressUpdate);
  if ("ResizeObserver" in window)
    new ResizeObserver(scheduleProgressUpdate).observe(readingArticle);
  scheduleProgressUpdate();
}

const archiveQuery = document.querySelector("#archive-query");
if (archiveQuery) {
  const noteItems = [...document.querySelectorAll(".archive-tree .tree-note")];
  const tree = document.querySelector(".archive-tree");
  const results = document.querySelector("#archive-results");
  const empty = document.querySelector("#archive-empty");
  archiveQuery.addEventListener("input", () => {
    const query = archiveQuery.value.trim().toLocaleLowerCase();
    tree.hidden = Boolean(query);
    if (!query) {
      results.hidden = true;
      empty.hidden = true;
      results.replaceChildren();
      return;
    }
    const matches = noteItems.filter((note) =>
      note.dataset.search.includes(query),
    );
    results.replaceChildren(
      ...matches.map((note) => {
        const item = document.createElement("li");
        item.append(note.querySelector("a").cloneNode(true));
        return item;
      }),
    );
    results.hidden = matches.length === 0;
    empty.hidden = matches.length !== 0;
  });
}

const terminal = document.querySelector("#terminal");
const terminalForm = document.querySelector("#terminal-form");
const terminalInput = document.querySelector("#terminal-input");
const terminalOutput = document.querySelector("#terminal-output");
const terminalCwd = document.querySelector("#terminal-cwd");
const terminalToggle = document.querySelector("#terminal-toggle");
const terminalClose = document.querySelector("#terminal-close");
const terminalResize = document.querySelector("#terminal-resize");
const pageMain = document.querySelector("main");

if (
  terminal &&
  terminalForm &&
  terminalInput &&
  terminalOutput &&
  terminalCwd &&
  terminalToggle &&
  terminalClose &&
  terminalResize &&
  pageMain
) {
  startTerminal().catch((error) =>
    console.warn("Terminal could not start", error),
  );
}

async function startTerminal() {
  let returnFocus = terminalToggle;
  let mainTop = 0;
  const commandHistory = [];
  let historyIndex = 0;
  let cwd = "/";
  let initialCwd = "/";
  try {
    sessionStorage.removeItem("nomad-terminal");
  } catch {
    /* old session data may be unavailable */
  }
  const heightKey = "nomad-terminal-height";
  const setHeight = (height) => {
    const max = Math.floor(window.innerHeight * 0.75);
    const value = Math.round(
      Math.max(Math.min(180, max), Math.min(height, max)),
    );
    terminal.style.setProperty("--terminal-height", `${value}px`);
    return value;
  };
  const saveHeight = () => {
    try {
      localStorage.setItem(
        heightKey,
        String(Math.round(terminal.getBoundingClientRect().height)),
      );
    } catch {
      /* optional preference */
    }
  };
  try {
    const savedHeight = Number(localStorage.getItem(heightKey));
    if (savedHeight > 0) setHeight(savedHeight);
  } catch {
    /* optional preference */
  }
  terminalResize.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = terminal.getBoundingClientRect().height;
    terminalResize.setPointerCapture(event.pointerId);
    const move = (moveEvent) =>
      setHeight(startHeight + startY - moveEvent.clientY);
    const end = () => {
      terminalResize.removeEventListener("pointermove", move);
      terminalResize.removeEventListener("pointerup", end);
      terminalResize.removeEventListener("pointercancel", end);
      saveHeight();
    };
    terminalResize.addEventListener("pointermove", move);
    terminalResize.addEventListener("pointerup", end);
    terminalResize.addEventListener("pointercancel", end);
  });
  terminalResize.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    setHeight(
      terminal.getBoundingClientRect().height +
        (event.key === "ArrowUp" ? 20 : -20),
    );
    saveHeight();
  });
  const focusCommandInput = () => {
    terminalInput.focus({ preventScroll: true });
    const end = terminalInput.value.length;
    terminalInput.setSelectionRange(end, end);
  };
  const openTerminal = () => {
    if (!terminal.hidden) {
      focusCommandInput();
      return;
    }
    returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : terminalToggle;
    const pageScroll = window.scrollY;
    mainTop = pageMain.getBoundingClientRect().top + pageScroll;
    terminal.hidden = false;
    terminalToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("terminal-open");
    window.scrollTo(0, 0);
    pageMain.scrollTop = Math.max(0, pageScroll - mainTop);
    focusCommandInput();
  };
  const closeTerminal = () => {
    if (terminal.hidden) return;
    const restoreScroll = mainTop + pageMain.scrollTop;
    terminalOutput.replaceChildren();
    terminalInput.value = "";
    commandHistory.length = 0;
    historyIndex = 0;
    cwd = initialCwd;
    terminalCwd.textContent = cwd === "/" ? "~" : `~${cwd}`;
    terminal.hidden = true;
    terminalToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("terminal-open");
    returnFocus.focus({ preventScroll: true });
    window.scrollTo(0, restoreScroll);
  };
  terminalToggle.addEventListener("click", openTerminal);
  terminalClose.addEventListener("click", closeTerminal);
  terminal.addEventListener("click", (event) => {
    if (event.target === terminalInput || event.target.closest("button"))
      return;
    if (window.getSelection()?.isCollapsed === false) return;
    focusCommandInput();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !terminal.hidden) {
      event.preventDefault();
      closeTerminal();
      return;
    }
    if (
      event.key === "`" &&
      !event.repeat &&
      !/INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? "")
    ) {
      event.preventDefault();
      openTerminal();
    }
  });

  const garden = await fetch("/garden-index.json").then((response) => {
    if (!response.ok) throw new Error(`garden index: ${response.status}`);
    return response.json();
  });
  const notes = garden.notes ?? [];
  const directories = new Set(["/", "/notes", "/about", "/tags"]);
  for (const note of notes) {
    const segments = cleanPath(note.path).split("/").filter(Boolean);
    for (let index = 1; index < segments.length; index += 1)
      directories.add(`/${segments.slice(0, index).join("/")}`);
  }

  const commands = [
    "help",
    "pwd",
    "ls",
    "cd",
    "tree",
    "open",
    "cat",
    "random",
    "whoami",
    "home",
    "history",
    "clear",
    "coffee",
    "heatmap",
    "exit",
  ];
  const coffeeJokes = [
    "程序员为什么喜欢深色模式？因为亮光会引来 bug。",
    "程序员去买面包。家人说：买两个，如果有鸡蛋就买十个。于是他带回十个面包。",
    "要理解递归，先要理解递归。",
    "今天的代码很稳定：它每次都以同一种方式崩溃。",
    "Debug 就像侦探破案，只不过凶手通常是昨天的自己。",
    "我写了一个 O(1) 的排序算法：不排序。",
    "我的代码通过了所有测试。测试数量：0。",
    "Segmentation fault (coffee dumped).",
    "Error: caffeine not found.",
    "sudo make me a coffee\nPermission denied.",
    "make coffee\nmake: *** No rule to make target 'coffee'. Stop.",
  ];
  const coffeeArt =
    "    ( (\n     ) )\n  ........\n  |      |]\n  \\      /\n   `----'";
  let coffeeOrder = [];
  const nextCoffeeJoke = () => {
    if (!coffeeOrder.length) {
      coffeeOrder = [...coffeeJokes.keys()];
      for (let index = coffeeOrder.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [coffeeOrder[index], coffeeOrder[swap]] = [coffeeOrder[swap], coffeeOrder[index]];
      }
    }
    return coffeeJokes[coffeeOrder.pop()];
  };
  const appendLine = (text, type = "") => {
    const line = document.createElement("div");
    line.className = `terminal-line ${type}`.trim();
    line.textContent = text;
    terminalOutput.append(line);
  };

  const print = (text = "", type = "") => {
    appendLine(text, type);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  };
  const showCwd = () => {
    terminalCwd.textContent = cwd === "/" ? "~" : `~${cwd}`;
  };
  const resolve = (input = "") => {
    if (!input || input === "~") return input === "~" ? "/" : cwd;
    const source = input.startsWith("/") ? input : `${cwd}/${input}`;
    const stack = [];
    for (const part of source.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") stack.pop();
      else stack.push(part);
    }
    return `/${stack.join("/")}` || "/";
  };
  const canonicalDirectory = (target) =>
    [...directories].find(
      (directory) => directory.toLowerCase() === target.toLowerCase(),
    );
  const notePath = (note) => cleanPath(note.path);
  const findNote = (query) => {
    const resolved = resolve(query);
    const lowered = query.toLowerCase();
    return (
      notes.find(
        (note) => notePath(note).toLowerCase() === resolved.toLowerCase(),
      ) ??
      notes.find((note) => note.title.toLowerCase() === lowered) ??
      notes.find(
        (note) =>
          parentPath(notePath(note)) === cwd &&
          note.title.toLowerCase().startsWith(lowered),
      )
    );
  };
  const list = (target) => {
    const directory = canonicalDirectory(resolve(target));
    if (!directory) return null;
    const childDirectories = [...directories]
      .filter((item) => item !== directory && parentPath(item) === directory)
      .map(baseName)
      .sort();
    const childNotes = notes
      .filter((note) => parentPath(notePath(note)) === directory)
      .map((note) => note.title)
      .sort();
    return [...childDirectories.map((name) => `${name}/`), ...childNotes];
  };
  const pagePath = cleanPath(window.location.pathname);
  const pageNote = notes.find(
    (note) => notePath(note).toLowerCase() === pagePath.toLowerCase(),
  );
  initialCwd = pageNote
    ? parentPath(notePath(pageNote))
    : (canonicalDirectory(pagePath) ?? "/");
  cwd = initialCwd;
  const run = (rawCommand) => {
    const raw = rawCommand.trim();
    if (!raw) return;
    print(`nomad@home:${cwd === "/" ? "~" : `~${cwd}`}$ ${raw}`, "command");
    commandHistory.push(raw);
    historyIndex = commandHistory.length;
    const [name = "", ...args] =
      raw
        .match(/"[^"]*"|'[^']*'|\S+/g)
        ?.map((part) => part.replace(/^(['"])(.*)\1$/, "$2")) ?? [];
    const argument = args.join(" ");

    switch (name.toLowerCase()) {
      case "help":
        print(
          "help  pwd  ls [path]  cd <path>  tree [path]  open <note>\ncat <about|now>  random  whoami  home  history  clear  coffee  heatmap  exit",
        );
        break;
      case "pwd":
        print(cwd);
        break;
      case "ls": {
        const entries = list(argument);
        if (!entries) print(`ls: ${argument}: no such directory`, "error");
        else print(entries.length ? entries.join("  ") : "(empty)");
        break;
      }
      case "cd": {
        const directory = canonicalDirectory(resolve(argument || "/"));
        if (!directory) print(`cd: ${argument}: no such directory`, "error");
        else {
          cwd = directory;
          showCwd();
          print(`moving to ${directory}`);
          window.location.href = directory === "/" ? "/" : `${directory}/`;
        }
        break;
      }
      case "tree": {
        const root = canonicalDirectory(resolve(argument));
        if (!root) {
          print(`tree: ${argument}: no such directory`, "error");
          break;
        }
        const rows = [root === "/" ? "." : baseName(root)];
        for (const directory of [...directories]
          .filter((item) => item !== root && isWithin(item, root))
          .sort())
          rows.push(
            `${"  ".repeat(depthFrom(directory, root))}├── ${baseName(directory)}/`,
          );
        for (const note of notes
          .filter((item) => isWithin(notePath(item), root))
          .sort((a, b) => notePath(a).localeCompare(notePath(b))))
          rows.push(
            `${"  ".repeat(depthFrom(notePath(note), root))}└── ${note.title}`,
          );
        print(rows.join("\n"));
        break;
      }
      case "open": {
        const note = findNote(argument);
        const directory = canonicalDirectory(resolve(argument));
        if (note) window.location.href = note.url;
        else if (directory)
          window.location.href = directory === "/" ? "/" : `${directory}/`;
        else print(`open: ${argument}: not found`, "error");
        break;
      }
      case "cat": {
        const note = argument.toLowerCase() === "about" ? garden.about : findNote(argument);
        if (!note || !["about", "now"].includes(argument.toLowerCase()))
          print("cat: available public documents are about and now", "error");
        else
          print(
            `${note.title}\n${"-".repeat(Math.min(note.title.length, 24))}\n${note.text || "(empty)"}`,
          );
        break;
      }
      case "random": {
        if (!notes.length) print("random: no published notes yet", "error");
        else
          window.location.href =
            notes[Math.floor(Math.random() * notes.length)].url;
        break;
      }
      case "whoami":
        print(`${garden.author}\n${garden.tagline}\n${garden.subtitle}`);
        break;
      case "home":
        window.location.href = "/";
        break;
      case "history":
        print(
          commandHistory
            .map(
              (command, index) =>
                `${String(index + 1).padStart(2, " ")}  ${command}`,
            )
            .join("\n"),
        );
        break;
      case "clear":
        terminalOutput.replaceChildren();
        break;
      case "coffee":
        print(
          `${coffeeArt}\n\n${nextCoffeeJoke()}`,
          "hint",
        );
        break;
      case "heatmap":
        print(renderNoteHeatmap(notes), "hint");
        break;
      case "exit":
        closeTerminal();
        break;
      default:
        print(`${name}: command not found. Try help.`, "error");
    }
  };

  terminalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    run(terminalInput.value);
    terminalInput.value = "";
  });
  terminalInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      historyIndex = Math.max(
        0,
        Math.min(
          commandHistory.length,
          historyIndex + (event.key === "ArrowUp" ? -1 : 1),
        ),
      );
      terminalInput.value = commandHistory[historyIndex] ?? "";
      terminalInput.setSelectionRange(
        terminalInput.value.length,
        terminalInput.value.length,
      );
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const parts = terminalInput.value.split(/\s+/);
      const fragment = parts.at(-1)?.toLowerCase() ?? "";
      const candidates =
        parts.length === 1
          ? commands
          : [...directories]
              .map(baseName)
              .concat(notes.map((note) => note.title));
      const matches = candidates.filter((candidate) =>
        candidate.toLowerCase().startsWith(fragment),
      );
      if (matches.length === 1) {
        parts[parts.length - 1] = matches[0];
        terminalInput.value = parts.join(" ");
        terminalInput.setSelectionRange(
          terminalInput.value.length,
          terminalInput.value.length,
        );
      } else if (matches.length > 1) print(matches.join("  "));
    }
  });
  showCwd();
}

function cleanPath(value) {
  const cleaned = `/${String(value ?? "")
    .split("/")
    .filter(Boolean)
    .join("/")}`;
  return cleaned === "/" ? cleaned : cleaned.replace(/\/$/, "");
}
function parentPath(value) {
  const parts = cleanPath(value).split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
}
function baseName(value) {
  return cleanPath(value).split("/").filter(Boolean).at(-1) ?? "/";
}
function isWithin(value, root) {
  return root === "/" ? value !== "/" : value.startsWith(`${root}/`);
}
function depthFrom(value, root) {
  return (
    cleanPath(value).split("/").filter(Boolean).length -
    (root === "/" ? 0 : cleanPath(root).split("/").filter(Boolean).length)
  );
}
