import { spawn } from "node:child_process";
import { createReadStream, statSync, watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const port = 4173;
const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".ttf": "font/ttf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".bmp": "image/bmp", ".svg": "image/svg+xml" };
// Injected into HTML responses only; the built site never contains it.
const reloadScript = `<script>new EventSource("/__reload").addEventListener("reload",()=>location.reload())</script>`;

const clients = new Set<ServerResponse>();
let building = false;
let queued = false;
/** Runs the build in a fresh process so source edits take effect, then reloads browsers. */
function build(): Promise<boolean> {
  if (building) {
    queued = true;
    return Promise.resolve(false);
  }
  building = true;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/build.ts"], { cwd: root, env: process.env, stdio: "inherit" });
    child.on("exit", (code) => {
      building = false;
      if (code === 0) for (const client of clients) client.write("event: reload\ndata:\n\n");
      else console.error("[dev] build failed; keeping the previous output");
      if (queued) {
        queued = false;
        void build();
      }
      resolve(code === 0);
    });
  });
}

function resolveFile(pathname: string): string | undefined {
  let file = path.resolve(dist, `.${pathname}`);
  if (!file.startsWith(`${dist}${path.sep}`) && file !== dist) return undefined;
  try { if (statSync(file).isDirectory()) file = path.join(file, "index.html"); }
  catch { file = path.join(file, "index.html"); }
  try { return statSync(file).isFile() ? file : undefined; }
  catch { return undefined; }
}

async function send(response: ServerResponse, file: string, status = 200): Promise<void> {
  const type = types[path.extname(file)] ?? "application/octet-stream";
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  if (type.startsWith("text/html")) response.end((await readFile(file, "utf8")).replace("</body>", `${reloadScript}</body>`));
  else createReadStream(file).pipe(response);
}

if (!await build()) process.exit(1);

const config = await loadConfig(root);
const watched = [
  path.join(root, "src"),
  path.join(root, "templates"),
  path.join(root, "styles"),
  path.join(root, "public"),
  path.join(root, "site.config.json"),
  path.resolve(root, process.env.CONTENT_ROOT ?? config.contentRoot),
  ...(config.fallbackContentRoot ? [path.resolve(root, config.fallbackContentRoot)] : []),
];
let timer: NodeJS.Timeout | undefined;
for (const target of watched) {
  try {
    watch(target, { recursive: true }, (_event, name) => {
      if (name && /(^|[\\/])\./.test(name)) return;
      clearTimeout(timer);
      timer = setTimeout(() => { console.log(`[dev] change in ${path.relative(root, target) || target}; rebuilding`); void build(); }, 150);
    });
  } catch { /* Missing optional roots (such as an absent fallback) are not watched. */ }
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  if (pathname === "/__reload") {
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    response.write(": connected\n\n");
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }
  const file = resolveFile(pathname);
  // Mirror GitHub Pages: unknown paths get /404.html with a 404 status.
  const fallback = path.join(dist, "404.html");
  const target = file ?? (resolveFile("/404.html") ? fallback : undefined);
  if (!target) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  send(response, target, file ? 200 : 404).catch(() => response.destroy());
}).listen(port, "127.0.0.1", () => console.log(`[dev] http://127.0.0.1:${port} · watching for changes`));
