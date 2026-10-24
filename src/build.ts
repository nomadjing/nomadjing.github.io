import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "./build-site.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(projectRoot, "dist");
const result = await buildSite({ projectRoot, outDir, contentRoot: process.env.CONTENT_ROOT });
console.log(`[build] ${result.notes} published note(s) from ${result.contentRoot}`);
console.log(`[build] ${result.pages} page(s), ${result.images} referenced image(s)`);
console.log(`[build] output: ${outDir}`);
