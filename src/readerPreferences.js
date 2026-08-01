export const READER_FONT_MIN = 12;
export const READER_FONT_MAX = 22;
export const READER_FONT_DEFAULT = 16;
export const READER_FONT_STORAGE_KEY = "accordi-clean:reader-font-size-v1";

export function normalizeReaderFontSize(value) {
  if (value === null || value === undefined || value === "") return READER_FONT_DEFAULT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return READER_FONT_DEFAULT;
  return Math.max(READER_FONT_MIN, Math.min(READER_FONT_MAX, Math.round(parsed)));
}

export function readReaderFontSize(storage) {
  try {
    return normalizeReaderFontSize(storage?.getItem(READER_FONT_STORAGE_KEY));
  } catch {
    return READER_FONT_DEFAULT;
  }
}

export function saveReaderFontSize(storage, value) {
  const normalized = normalizeReaderFontSize(value);
  try {
    storage?.setItem(READER_FONT_STORAGE_KEY, String(normalized));
  } catch {
    // La preferenza resta valida per la sessione se lo storage non è disponibile.
  }
  return normalized;
}

export function readerFontPercentage(value) {
  return Math.round((normalizeReaderFontSize(value) / READER_FONT_DEFAULT) * 100);
}
