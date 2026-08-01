#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");
const client = path.join(dist, "client");
const serviceWorker = path.join(client, "sw.js");

for (const file of [index, worker, hosting, serviceWorker]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    return statSync(absolute).isDirectory() ? listFiles(absolute) : [absolute];
  });
}

const clientFiles = listFiles(client).filter((file) => file !== serviceWorker);
const buildHash = createHash("sha256");
clientFiles.forEach((file) => {
  buildHash.update(path.relative(client, file));
  buildHash.update(readFileSync(file));
});
const cacheVersion = buildHash.digest("hex").slice(0, 12);
const defaultShell = new Set(["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"]);
const extraAssets = clientFiles
  .map((file) => `/${path.relative(client, file).split(path.sep).join("/")}`)
  .filter((file) => !defaultShell.has(file) && file !== "/index.html")
  .sort();
const precacheSource = extraAssets.map((asset) => `,\n  ${JSON.stringify(asset)}`).join("");
const originalWorker = readFileSync(serviceWorker, "utf8");
const preparedWorker = originalWorker
  .replace("__BUILD_HASH__", cacheVersion)
  .replace("  /* __PRECACHE_ASSETS__ */", precacheSource);
if (preparedWorker.includes("__BUILD_HASH__") || preparedWorker.includes("__PRECACHE_ASSETS__")) {
  throw new Error("Service worker precache placeholders were not replaced");
}
writeFileSync(serviceWorker, preparedWorker);

mkdirSync(path.join(dist, "server"), { recursive: true });
mkdirSync(path.join(dist, ".openai"), { recursive: true });
copyFileSync(worker, path.join(dist, "server", "index.js"));
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));

console.log(`Prepared Sites build and ${extraAssets.length} offline assets (${cacheVersion})`);
