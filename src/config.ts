import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SiteConfig } from "./types.js";

export async function loadConfig(projectRoot: string): Promise<SiteConfig> {
  const raw = JSON.parse(await readFile(path.join(projectRoot, "site.config.json"), "utf8")) as Partial<SiteConfig>;
  for (const key of ["siteName", "baseUrl", "contentRoot", "author", "tagline", "subtitle"] as const)
    if (typeof raw[key] !== "string") throw new Error(`site.config.json: "${key}" must be a string`);
  return { lang: "zh-CN", ...raw } as SiteConfig;
}
