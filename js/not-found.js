/** Columns a string occupies in a monospace font; CJK and other wide characters take two. */
export function displayWidth(/** @type {string} */ text) {
  let width = 0;
  for (const char of text) width += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(char) ? 2 : 1;
  return width;
}

/** Classic edit distance, used to suggest the note the visitor probably meant. */
function distance(/** @type {string} */ a, /** @type {string} */ b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

const lastSegment = (/** @type {string} */ url) => url.split("/").filter(Boolean).at(-1)?.toLowerCase() ?? "";

/**
 * The published note whose URL is closest to `pathname`, or undefined when
 * nothing is plausibly what the visitor meant.
 * @param {string} pathname
 * @param {Array<{ url: string, path: string }>} notes
 */
export function closestNote(pathname, notes) {
  const wanted = lastSegment(pathname);
  if (!wanted) return undefined;
  let best;
  let bestScore = Infinity;
  for (const note of notes) {
    const candidate = lastSegment(note.url);
    const score = candidate.includes(wanted) || wanted.includes(candidate) ? 0 : distance(wanted, candidate) / Math.max(wanted.length, candidate.length);
    if (score < bestScore) [best, bestScore] = [note, score];
  }
  return bestScore <= 0.4 ? best : undefined;
}

/**
 * Fills the 404 diagnostic with the requested path and, once the site index
 * arrives, a "did you mean" suggestion.
 * @param {import("./types.js?v=12883d6848").PageContext} context
 */
export function initNotFound({ document, window, fetch }) {
  const page = document.querySelector(".not-found");
  if (!page) return;
  let pathname = window.location.pathname;
  try { pathname = decodeURI(pathname); } catch { /* Keep the raw path. */ }
  page.querySelectorAll("[data-request-path]").forEach((node) => { node.textContent = pathname; });
  const caret = page.querySelector("[data-request-caret]");
  if (caret) caret.textContent = "^".repeat(Math.max(1, displayWidth(pathname)));
  fetch("/garden-index.json")
    .then((response) => (response.ok ? response.json() : null))
    .then((/** @type {import("./types.js?v=12883d6848").GardenIndex | null} */ index) => {
      const note = closestNote(pathname, index?.notes ?? []);
      const suggestion = /** @type {HTMLElement | null} */ (page.querySelector("[data-suggestion]"));
      const link = /** @type {HTMLAnchorElement | null} */ (page.querySelector("[data-suggestion-link]"));
      if (!note || !suggestion || !link) return;
      link.href = note.url;
      link.textContent = note.path.replace(/\/$/, "");
      suggestion.hidden = false;
    })
    .catch(() => { /* The suggestion is optional. */ });
}
