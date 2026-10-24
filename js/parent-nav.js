/**
 * True when a key event should be left to the focused field instead of a site shortcut.
 * @param {KeyboardEvent} event
 */
export function isTyping(event) {
  const target = /** @type {HTMLElement | null} */ (event.target);
  return Boolean(event.isComposing || target?.isContentEditable || target?.closest?.("input, textarea, select"));
}

/**
 * Alt+↑ follows the header's `‹` link, mirroring the breadcrumb hierarchy.
 * @param {import("./types.js?v=665390e630").PageContext} context
 */
export function initParentNavigation({ document, window }) {
  const parentLink = /** @type {HTMLAnchorElement | null} */ (document.querySelector("#parent-link"));
  if (!parentLink) return;
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "ArrowUp" && event.altKey &&
      !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.repeat &&
      !event.defaultPrevented && !isTyping(event)
    ) {
      event.preventDefault();
      window.location.href = parentLink.href;
    }
  });
}
