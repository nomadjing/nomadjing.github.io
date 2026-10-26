// Pinned so a new Mermaid release cannot change rendering without a commit.
const mermaidUrl = "https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs";

/** @param {import("./types.js?v=12883d6848").PageContext} context */
export function initDiagrams({ document, console }) {
  const diagrams = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".mermaid"));
  if (!diagrams.length) return;
  import(mermaidUrl)
    .then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      return mermaid.run({ nodes: diagrams });
    })
    .catch((error) => console.warn("Mermaid could not be loaded", error));
}
