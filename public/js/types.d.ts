// Types for the browser modules; checked by `npm run typecheck`, never shipped.

export interface SafeStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** What every feature module receives from `boot`. */
export interface PageContext {
  document: Document;
  window: Window & typeof globalThis;
  fetch: typeof fetch;
  console: Pick<Console, "warn">;
  requestAnimationFrame: (callback: () => void) => unknown;
  HTMLElement?: typeof HTMLElement;
  local: SafeStorage;
  session: SafeStorage;
}

export interface GardenNote { title: string; url: string; path: string; date?: string; updated?: string; tags?: string[]; text?: string; }
export interface GardenLink { directory: string; path: string; title: string; target: string; }

/** Shape of `/garden-index.json`, written by `src/garden-index.ts`. */
export interface GardenIndex {
  author: string;
  tagline: string;
  subtitle: string;
  views: Record<"home" | "notes" | "tags" | "about", string>;
  links?: GardenLink[];
  directories?: Array<{ path: string; url: string }>;
  about?: { title: string; text: string };
  notes?: GardenNote[];
}

export type Garden = ReturnType<typeof import("./terminal/garden.js").createGarden>;

/** State and effects the command runner needs from the terminal panel. */
export interface Shell {
  readonly garden: Garden;
  readonly cwd: string;
  setCwd(directory: string): void;
  readonly parentUrl: string | undefined;
  history: string[];
  print(text?: string, type?: string): void;
  clear(): void;
  navigate(url: string): void;
  close(): void;
}
