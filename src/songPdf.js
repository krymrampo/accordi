import fontkit from "@pdf-lib/fontkit";
import notoSansRegularUrl from "@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff?url";
import notoSansBoldUrl from "@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff?url";
import notoMonoRegularUrl from "@fontsource/noto-sans-mono/files/noto-sans-mono-latin-400-normal.woff?url";
import notoMonoBoldUrl from "@fontsource/noto-sans-mono/files/noto-sans-mono-latin-700-normal.woff?url";
import { PDFDocument, rgb } from "pdf-lib";
import { buildPdfFileName, layoutSongForPdf } from "./pdfLayout.js";

const FONT_URLS = [notoSansRegularUrl, notoSansBoldUrl, notoMonoRegularUrl, notoMonoBoldUrl];
let fontBytesPromise;

function loadFontBytes() {
  if (!fontBytesPromise) {
    fontBytesPromise = Promise.all(FONT_URLS.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Impossibile caricare i caratteri del PDF");
      return response.arrayBuffer();
    })).catch((error) => {
      fontBytesPromise = null;
      throw error;
    });
  }
  return fontBytesPromise;
}

function fitText(value, font, size, maxWidth) {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let result = value;
  while (result && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function drawHeader(page, layout, fonts) {
  const { width, height } = layout.pageSize;
  const contentWidth = width - layout.margins.left - layout.margins.right;
  const title = fitText(layout.meta.title || "Accordi", fonts.sansBold, 20, contentWidth);
  page.drawText(title, {
    x: layout.margins.left,
    y: height - layout.margins.top - 20,
    size: 20,
    font: fonts.sansBold,
    color: rgb(0.04, 0.04, 0.04),
  });
  if (layout.meta.artist) {
    page.drawText(fitText(layout.meta.artist, fonts.sans, 10.5, contentWidth), {
      x: layout.margins.left,
      y: height - layout.margins.top - 38,
      size: 10.5,
      font: fonts.sans,
      color: rgb(0.3, 0.3, 0.28),
    });
  }
  const intervalUnit = Math.abs(layout.meta.transpose) === 1 ? "semitono" : "semitoni";
  page.drawText(`Trasposizione: ${layout.meta.transposeLabel} ${intervalUnit}`, {
    x: layout.margins.left,
    y: height - layout.margins.top - 54,
    size: 8.5,
    font: fonts.sans,
    color: rgb(0.38, 0.38, 0.35),
  });
  page.drawLine({
    start: { x: layout.margins.left, y: height - layout.margins.top - 61 },
    end: { x: width - layout.margins.right, y: height - layout.margins.top - 61 },
    thickness: 0.8,
    color: rgb(0.1, 0.1, 0.1),
  });
}

function drawRow(page, row, layout, fonts, characterWidth) {
  const xStart = layout.margins.left;
  if (row.kind === "pair") {
    let x = xStart;
    row.segments.forEach((segment) => {
      if (segment.chord) {
        page.drawText(segment.chord, { x, y: row.y + 12, size: 9, font: fonts.monoBold, color: rgb(0.02, 0.02, 0.02) });
      }
      if (segment.text) {
        page.drawText(segment.text, { x, y: row.y + 1, size: 9, font: fonts.mono, color: rgb(0.14, 0.14, 0.13) });
      }
      x += segment.width * characterWidth;
    });
    return;
  }
  if (row.kind === "chords") {
    page.drawText(row.chords.join("  "), { x: xStart, y: row.y + 2, size: 9, font: fonts.monoBold, color: rgb(0.02, 0.02, 0.02) });
    return;
  }
  if (row.kind === "text" || row.kind === "raw") {
    page.drawText(row.text, { x: xStart, y: row.y + 2, size: 9, font: fonts.mono, color: rgb(0.14, 0.14, 0.13) });
  }
}

function drawFooter(page, layout, pageNumber, pageCount, fonts) {
  const y = layout.margins.bottom - 17;
  page.drawLine({
    start: { x: layout.margins.left, y: y + 10 },
    end: { x: layout.pageSize.width - layout.margins.right, y: y + 10 },
    thickness: 0.5,
    color: rgb(0.72, 0.72, 0.7),
  });
  page.drawText("Fonte: www.accordiespartiti.it", {
    x: layout.margins.left,
    y,
    size: 7.5,
    font: fonts.sans,
    color: rgb(0.42, 0.42, 0.4),
  });
  const pageLabel = `${pageNumber} / ${pageCount}`;
  page.drawText(pageLabel, {
    x: layout.pageSize.width - layout.margins.right - fonts.sans.widthOfTextAtSize(pageLabel, 7.5),
    y,
    size: 7.5,
    font: fonts.sans,
    color: rgb(0.42, 0.42, 0.4),
  });
}

export async function createSongPdfBytes(song, transpose) {
  const [sansBytes, sansBoldBytes, monoBytes, monoBoldBytes] = await loadFontBytes();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [sans, sansBold, mono, monoBold] = await Promise.all([
    pdf.embedFont(sansBytes, { subset: true }),
    pdf.embedFont(sansBoldBytes, { subset: true }),
    pdf.embedFont(monoBytes, { subset: true }),
    pdf.embedFont(monoBoldBytes, { subset: true }),
  ]);
  const fonts = { sans, sansBold, mono, monoBold };
  const characterWidth = mono.widthOfTextAtSize("M", 9);
  const contentWidth = 595.28 - 44 - 44;
  const layout = layoutSongForPdf(song, transpose, { maxColumns: Math.floor(contentWidth / characterWidth) });

  pdf.setTitle(song.title || "Accordi");
  pdf.setAuthor(song.artist || "Accordi dal Krym");
  pdf.setSubject(`Testo e accordi - trasposizione ${layout.meta.transposeLabel} - ${song.sourceUrl || ""}`);
  pdf.setCreator("Accordi dal Krym");
  pdf.setProducer("Accordi dal Krym");

  layout.pages.forEach((rows, pageIndex) => {
    const page = pdf.addPage([layout.pageSize.width, layout.pageSize.height]);
    drawHeader(page, layout, fonts);
    rows.forEach((row) => drawRow(page, row, layout, fonts, characterWidth));
    drawFooter(page, layout, pageIndex + 1, layout.pages.length, fonts);
  });

  return pdf.save();
}

export async function createSongPdfFile(song, transpose) {
  const bytes = await createSongPdfBytes(song, transpose);
  return new File([bytes], buildPdfFileName(song, transpose), { type: "application/pdf" });
}

export function canSharePdf(file) {
  return typeof navigator.share === "function"
    && typeof navigator.canShare === "function"
    && navigator.canShare({ files: [file] });
}

export async function sharePdf(file, song) {
  await navigator.share({
    files: [file],
    title: song.title || "Accordi",
    text: song.artist ? `${song.title} - ${song.artist}` : song.title,
  });
}

export function downloadPdf(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
