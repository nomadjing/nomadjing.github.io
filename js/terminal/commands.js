import { renderNoteHeatmap } from "./heatmap.js?v=665390e630";
import { resolvePath } from "./paths.js?v=665390e630";

export const commandNames = [
  "help", "pwd", "ls", "cd", "up", "notes", "tags", "about", "tree", "open", "cat",
  "random", "whoami", "home", "history", "clear", "coffee", "heatmap", "exit",
];

const helpText = `Commands
help  pwd  ls [path]  cd <path>  tree [path]
open <note|path>  cat <about|now>
home  notes  tags  about  up  random  whoami
history  clear  coffee  heatmap  exit

UI / Shortcuts
home   ↔ nomad_
up     ↔ ‹  /  Alt+↑
exit   ↔ >_ / ×  /  Esc

>_ terminal  ↔ \`
Completion   ↔ Tab
History      ↔ ↑ / ↓`;

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
const coffeeArt = "    ( (\n     ) )\n  ........\n  |      |]\n  \\      /\n   `----'";

/** Shuffled without repeats until every joke has been told once. */
function createCoffeeMachine() {
  /** @type {number[]} */
  let order = [];
  return () => {
    if (!order.length) {
      order = [...coffeeJokes.keys()];
      for (let index = order.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [order[index], order[swap]] = [order[swap], order[index]];
      }
    }
    return coffeeJokes[/** @type {number} */ (order.pop())];
  };
}

/**
 * Splits a command line into words, honouring single and double quotes.
 * @param {string} raw
 */
export function parseCommand(raw) {
  const [name = "", ...args] = raw.match(/"[^"]*"|'[^']*'|\S+/g)?.map((/** @type {string} */ part) => part.replace(/^(['"])(.*)\1$/, "$2")) ?? [];
  return { name: name.toLowerCase(), rawName: name, argument: args.join(" ") };
}

/**
 * `shell` supplies the terminal's state and effects:
 * { garden, cwd, setCwd, print, clear, navigate, close, parentUrl, history }.
 * @param {import("../types.js?v=665390e630").Shell} shell
 * @returns {(raw: string) => void}
 */
export function createCommandRunner(shell) {
  const nextCoffeeJoke = createCoffeeMachine();
  return (raw) => {
    const { name, rawName, argument } = parseCommand(raw);
    const { garden } = shell;
    switch (name) {
      case "help":
        return shell.print(helpText);
      case "pwd":
        return shell.print(shell.cwd);
      case "up":
        if (shell.parentUrl) return shell.navigate(shell.parentUrl);
        return shell.print("Already at the site root.", "hint");
      case "ls": {
        const entries = garden.list(shell.cwd, argument);
        if (!entries) return shell.print(`ls: ${argument}: no such directory`, "error");
        return shell.print(entries.length ? entries.join("  ") : "(empty)", "listing");
      }
      case "cd": {
        const directory = garden.canonicalDirectory(resolvePath(shell.cwd, argument || "/"));
        if (!directory) return shell.print(`cd: ${argument}: no such directory`, "error");
        shell.setCwd(directory);
        shell.print(`moving to ${directory}`);
        return shell.navigate(garden.directoryUrls.get(directory) ?? "/");
      }
      case "tree": {
        const rows = garden.tree(shell.cwd, argument);
        return rows ? shell.print(rows, "listing") : shell.print(`tree: ${argument}: no such directory`, "error");
      }
      case "open": {
        const note = garden.findNote(shell.cwd, argument);
        const directory = garden.canonicalDirectory(resolvePath(shell.cwd, argument));
        if (note) return shell.navigate(note.url);
        if (directory) return shell.navigate(garden.directoryUrls.get(directory) ?? "/");
        return shell.print(`open: ${argument}: not found or ambiguous; use the full path shown by ls`, "error");
      }
      case "cat": {
        const target = argument.toLowerCase();
        const note = target === "about" ? garden.index.about : garden.findNote(shell.cwd, argument);
        if (!note || !["about", "now"].includes(target))
          return shell.print("cat: available public documents are about and now", "error");
        return shell.print(`${note.title}\n${"-".repeat(Math.min(note.title.length, 24))}\n${note.text || "(empty)"}`);
      }
      case "random":
        if (!garden.notes.length) return shell.print("random: no published notes yet", "error");
        return shell.navigate(garden.notes[Math.floor(Math.random() * garden.notes.length)].url);
      case "whoami":
        return shell.print(`${garden.index.author}\n${garden.index.tagline}\n${garden.index.subtitle}`);
      case "home":
      case "notes":
      case "tags":
      case "about":
        return shell.navigate(garden.index.views[name]);
      case "history":
        return shell.print(shell.history.map((command, index) => `${String(index + 1).padStart(2, " ")}  ${command}`).join("\n"));
      case "clear":
        return shell.clear();
      case "coffee":
        return shell.print(`${coffeeArt}\n\n${nextCoffeeJoke()}`, "hint");
      case "heatmap":
        return shell.print(renderNoteHeatmap(garden.notes), "hint");
      case "exit":
        return shell.close();
      default:
        return shell.print(`${rawName}: command not found. Try help.`, "error");
    }
  };
}
