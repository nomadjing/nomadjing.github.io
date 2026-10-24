/** One generated HTML file; `file` is relative to the output root. */
export interface Page { file: string; html: string; }

export const pageFile = (url: string) => [...url.split("/").filter(Boolean), "index.html"].join("/");
