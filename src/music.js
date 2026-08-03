export const SOURCE_ORIGIN = "https://www.accordiespartiti.it";

const NOTES = {
  DO: 0,
  RE: 2,
  MI: 4,
  FA: 5,
  SOL: 7,
  LA: 9,
  SI: 11,
};

const SHARP_NOTES = ["DO", "DO#", "RE", "RE#", "MI", "FA", "FA#", "SOL", "SOL#", "LA", "LA#", "SI"];
const FLAT_NOTES = ["DO", "REb", "RE", "MIb", "MI", "FA", "SOLb", "SOL", "LAb", "LA", "SIb", "SI"];
const QUALITY_WORDS = ["omit", "sus", "maj", "min", "dim", "aug", "add", "alt", "no", "m", "M"];

function modulo(value, divisor = 12) {
  return ((value % divisor) + divisor) % divisor;
}

function parseNote(value) {
  const match = /^(DO|RE|MI|FA|SOL|LA|SI)([#b]?)$/.exec(value || "");
  if (!match) return null;
  const [, name, accidental] = match;
  return {
    name,
    accidental,
    pitch: modulo(NOTES[name] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0)),
  };
}

function isValidQuality(value) {
  let rest = value;
  while (rest) {
    const word = QUALITY_WORDS.find((candidate) => rest.startsWith(candidate));
    if (word) {
      rest = rest.slice(word.length);
      continue;
    }
    if (/^[0-9+#b()°ø/\-]$/.test(rest[0])) {
      rest = rest.slice(1);
      continue;
    }
    return false;
  }
  return true;
}

export function parseChord(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const leading = value.match(/^[|([]*/)?.[0] || "";
  const trailing = value.slice(leading.length).match(/[|)\],;:.!?]*$/)?.[0] || "";
  const coreEnd = trailing ? value.length - trailing.length : value.length;
  const core = value.slice(leading.length, coreEnd);
  const rootMatch = /^(DO|RE|MI|FA|SOL|LA|SI)([#b]?)(.*)$/.exec(core);
  if (!rootMatch) return null;

  const [, rootName, rootAccidental, remainder] = rootMatch;
  let quality = remainder;
  let bass = null;
  const bassMatch = /\/(DO|RE|MI|FA|SOL|LA|SI)([#b]?)$/.exec(remainder);
  if (bassMatch) {
    quality = remainder.slice(0, bassMatch.index);
    bass = parseNote(`${bassMatch[1]}${bassMatch[2]}`);
  }
  if (!isValidQuality(quality)) return null;

  return {
    original: value,
    leading,
    trailing,
    root: parseNote(`${rootName}${rootAccidental}`),
    quality,
    bass,
  };
}

function spellingPreference(keyContext, delta) {
  const key = parseNote(keyContext);
  if (!key) return delta < 0 ? "flat" : "sharp";
  const targetPitch = modulo(key.pitch + delta);
  if (targetPitch === 6) return delta < 0 ? "flat" : "sharp";

  const preferenceByTonic = {
    0: "neutral",
    1: "flat",
    2: "sharp",
    3: "flat",
    4: "sharp",
    5: "flat",
    7: "sharp",
    8: "flat",
    9: "sharp",
    10: "flat",
    11: "sharp",
  };
  const preference = preferenceByTonic[targetPitch] || "neutral";
  if (preference !== "neutral") return preference;
  if (key.accidental === "b") return "flat";
  if (key.accidental === "#") return "sharp";
  return delta < 0 ? "flat" : "sharp";
}

function formatPitch(pitch, preference) {
  return (preference === "flat" ? FLAT_NOTES : SHARP_NOTES)[modulo(pitch)];
}

export function transposeChord(chord, delta, keyContext) {
  if (!chord) return "";
  if (delta === 0) return chord.original;
  const preference = spellingPreference(keyContext, delta);
  const root = formatPitch(chord.root.pitch + delta, preference);
  const bass = chord.bass ? `/${formatPitch(chord.bass.pitch + delta, preference)}` : "";
  return `${chord.leading}${root}${chord.quality}${bass}${chord.trailing}`;
}

function expandTabs(value, size = 4) {
  let column = 0;
  let result = "";
  for (const character of value) {
    if (character === "\t") {
      const spaces = size - (column % size);
      result += " ".repeat(spaces);
      column += spaces;
    } else {
      result += character;
      column += 1;
    }
  }
  return result.replace(/\s+$/u, "");
}

function parseChordLine(line) {
  const tokens = [...line.matchAll(/\S+/g)].map((match) => ({
    chord: parseChord(match[0]),
    start: match.index,
    source: match[0],
  }));
  if (!tokens.length || tokens.some(({ chord }) => !chord)) return null;
  return tokens;
}

function pairSegments(tokens, lyric) {
  const segments = [];
  const firstStart = tokens[0]?.start || 0;
  if (firstStart > 0) {
    segments.push({ chord: null, text: lyric.slice(0, firstStart), width: firstStart });
  }

  tokens.forEach((token, index) => {
    const nextStart = tokens[index + 1]?.start ?? Math.max(lyric.length, token.start + token.source.length);
    const text = token.start < lyric.length ? lyric.slice(token.start, Math.max(token.start, nextStart)) : "";
    segments.push({
      chord: token.chord,
      text,
      width: Math.max(token.source.length, text.length, 1),
    });
  });
  return segments;
}


export function parseMusicText(value, key = null) {
  const lines = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => expandTabs(line));
  const rows = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      rows.push({ kind: "blank" });
      index += 1;
      continue;
    }

    const chordTokens = parseChordLine(line);
    if (chordTokens) {
      const nextLine = lines[index + 1];
      const nextIsLyric = nextLine !== undefined && nextLine.trim() && !parseChordLine(nextLine);
      if (nextIsLyric) {
        rows.push({
          kind: "pair",
          chordLine: line,
          lyric: nextLine,
          segments: pairSegments(chordTokens, nextLine),
        });
        index += 2;
        continue;
      }
      rows.push({ kind: "chords", text: line, tokens: chordTokens });
      index += 1;
      continue;
    }

    const kind = /\s{3,}/.test(line) || /[@{}<>]/.test(line) ? "raw" : "text";
    rows.push({ kind, text: line });
    index += 1;
  }

  return { key, rows };
}

function transposeRow(row, delta, keyContext) {
  if (row.kind === "pair") {
    return {
      ...row,
      segments: row.segments.map((segment) => ({
        ...segment,
        chord: segment.chord ? {
          ...segment.chord,
          display: transposeChord(segment.chord, delta, keyContext),
        } : null,
      })),
    };
  }
  if (row.kind === "chords") {
    return {
      ...row,
      tokens: row.tokens.map((token) => ({
        ...token,
        chord: {
          ...token.chord,
          display: transposeChord(token.chord, delta, keyContext),
        },
      })),
    };
  }
  return { ...row };
}

export function transposeMusicBlock(block, delta) {
  return {
    ...block,
    sections: block.sections.map((section) => {
      const parsedKey = parseNote(section.key);
      return {
        ...section,
        transposedKey: parsedKey && delta !== 0
          ? formatPitch(parsedKey.pitch + delta, spellingPreference(section.key, delta))
          : section.key,
        rows: section.rows.map((row) => transposeRow(row, delta, section.key)),
      };
    }),
  };
}

export function transposeSong(song, delta) {
  return {
    ...song,
    transpose: delta,
    musicBlocks: song.musicBlocks.map((block) => transposeMusicBlock(block, delta)),
  };
}

function safeExternalHref(href) {
  try {
    const url = new URL(href, SOURCE_ORIGIN);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function toLocalPath(href) {
  try {
    const url = new URL(href, SOURCE_ORIGIN);
    if (url.origin !== SOURCE_ORIGIN) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function extractMusicBlock(pre, id) {
  const sectionNodes = [...pre.querySelectorAll(".chiave")];
  const sections = sectionNodes.length
    ? sectionNodes.map((node) => parseMusicText(node.textContent, node.getAttribute("name") || null))
    : [parseMusicText(pre.textContent, pre.getAttribute("name") || null)];
  return { id, sections };
}

export function parseSongPage(html, sourcePath = "/") {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const unwanted = [
    "script", "style", "noscript", "ins", "form", "footer", "header", "nav", "button",
    "img", "picture", "figure", "svg", "video", "audio", "canvas", "iframe", "source",
    ".adv", ".tfp-adv", ".ezoic-adpicker-ad", ".promo", ".comments-area",
    "#tools", "#tools-responsive", "#autoscroll-responsive", ".second-row",
    "[id*='cookie' i]", "[id*='consent' i]", "[id*='popup' i]", "[id*='modal' i]",
  ];
  doc.querySelectorAll(unwanted.join(",")).forEach((node) => node.remove());

  const songTitle = doc.querySelector("#post-title")?.textContent?.trim();
  const artist = doc.querySelector("#category-name")?.textContent?.trim() || "";
  const content = doc.querySelector("#content .post-content")
    || doc.querySelector("#content")
    || doc.querySelector("article, main, .site-content, .content")
    || doc.body;

  content.querySelectorAll("aside, .sidebar, [role='dialog']").forEach((node) => node.remove());
  content.querySelectorAll("h1, h2, h3, h4").forEach((heading) => {
    if (/lascia un commento|commenti|video|galleria|fotografie/i.test(heading.textContent || "")) heading.remove();
  });
  content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (attribute.name.startsWith("on") || attribute.name === "style" || attribute.name === "srcset") {
        node.removeAttribute(attribute.name);
      }
    });
  });
  content.querySelectorAll("a[href]").forEach((link) => {
    const rawHref = link.getAttribute("href");
    const localPath = toLocalPath(rawHref);
    if (localPath) {
      link.setAttribute("href", localPath);
      link.dataset.local = "true";
      return;
    }
    const externalHref = safeExternalHref(rawHref);
    if (externalHref) {
      link.setAttribute("href", externalHref);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    } else {
      link.removeAttribute("href");
    }
  });
  content.querySelectorAll("a[href*='chitarrafacile.com']").forEach((link) => link.remove());
  content.querySelectorAll("a[href*='youtube.com'], a[href*='youtu.be'], a[href$='.jpg' i], a[href$='.jpeg' i], a[href$='.png' i], a[href$='.webp' i], a[href$='.gif' i]").forEach((link) => link.remove());
  content.querySelectorAll("a:empty").forEach((link) => link.remove());

  const musicBlocks = [];
  content.querySelectorAll("pre").forEach((pre, index) => {
    musicBlocks.push(extractMusicBlock(pre, index));
    pre.replaceWith(doc.createComment(`MUSIC_BLOCK_${index}`));
  });

  const parts = content.innerHTML.split(/<!--MUSIC_BLOCK_(\d+)-->/);
  const contentBlocks = parts.map((part, index) => index % 2 === 0
    ? { type: "html", html: part }
    : { type: "music", musicIndex: Number(part) })
    .filter((block) => block.type === "music" || block.html.trim());

  let sourceUrl;
  try {
    sourceUrl = new URL(sourcePath, SOURCE_ORIGIN).href;
  } catch {
    sourceUrl = SOURCE_ORIGIN;
  }

  return {
    title: songTitle || content.querySelector("h1")?.textContent?.trim() || doc.title || "Accordi e Spartiti",
    artist,
    sourceUrl,
    sourcePath,
    contentBlocks,
    musicBlocks,
  };
}
