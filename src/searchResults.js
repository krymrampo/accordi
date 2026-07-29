const SOURCE_ORIGIN = "https://www.accordiespartiti.it";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it");
}

function internalChordPath(href) {
  try {
    const url = new URL(href, SOURCE_ORIGIN);
    if (url.origin !== SOURCE_ORIGIN || !url.pathname.startsWith("/accordi/")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function relevanceScore(result, term) {
  const query = normalizeText(term);
  const title = normalizeText(result.title);
  const artist = normalizeText(result.artist);
  if (title === query) return 500;
  if (artist === query) return 450;
  if (title.startsWith(query)) return 400;
  if (artist.startsWith(query)) return 350;
  if (title.includes(query)) return 300;
  if (artist.includes(query)) return 250;
  return 0;
}

export function getSearchTerm(path) {
  try {
    return new URL(path, "https://local.invalid").searchParams.get("s")?.trim() || "";
  } catch {
    return "";
  }
}

export function searchSavedPages(savedPages, term, limit = 10) {
  const query = normalizeText(term);
  if (!query) return [];
  return savedPages
    .filter((item) => normalizeText(`${item.title} ${item.path}`).includes(query))
    .slice(0, limit);
}

export function extractSearchResults(documentRoot, term, limit = 10) {
  const seen = new Set();
  const results = [];

  [...documentRoot.querySelectorAll("#content .risultati")].forEach((card, sourceIndex) => {
    const link = card.querySelector("a[href]");
    const path = internalChordPath(link?.getAttribute("href"));
    if (!link || !path || seen.has(path)) return;

    const artist = cleanText(link.querySelector(".tags-search")?.textContent);
    const fullText = cleanText(link.textContent);
    const artistIndex = artist ? fullText.toLocaleLowerCase("it").lastIndexOf(artist.toLocaleLowerCase("it")) : -1;
    const title = cleanText(artistIndex >= 0 ? fullText.slice(0, artistIndex) : fullText);
    if (!title) return;

    seen.add(path);
    results.push({ path, title, artist, sourceIndex });
  });

  return results
    .sort((left, right) => relevanceScore(right, term) - relevanceScore(left, term) || left.sourceIndex - right.sourceIndex)
    .slice(0, limit)
    .map(({ sourceIndex: _sourceIndex, ...result }) => result);
}
