import {
  normalizeReaderFontSize,
  READER_FONT_DEFAULT,
} from "./readerPreferences.js";

export const SAVED_PAGES_KEY = "accordi-clean:saved-pages";
export const TRANSPOSE_MIN = -6;
export const TRANSPOSE_MAX = 6;

export function normalizeTranspose(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(TRANSPOSE_MIN, Math.min(TRANSPOSE_MAX, Math.round(parsed)));
}

export function normalizeSavedPage(item) {
  return {
    ...item,
    transpose: normalizeTranspose(item?.transpose),
    fontSize: normalizeReaderFontSize(item?.fontSize ?? READER_FONT_DEFAULT),
  };
}

export function readSavedPages(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(SAVED_PAGES_KEY) || "[]");
    return Array.isArray(saved) ? saved.map(normalizeSavedPage) : [];
  } catch {
    return [];
  }
}

function writeSavedPages(storage, pages, fallback) {
  try {
    storage?.setItem(SAVED_PAGES_KEY, JSON.stringify(pages));
    return pages;
  } catch {
    return fallback;
  }
}

export function rememberSavedPage(storage, path, title, artist = "") {
  const saved = readSavedPages(storage);
  if (!path.startsWith("/accordi/")) return saved;

  const existing = saved.find((item) => item.path === path);
  const current = saved.filter((item) => item.path !== path);
  const next = [{
    ...existing,
    path,
    title,
    artist,
    transpose: existing?.transpose ?? 0,
    fontSize: existing?.fontSize ?? READER_FONT_DEFAULT,
    savedAt: Date.now(),
  }, ...current].slice(0, 250);

  return writeSavedPages(storage, next, saved);
}

export function updateSavedPagePreferences(storage, path, preferences) {
  const saved = readSavedPages(storage);
  const next = saved.map((item) => item.path === path
    ? normalizeSavedPage({ ...item, ...preferences })
    : item);
  return writeSavedPages(storage, next, saved);
}

export function removeSavedPage(storage, path) {
  const saved = readSavedPages(storage);
  const next = saved.filter((item) => item.path !== path);
  return writeSavedPages(storage, next, saved);
}
