import { initArchiveSearch } from "./archive.js?v=12883d6848";
import { initDiagrams } from "./diagrams.js?v=12883d6848";
import { initNotFound } from "./not-found.js?v=12883d6848";
import { initParentNavigation } from "./parent-nav.js?v=12883d6848";
import { initReading } from "./reading.js?v=12883d6848";
import { initTerminal } from "./terminal/shell.js?v=12883d6848";
import { initTheme } from "./theme.js?v=12883d6848";

/**
 * Web Storage can throw on access (privacy modes, blocked cookies), so every
 * use goes through a wrapper that degrades to "nothing stored".
 * @param {Record<string, any>} env
 * @param {"localStorage" | "sessionStorage"} name
 * @returns {import("./types.js?v=12883d6848").SafeStorage}
 */
function safeStorage(env, name) {
  /** @type {Storage | undefined} */
  let storage;
  try { storage = env[name]; } catch { storage = undefined; }
  return {
    get(key) { try { return storage?.getItem(key) ?? null; } catch { return null; } },
    set(key, value) { try { storage?.setItem(key, value); } catch { /* optional */ } },
    remove(key) { try { storage?.removeItem(key); } catch { /* optional */ } },
  };
}

/**
 * Starts every page feature. `env` is `globalThis` in the browser; tests pass
 * a small fake with the same shape.
 * @param {Record<string, any>} env
 */
export function boot(env) {
  /** @type {import("./types.js?v=12883d6848").PageContext} */
  const context = {
    document: env.document,
    window: env.window,
    fetch: (input, init) => env.fetch(input, init),
    console: env.console ?? console,
    requestAnimationFrame: env.requestAnimationFrame ?? ((/** @type {() => void} */ callback) => callback()),
    HTMLElement: env.HTMLElement,
    local: safeStorage(env, "localStorage"),
    session: safeStorage(env, "sessionStorage"),
  };
  initParentNavigation(context);
  initTheme(context);
  initDiagrams(context);
  initReading(context);
  initArchiveSearch(context);
  initNotFound(context);
  initTerminal(context);
}
