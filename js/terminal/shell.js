import { isTyping } from "../parent-nav.js?v=665390e630";
import { commandNames, createCommandRunner } from "./commands.js?v=665390e630";
import { createGarden } from "./garden.js?v=665390e630";
import { inputHtml, lineHtml, suggestion } from "./render.js?v=665390e630";

const sessionKey = "nomad-terminal";
const heightKey = "nomad-terminal-height";
const promptFor = (/** @type {string} */ cwd) => (cwd === "/" ? "~" : `~${cwd}`);

/**
 * The terminal panel. The site index is fetched the first time the terminal
 * opens, so pages that never use it don't pay for it. Navigating from the
 * terminal carries its history and output to the next page via sessionStorage.
 * @param {import("../types.js?v=665390e630").PageContext} context
 */
export function initTerminal({ document, window, fetch, console, HTMLElement, local, session }) {
  /** @type {<T extends HTMLElement = HTMLElement>(selector: string) => T | null} */
  const $ = (selector) => document.querySelector(selector);
  const terminal = $("#terminal");
  const form = $("#terminal-form");
  const input = /** @type {HTMLInputElement | null} */ ($("#terminal-input"));
  const output = $("#terminal-output");
  const cwdLabel = $("#terminal-cwd");
  const toggle = $("#terminal-toggle");
  const closeButton = $("#terminal-close");
  const resizeHandle = $("#terminal-resize");
  const pageMain = $("main");
  // Optional chrome: highlighting mirror, right prompt and window title.
  const mirror = $("#terminal-mirror");
  const rprompt = $("#terminal-rprompt");
  const title = $("#terminal-title");
  if (!terminal || !form || !input || !output || !cwdLabel || !toggle || !closeButton || !resizeHandle || !pageMain) return;

  /** @type {HTMLElement} */
  let returnFocus = toggle;
  let mainTop = 0;
  /** @type {string[]} */
  const history = [];
  let historyIndex = 0;
  let initialCwd = pageMain.dataset.directory || "/";
  let cwd = initialCwd;
  const showCwd = () => {
    cwdLabel.textContent = promptFor(cwd);
    if (title) title.textContent = `nomad@home: ${promptFor(cwd)}`;
  };
  /** zsh-style right prompt: the last command's status, then the time. @param {boolean | null} failed */
  const showStatus = (failed) => {
    if (!rprompt) return;
    const status = failed === null ? "" : failed ? '<span class="status-bad">✘</span>' : '<span class="status-ok">✔</span>';
    rprompt.innerHTML = `${status}<span>${new Date().toTimeString().slice(0, 5)}</span>`;
  };

  // Height: drag the handle or use arrow keys; remembered across visits.
  const setHeight = (/** @type {number} */ height) => {
    const max = Math.floor(window.innerHeight * 0.75);
    const value = Math.round(Math.max(Math.min(180, max), Math.min(height, max)));
    terminal.style.setProperty("--terminal-height", `${value}px`);
  };
  const saveHeight = () => local.set(heightKey, String(Math.round(terminal.getBoundingClientRect().height)));
  const savedHeight = Number(local.get(heightKey));
  if (savedHeight > 0) setHeight(savedHeight);
  resizeHandle.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = terminal.getBoundingClientRect().height;
    resizeHandle.setPointerCapture(event.pointerId);
    const move = (/** @type {PointerEvent} */ moveEvent) => setHeight(startHeight + startY - moveEvent.clientY);
    const end = () => {
      resizeHandle.removeEventListener("pointermove", move);
      resizeHandle.removeEventListener("pointerup", end);
      resizeHandle.removeEventListener("pointercancel", end);
      saveHeight();
    };
    resizeHandle.addEventListener("pointermove", move);
    resizeHandle.addEventListener("pointerup", end);
    resizeHandle.addEventListener("pointercancel", end);
  });
  resizeHandle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    setHeight(terminal.getBoundingClientRect().height + (event.key === "ArrowUp" ? 20 : -20));
    saveHeight();
  });

  const appendLine = (/** @type {string} */ text, type = "") => {
    const line = document.createElement("div");
    line.className = `terminal-line ${type}`.trim();
    line.textContent = text;
    const html = lineHtml(text, type);
    if (html !== null) line.innerHTML = html;
    output.append(line);
  };
  let failed = false;
  const print = (text = "", type = "") => {
    if (type === "error") failed = true;
    appendLine(text, type);
    output.scrollTop = output.scrollHeight;
  };

  // Site index, loaded on demand. Commands typed while it loads run once it arrives.
  /** @type {import("../types.js?v=665390e630").Garden | null} */
  let garden = null;
  /** @type {Promise<unknown> | null} */
  let gardenRequest = null;
  const loadGarden = () => gardenRequest ??= fetch("/garden-index.json")
    .then((response) => {
      if (!response.ok) throw new Error(`garden index: ${response.status}`);
      return response.json();
    })
    .then((/** @type {import("../types.js?v=665390e630").GardenIndex} */ index) => {
      const loaded = createGarden(index);
      initialCwd = loaded.canonicalDirectory(initialCwd) ?? "/";
      cwd = loaded.canonicalDirectory(cwd) ?? initialCwd;
      garden = loaded;
      showCwd();
      refreshInput();
      return loaded;
    })
    .catch((error) => {
      gardenRequest = null;
      print("terminal: could not load the site index; try again.", "error");
      console.warn("Terminal could not load the site index", error);
    });
  const whenReady = (/** @type {() => void} */ action) => {
    if (garden) action();
    else loadGarden().then(() => { if (garden) action(); });
  };

  // The input's own text is transparent; the mirror behind it draws the coloured
  // command line plus the suggestion, in the same font at the same offset.
  let suggested = "";
  const refreshInput = () => {
    if (!mirror) return;
    suggested = input.selectionStart === input.value.length ? suggestion(input.value, history, cwd, garden) : "";
    mirror.innerHTML = inputHtml(input.value, cwd, garden, suggested);
    mirror.style.transform = `translateX(${-input.scrollLeft}px)`;
  };
  if (mirror) form.classList.add("has-mirror");

  const focusInput = () => {
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  };
  const setToggleState = (/** @type {boolean} */ open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close terminal" : "Open terminal");
    toggle.title = open ? "Close terminal (Esc)" : "Open terminal (`)";
  };
  const open = () => {
    loadGarden();
    if (!terminal.hidden) {
      focusInput();
      return;
    }
    returnFocus = HTMLElement && document.activeElement instanceof HTMLElement ? document.activeElement : toggle;
    const pageScroll = window.scrollY;
    mainTop = pageMain.getBoundingClientRect().top + pageScroll;
    terminal.hidden = false;
    setToggleState(true);
    showStatus(null);
    document.body.classList.add("terminal-open");
    window.scrollTo(0, 0);
    pageMain.scrollTop = Math.max(0, pageScroll - mainTop);
    focusInput();
  };
  const close = () => {
    if (terminal.hidden) return;
    const restoreScroll = mainTop + pageMain.scrollTop;
    output.replaceChildren();
    input.value = "";
    refreshInput();
    history.length = 0;
    historyIndex = 0;
    cwd = initialCwd;
    showCwd();
    terminal.hidden = true;
    setToggleState(false);
    document.body.classList.remove("terminal-open");
    session.remove(sessionKey);
    if (returnFocus === toggle) toggle.setAttribute("data-restored-focus", "");
    returnFocus.focus({ preventScroll: true });
    window.scrollTo(0, restoreScroll);
  };
  const navigate = (/** @type {string} */ url) => {
    if (!terminal.hidden) {
      session.set(sessionKey, JSON.stringify({
        target: new URL(url, "https://site.invalid").pathname,
        history: history.slice(-100),
        output: [...output.children].slice(-200).map((line) => ({ text: line.textContent, type: line.className })),
      }));
    }
    window.location.href = url;
  };

  const runCommand = createCommandRunner({
    get garden() { return /** @type {import("../types.js?v=665390e630").Garden} */ (garden); },
    get cwd() { return cwd; },
    setCwd(directory) { cwd = directory; showCwd(); },
    get parentUrl() { return /** @type {HTMLAnchorElement | null} */ ($("#parent-link"))?.href; },
    history,
    print,
    clear: () => output.replaceChildren(),
    navigate,
    close,
  });
  const run = (/** @type {string} */ rawCommand) => {
    const raw = rawCommand.trim();
    if (!raw) return;
    print(`nomad@home:${promptFor(cwd)}$ ${raw}`, "command");
    history.push(raw);
    historyIndex = history.length;
    failed = false;
    runCommand(raw);
    showStatus(failed);
  };
  const complete = () => {
    if (!garden) return;
    const { parts, matches } = garden.completions(cwd, input.value, commandNames);
    if (matches.length === 1) {
      parts[parts.length - 1] = matches[0];
      input.value = parts.join(" ");
      input.setSelectionRange(input.value.length, input.value.length);
      refreshInput();
    } else if (matches.length > 1) print(matches.join("  "));
  };

  toggle.addEventListener("click", () => (terminal.hidden ? open() : close()));
  closeButton.addEventListener("click", close);
  toggle.addEventListener("blur", () => toggle.removeAttribute("data-restored-focus"));
  terminal.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target === input || target.closest("button")) return;
    if (window.getSelection()?.isCollapsed === false) return;
    focusInput();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab") toggle.removeAttribute("data-restored-focus");
    if (event.key === "Escape" && !terminal.hidden) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "`" && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && !isTyping(event)) {
      event.preventDefault();
      open();
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value;
    input.value = "";
    refreshInput();
    whenReady(() => run(value));
  });
  input.addEventListener("input", () => refreshInput());
  input.addEventListener("keyup", () => refreshInput());
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === "ArrowUp" ? -1 : 1)));
      input.value = history[historyIndex] ?? "";
      input.setSelectionRange(input.value.length, input.value.length);
      refreshInput();
    }
    // fish: → or End at the end of the line accepts the suggestion.
    if ((event.key === "ArrowRight" || event.key === "End") && suggested && !event.shiftKey && input.selectionStart === input.value.length) {
      event.preventDefault();
      input.value += suggested;
      input.setSelectionRange(input.value.length, input.value.length);
      refreshInput();
    }
    if (event.key === "Tab") {
      event.preventDefault();
      whenReady(complete);
    }
  });

  showCwd();
  try {
    const saved = JSON.parse(session.get(sessionKey) ?? "null");
    session.remove(sessionKey);
    if (saved && saved.target === window.location.pathname && Array.isArray(saved.history) && Array.isArray(saved.output)) {
      history.push(...saved.history);
      historyIndex = history.length;
      saved.output.forEach((/** @type {{ text: string, type: string }} */ line) => appendLine(line.text, line.type.replace(/^terminal-line\s*/, "")));
      output.scrollTop = output.scrollHeight;
      open();
    }
  } catch { /* A malformed session just starts a fresh terminal. */ }
}
