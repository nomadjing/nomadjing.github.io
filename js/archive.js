import { isTyping } from "./parent-nav.js?v=665390e630";

/**
 * Filters the notes tree by title and path; `/` focuses the search like in less or vim.
 * @param {import("./types.js?v=665390e630").PageContext} context
 */
export function initArchiveSearch({ document }) {
  const query = /** @type {HTMLInputElement | null} */ (document.querySelector("#archive-query"));
  const tree = /** @type {HTMLElement | null} */ (document.querySelector(".archive-tree"));
  const results = /** @type {HTMLElement | null} */ (document.querySelector("#archive-results"));
  const empty = /** @type {HTMLElement | null} */ (document.querySelector("#archive-empty"));
  if (!query || !tree || !results || !empty) return;
  const noteItems = /** @type {HTMLElement[]} */ ([...document.querySelectorAll(".archive-tree .tree-note")]);
  query.addEventListener("input", () => {
    const text = query.value.trim().toLocaleLowerCase();
    tree.hidden = Boolean(text);
    if (!text) {
      results.hidden = true;
      empty.hidden = true;
      results.replaceChildren();
      return;
    }
    const matches = noteItems.filter((note) => (note.dataset.search ?? "").includes(text));
    results.replaceChildren(...matches.map((note) => {
      const item = document.createElement("li");
      item.append(...[...note.children].map((child) => child.cloneNode(true)));
      return item;
    }));
    results.hidden = matches.length === 0;
    empty.hidden = matches.length !== 0;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey || isTyping(event)) return;
    event.preventDefault();
    query.focus();
  });
}
