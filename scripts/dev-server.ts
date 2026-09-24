import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, ["--import", "tsx", "src/build.ts"], { cwd: root, env: process.env, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
const dist = path.join(root, "dist");
const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".bmp": "image/bmp" };

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  let file = path.resolve(dist, `.${pathname}`);
  if (!file.startsWith(`${dist}${path.sep}`) && file !== dist) { response.writeHead(403).end("Forbidden"); return; }
  try { if (statSync(file).isDirectory()) file = path.join(file, "index.html"); }
  catch { file = path.join(file, "index.html"); }
  try {
    if (!statSync(file).isFile()) throw new Error();
    response.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found"); }
}).listen(4173, "127.0.0.1", () => console.log("[dev] http://127.0.0.1:4173"));
