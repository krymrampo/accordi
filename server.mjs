import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(ROOT, ".clean-cache");
const SOURCE_ORIGIN = "https://www.accordiespartiti.it";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function cacheName(prefix, value) {
  return path.join(CACHE_DIR, `${prefix}-${createHash("sha256").update(value).digest("hex")}`);
}

function safeSourcePath(rawPath) {
  const candidate = new URL(rawPath || "/", SOURCE_ORIGIN);
  if (candidate.origin !== SOURCE_ORIGIN || !candidate.pathname.startsWith("/")) return null;
  return `${candidate.pathname}${candidate.search}`;
}

async function cachedText(key, sourcePath) {
  const bodyFile = `${cacheName("page", key)}.html`;
  const metaFile = `${cacheName("page", key)}.json`;
  if (existsSync(bodyFile) && existsSync(metaFile)) {
    const meta = JSON.parse(await readFile(metaFile, "utf8"));
    if (Date.now() - meta.savedAt < CACHE_TTL_MS) {
      return { html: await readFile(bodyFile, "utf8"), cached: true, savedAt: meta.savedAt };
    }
  }
  const response = await fetch(`${SOURCE_ORIGIN}${sourcePath}`, {
    headers: { "User-Agent": "AccordiESpartitiClean/1.0 local-reader", Accept: "text/html" },
  });
  if (!response.ok) throw new Error(`Origine ha risposto ${response.status}`);
  const html = await response.text();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(bodyFile, html);
  await writeFile(metaFile, JSON.stringify({ savedAt: Date.now(), sourcePath }, null, 2));
  return { html, cached: false, savedAt: Date.now() };
}

const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
const server = createHttpServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  try {
    if (url.pathname === "/api/page") {
      const sourcePath = safeSourcePath(url.searchParams.get("path"));
      if (!sourcePath) throw new Error("Percorso non consentito");
      const page = await cachedText(sourcePath, sourcePath);
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ ...page, sourcePath }));
      return;
    }
  } catch (error) {
    response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Errore di recupero" }));
    return;
  }
  vite.middlewares(request, response);
});

const port = Number(process.env.PORT || 4174);
server.listen(port, "127.0.0.1", () => {
  console.log(`Accordi e Spartiti Clean: http://127.0.0.1:${port}`);
});
