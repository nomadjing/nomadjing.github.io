// Terminal paths are POSIX-like, rooted at the site tree: "/", "/notes/...", "/tags/...".

/** @param {unknown} value */
export function cleanPath(value) {
  const cleaned = `/${String(value ?? "").split("/").filter(Boolean).join("/")}`;
  return cleaned === "/" ? cleaned : cleaned.replace(/\/$/, "");
}

const segments = (/** @type {string} */ value) => cleanPath(value).split("/").filter(Boolean);

/** @param {string} value */
export function parentPath(value) {
  const parts = segments(value);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
}

/** @param {string} value */
export function baseName(value) {
  return segments(value).at(-1) ?? "/";
}

/** @param {string} value @param {string} root */
export function isWithin(value, root) {
  return root === "/" ? value !== "/" : value.startsWith(`${root}/`);
}

/** @param {string} value @param {string} root */
export function depthFrom(value, root) {
  return segments(value).length - (root === "/" ? 0 : segments(root).length);
}

/**
 * Resolves `input` against `cwd`, handling `.`, `..` and `~`.
 * @param {string} cwd
 * @param {string} [input]
 */
export function resolvePath(cwd, input = "") {
  if (!input) return cwd;
  if (input === "~") return "/";
  /** @type {string[]} */
  const stack = [];
  for (const part of (input.startsWith("/") ? input : `${cwd}/${input}`).split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return `/${stack.join("/")}`;
}
