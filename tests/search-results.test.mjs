import assert from "node:assert/strict";
import test from "node:test";
import { extractSearchResults, getSearchTerm, searchSavedPages } from "../src/searchResults.js";

function resultCard(title, artist, href) {
  const artistNode = { textContent: ` ${artist} ` };
  const link = {
    textContent: `\n ${title}\n ${artist}\n`,
    getAttribute(name) { return name === "href" ? href : null; },
    querySelector(selector) { return selector === ".tags-search" ? artistNode : null; },
  };
  return {
    querySelector(selector) { return selector === "a[href]" ? link : null; },
  };
}

function fixture(cards) {
  return {
    querySelectorAll(selector) {
      assert.equal(selector, "#content .risultati");
      return cards;
    },
  };
}

test("extracts, ranks, deduplicates and limits search results to ten", () => {
  const cards = [
    resultCard("Hey You", "Disturbed", "/accordi/internazionali/disturbed/hey-you-2/"),
    ...Array.from({ length: 12 }, (_, index) => resultCard(`A song with hey you ${index}`, `Artist ${index}`, `/accordi/test/song-${index}/`)),
    resultCard("Hey You", "Pink Floyd", "https://www.accordiespartiti.it/accordi/internazionali/pink-floyd/hey-you/"),
    resultCard("Hey You", "Pink Floyd", "/accordi/internazionali/pink-floyd/hey-you/"),
    resultCard("External", "Artist", "https://example.com/accordi/external/"),
  ];

  const results = extractSearchResults(fixture(cards), "Hey You");

  assert.equal(results.length, 10);
  assert.deepEqual(results.slice(0, 2).map(({ title, artist }) => [title, artist]), [
    ["Hey You", "Disturbed"],
    ["Hey You", "Pink Floyd"],
  ]);
  assert.equal(results.filter(({ path }) => path.includes("pink-floyd/hey-you")).length, 1);
});

test("ranks an exact artist match before partial title matches", () => {
  const cards = [
    resultCard("The Pink Floyd Song", "Someone Else", "/accordi/test/partial/"),
    resultCard("Time", "Pink Floyd", "/accordi/internazionali/pink-floyd/time-3/"),
    resultCard("Money", "Pink Floyd", "/accordi/internazionali/pink-floyd/money/"),
  ];

  const results = extractSearchResults(fixture(cards), "Pink Floyd");

  assert.deepEqual(results.map(({ title }) => title), ["Time", "Money", "The Pink Floyd Song"]);
});

test("reads and decodes the search term from the public URL format", () => {
  assert.equal(getSearchTerm("/?s=Hey%20You"), "Hey You");
  assert.equal(getSearchTerm("/accordi/internazionali/pink-floyd/hey-you/"), "");
});

test("offline search returns at most ten matching saved songs", () => {
  const saved = Array.from({ length: 14 }, (_, index) => ({
    path: `/accordi/test/hey-you-${index}/`,
    title: `Hey You ${index}`,
  }));

  assert.equal(searchSavedPages(saved, "hey you").length, 10);
  assert.deepEqual(searchSavedPages(saved, "missing"), []);
});
