import assert from "node:assert/strict";
import test from "node:test";
import { buildPdfFileName, layoutSongForPdf } from "../src/pdfLayout.js";
import { parseMusicText } from "../src/music.js";

function fixture(repetitions = 1) {
  const rows = parseMusicText([
    "DO         REm7 DO/MI   FA",
    "Lascia che sia  tutto così",
    "DO/SOL  LAm7  REm7  SOL",
    "E il vento volava sul tuo foulard",
  ].join("\n"), "DO").rows;
  return {
    title: "Solo",
    artist: "Claudio Baglioni",
    sourceUrl: "https://www.accordiespartiti.it/accordi/italiani/baglioni-claudio/solo-2/",
    musicBlocks: [{ sections: [{ key: "DO", rows: Array.from({ length: repetitions }, () => rows).flat() }] }],
  };
}

test("creates a stable descriptive PDF filename", () => {
  assert.equal(buildPdfFileName(fixture(), 2), "claudio-baglioni-solo-trasposizione-+2.pdf");
  assert.equal(buildPdfFileName({ ...fixture(), artist: "" }, -1), "solo-trasposizione--1.pdf");
});
test("lays out transposed musical rows inside A4 pages", () => {
  const layout = layoutSongForPdf(fixture(), 2);

  assert.equal(layout.pageSize.width, 595.28);
  assert.equal(layout.pageSize.height, 841.89);
  assert.equal(layout.meta.transposeLabel, "+2");
  assert.ok(layout.pages.length >= 1);
  assert.ok(layout.pages.flat().some((row) => row.kind === "pair" && row.segments[0].chord === "RE"));
  assert.ok(layout.pages.flat().every((row) => row.y >= layout.margins.bottom));
});

test("paginates long songs without clipping rows", () => {
  const layout = layoutSongForPdf(fixture(35), -2);

  assert.ok(layout.pages.length > 1);
  for (const page of layout.pages) {
    for (const row of page) {
      assert.ok(row.y >= layout.margins.bottom, `${row.kind} at ${row.y}`);
      assert.ok(row.y + row.height <= layout.pageSize.height - layout.margins.top + 1);
    }
  }
});
