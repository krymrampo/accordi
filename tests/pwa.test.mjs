import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("manifest defines an installable standalone application", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
});

test("service worker caches shell, pages and assets", async () => {
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /accordi-shell-v1/);
  assert.match(worker, /accordi-pages-v1/);
  assert.match(worker, /accordi-assets-v1/);
  assert.match(worker, /event\.request\.mode === "navigate"/);
});

test("Vercel serves files first and falls back to the SPA", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.routes[0], { handle: "filesystem" });
  assert.equal(config.routes.at(-1).dest, "/index.html");
});
