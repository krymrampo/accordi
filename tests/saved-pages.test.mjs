import assert from "node:assert/strict";
import test from "node:test";
import {
  readSavedPages,
  rememberSavedPage,
  removeSavedPage,
  SAVED_PAGES_KEY,
  updateSavedPagePreferences,
} from "../src/savedPages.js";

function memoryStorage(initialPages = []) {
  const values = new Map([[SAVED_PAGES_KEY, JSON.stringify(initialPages)]]);
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test("migrates existing saved songs to per-song reader defaults", () => {
  const storage = memoryStorage([{ path: "/accordi/uno/", title: "Uno" }]);
  assert.deepEqual(readSavedPages(storage), [{
    path: "/accordi/uno/",
    title: "Uno",
    transpose: 0,
    fontSize: 16,
  }]);
});

test("preserves and updates reader preferences independently for each song", () => {
  const storage = memoryStorage([
    { path: "/accordi/uno/", title: "Uno", transpose: 2, fontSize: 18, savedAt: 2 },
    { path: "/accordi/due/", title: "Due", transpose: 0, fontSize: 16, savedAt: 1 },
  ]);

  updateSavedPagePreferences(storage, "/accordi/uno/", { transpose: -3, fontSize: 13 });
  const saved = readSavedPages(storage);
  assert.deepEqual(saved.map(({ path, transpose, fontSize }) => ({ path, transpose, fontSize })), [
    { path: "/accordi/uno/", transpose: -3, fontSize: 13 },
    { path: "/accordi/due/", transpose: 0, fontSize: 16 },
  ]);
});

test("keeps preferences when a saved song is reopened and supports removal", () => {
  const storage = memoryStorage([
    { path: "/accordi/uno/", title: "Titolo vecchio", transpose: 4, fontSize: 20, savedAt: 1 },
  ]);

  const remembered = rememberSavedPage(storage, "/accordi/uno/", "Titolo nuovo", "Artista");
  assert.equal(remembered[0].title, "Titolo nuovo");
  assert.equal(remembered[0].transpose, 4);
  assert.equal(remembered[0].fontSize, 20);
  assert.deepEqual(removeSavedPage(storage, "/accordi/uno/"), []);
});
