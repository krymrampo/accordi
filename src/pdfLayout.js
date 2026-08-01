import { transposeSong } from "./music.js";

const PAGE_SIZE = { width: 595.28, height: 841.89 };
const MARGINS = { top: 44, right: 44, bottom: 44, left: 44 };
const HEADER_HEIGHT = 62;
const FOOTER_HEIGHT = 16;
const DEFAULT_MAX_COLUMNS = 82;

function transposeLabel(delta) {
  return delta > 0 ? `+${delta}` : String(delta);
}

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildPdfFileName(song, delta) {
  const identity = [slug(song.artist), slug(song.title)].filter(Boolean).join("-") || "accordi";
  return `${identity}-trasposizione-${transposeLabel(delta)}.pdf`;
}

function splitHard(value, maxColumns) {
  if (!value) return [""];
  const chunks = [];
  for (let start = 0; start < value.length; start += maxColumns) {
    chunks.push(value.slice(start, start + maxColumns));
  }
  return chunks;
}

function wrapText(value, maxColumns) {
  if (value.length <= maxColumns) return [value];
  const words = value.trim().split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (word.length > maxColumns) {
      if (current) lines.push(current);
      const chunks = splitHard(word, maxColumns);
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1);
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxColumns) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function splitPairSegment(segment, maxColumns) {
  const chord = segment.chord?.display || "";
  const width = Math.max(chord.length, segment.text.length, 1) + (chord ? 1 : 0);
  if (width <= maxColumns) return [{ chord, text: segment.text, width }];
  const chunks = splitHard(segment.text, maxColumns);
  return chunks.map((text, index) => ({
    chord: index === 0 ? chord : "",
    text,
    width: Math.max(index === 0 ? chord.length : 0, text.length, 1) + (index === 0 && chord ? 1 : 0),
  }));
}

function wrapPair(row, maxColumns) {
  const lines = [];
  let current = [];
  let used = 0;
  const segments = row.segments.flatMap((segment) => splitPairSegment(segment, maxColumns));
  for (const segment of segments) {
    if (current.length && used + segment.width > maxColumns) {
      lines.push(current);
      current = [];
      used = 0;
    }
    current.push(segment);
    used += segment.width;
  }
  if (current.length) lines.push(current);
  return lines.map((segmentsForLine) => ({ kind: "pair", height: 24, segments: segmentsForLine }));
}

function wrapChords(row, maxColumns) {
  const lines = [];
  let current = [];
  let used = 0;
  for (const token of row.tokens) {
    const chord = token.chord.display;
    const width = chord.length + (current.length ? 2 : 0);
    if (current.length && used + width > maxColumns) {
      lines.push(current);
      current = [];
      used = 0;
    }
    current.push(chord);
    used += chord.length + (current.length > 1 ? 2 : 0);
  }
  if (current.length) lines.push(current);
  return lines.map((chords) => ({ kind: "chords", height: 15, chords }));
}

function layoutRows(song, maxColumns) {
  const rows = [];
  song.musicBlocks.forEach((block, blockIndex) => {
    block.sections.forEach((section, sectionIndex) => {
      if ((blockIndex || sectionIndex) && rows.at(-1)?.kind !== "blank") rows.push({ kind: "blank", height: 7 });
      section.rows.forEach((row) => {
        if (row.kind === "pair") rows.push(...wrapPair(row, maxColumns));
        else if (row.kind === "chords") rows.push(...wrapChords(row, maxColumns));
        else if (row.kind === "blank") rows.push({ kind: "blank", height: 7 });
        else if (row.kind === "raw") {
          rows.push(...splitHard(row.text, maxColumns).map((text) => ({ kind: "raw", text, height: 13 })));
        } else {
          rows.push(...wrapText(row.text, maxColumns).map((text) => ({ kind: "text", text, height: 13 })));
        }
      });
    });
  });
  return rows;
}

export function layoutSongForPdf(song, delta, options = {}) {
  const maxColumns = options.maxColumns || DEFAULT_MAX_COLUMNS;
  const transposedSong = transposeSong(song, delta);
  const rows = layoutRows(transposedSong, maxColumns);
  const pages = [[]];
  const pageTop = PAGE_SIZE.height - MARGINS.top - HEADER_HEIGHT;
  const pageBottom = MARGINS.bottom + FOOTER_HEIGHT;
  let cursor = pageTop;

  for (const row of rows) {
    if (cursor - row.height < pageBottom) {
      pages.push([]);
      cursor = pageTop;
    }
    const positioned = { ...row, y: cursor - row.height };
    pages.at(-1).push(positioned);
    cursor -= row.height;
  }

  return {
    pageSize: PAGE_SIZE,
    margins: MARGINS,
    headerHeight: HEADER_HEIGHT,
    footerHeight: FOOTER_HEIGHT,
    maxColumns,
    meta: {
      title: song.title,
      artist: song.artist,
      sourceUrl: song.sourceUrl,
      transpose: delta,
      transposeLabel: transposeLabel(delta),
    },
    pages,
  };
}
