import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("manifest defines an installable standalone application", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
});

test("service worker caches the shell and opened pages", async () => {
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /accordi-shell-__BUILD_HASH__/);
  assert.match(worker, /__PRECACHE_ASSETS__/);
  assert.match(worker, /accordi-pages-v1/);
  assert.doesNotMatch(worker, /api\/asset/);
  assert.match(worker, /event\.request\.mode === "navigate"/);
  assert.match(worker, /cache\.match\(request, \{ ignoreVary: true \}\)/);
  assert.match(worker, /application\/json/);
});

test("built service worker precaches every hashed application asset", async () => {
  const worker = await readFile(new URL("../dist/client/sw.js", import.meta.url), "utf8");
  const assets = await readdir(new URL("../dist/client/assets/", import.meta.url));

  assert.doesNotMatch(worker, /__BUILD_HASH__|__PRECACHE_ASSETS__/);
  assert.match(worker, /accordi-shell-[a-f0-9]{12}/);
  for (const asset of assets) assert.match(worker, new RegExp(`/assets/${asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});

test("Vercel serves files first and falls back to the SPA", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.routes[0], { handle: "filesystem" });
  assert.equal(config.routes.at(-1).dest, "/index.html");
});
