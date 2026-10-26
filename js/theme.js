const storageKey = "site-theme";

/**
 * The inline script in <head> picks the first theme; this keeps it in sync afterwards.
 * @param {import("./types.js?v=12883d6848").PageContext} context
 */
export function initTheme({ document, window, local }) {
  const toggle = /** @type {HTMLButtonElement | null} */ (document.querySelector("#theme-toggle"));
  if (!toggle) return;
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let manuallySelected = ["light", "dark"].includes(local.get(storageKey) ?? "");
  const update = () => {
    const dark = root.dataset.theme === "dark";
    toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    toggle.title = dark ? "Light mode" : "Dark mode";
  };
  toggle.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    manuallySelected = true;
    local.set(storageKey, next);
    update();
  });
  systemTheme.addEventListener("change", () => {
    if (manuallySelected) return;
    root.dataset.theme = systemTheme.matches ? "dark" : "light";
    update();
  });
  update();
}
