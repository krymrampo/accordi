import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeReaderFontSize,
  readReaderFontSize,
  readerFontPercentage,
  READER_FONT_DEFAULT,
  READER_FONT_STORAGE_KEY,
  saveReaderFontSize,
} from "../src/readerPreferences.js";

function memoryStorage(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) values.set(READER_FONT_STORAGE_KEY, initialValue);
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test("uses the default reader size when no valid preference exists", () => {
  assert.equal(readReaderFontSize(memoryStorage()), READER_FONT_DEFAULT);
  assert.equal(normalizeReaderFontSize("not-a-number"), READER_FONT_DEFAULT);
});

test("clamps and persists reader font sizes", () => {
  const storage = memoryStorage();
  assert.equal(saveReaderFontSize(storage, 30), 22);
  assert.equal(readReaderFontSize(storage), 22);
  assert.equal(saveReaderFontSize(storage, 8), 12);
  assert.equal(readReaderFontSize(storage), 12);
});

test("expresses reader size as a percentage of the 16px default", () => {
  assert.equal(readerFontPercentage(12), 75);
  assert.equal(readerFontPercentage(16), 100);
  assert.equal(readerFontPercentage(22), 138);
});
