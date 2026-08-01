import assert from "node:assert/strict";
import test from "node:test";
import {
  parseChord,
  parseMusicText,
  transposeChord,
  transposeMusicBlock,
} from "../src/music.js";

test("keeps the original notation byte-for-byte at transpose zero", () => {
  for (const value of ["LAb", "MIb7+", "DO/SOL", "FA#m7/5-", "(SIb7)"]) {
    const chord = parseChord(value);
    assert.ok(chord, value);
    assert.equal(transposeChord(chord, 0, "DO"), value);
  }
});

test("transposes Italian flats, sharps and negative intervals", () => {
  assert.equal(transposeChord(parseChord("MIb"), 1, "MIb"), "MI");
  assert.equal(transposeChord(parseChord("FA#"), -1, "SOL"), "FA");
  assert.equal(transposeChord(parseChord("DO"), -6, "DO"), "SOLb");
  assert.equal(transposeChord(parseChord("DO"), 6, "DO"), "FA#");
});

test("transposes slash bass notes but preserves numeric extensions", () => {
  assert.equal(transposeChord(parseChord("DO/SOL"), 2, "DO"), "RE/LA");
  assert.equal(transposeChord(parseChord("LA7/DO#"), 2, "DO"), "SI7/RE#");
  assert.equal(transposeChord(parseChord("REm7/4"), 2, "DO"), "MIm7/4");
  assert.equal(transposeChord(parseChord("FA#m7/5-"), 1, "SOL"), "SOLm7/5-");
});

test("preserves supported punctuation around chords", () => {
  assert.equal(transposeChord(parseChord("|DO|"), 2, "DO"), "|RE|");
  assert.equal(transposeChord(parseChord("(SIb7)"), 2, "SIb"), "(DO7)");
});

test("builds chord/lyric pairs and standalone progressions", () => {
  const section = parseMusicText([
    "Intro:",
    "FA  DO  SOL",
    "",
    "DO         REm7 DO/MI   FA",
    "Lascia che sia  tutto così",
    "riga      dubbia @@",
  ].join("\n"), "DO");

  assert.deepEqual(section.rows.map(({ kind }) => kind), ["text", "chords", "blank", "pair", "raw"]);
  assert.deepEqual(section.rows[3].segments.filter(({ chord }) => chord).map(({ chord }) => chord.original), [
    "DO", "REm7", "DO/MI", "FA",
  ]);
});

test("snaps responsive chord anchors to word boundaries", () => {
  const section = parseMusicText("DO        SOL\nHello brave world", "DO");
  const pair = section.rows[0];

  assert.equal(pair.kind, "pair");
  assert.equal(pair.segments.map(({ text }) => text).join(""), "Hello brave world");
  assert.deepEqual(pair.segments.map(({ text }) => text), ["Hello ", "brave world"]);
});

test("transposes every parsed chord while leaving raw rows untouched", () => {
  const block = {
    sections: [parseMusicText("DO/SOL  MIb\nTesto lungo\nriga      dubbia @@", "DO")],
  };
  const transposed = transposeMusicBlock(block, 2);

  assert.equal(transposed.sections[0].rows[0].segments[0].chord.display, "RE/LA");
  assert.equal(transposed.sections[0].rows[0].segments[1].chord.display, "FA");
  assert.equal(transposed.sections[0].rows[1].text, "riga      dubbia @@");
});
