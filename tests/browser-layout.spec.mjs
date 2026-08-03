import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const fixture = await readFile(new URL("./fixtures/song-layout.html", import.meta.url), "utf8");
const songPath = "/accordi/italiani/baglioni-claudio/solo-2/";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/page?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ html: fixture }),
  }));
});

test("shows only the large search and locally saved songs on the home page", async ({ page }) => {
  const pageRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/page?")) pageRequests.push(request.url());
  });
  await page.addInitScript(() => {
    localStorage.setItem("accordi-clean:saved-pages", JSON.stringify([
      { path: "/accordi/italiani/baglioni-claudio/solo-2/", title: "Solo", artist: "Claudio Baglioni", transpose: 2, fontSize: 18, savedAt: 2 },
      { path: "/accordi/italiani/giorgia/girasole/", title: "Girasole", artist: "Giorgia", transpose: -1, fontSize: 15, savedAt: 1 },
    ]));
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Cerca un brano o un artista" })).toBeVisible();
  await expect(page.locator(".home-search input")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Brani salvati" })).toBeVisible();
  await expect(page.locator(".home-saved-list .saved-item-link")).toHaveCount(2);
  await expect(page.getByText("Claudio Baglioni")).toBeVisible();
  await expect(page.locator(".home-saved-list")).toContainText("Trasposizione +2");
  await expect(page.locator(".home-saved-list")).toContainText("Testo 113%");
  await expect(page.locator(".site-nav")).toHaveCount(0);
  await expect(page.locator(".side-panel")).toHaveCount(0);
  await expect(page.getByText("Videolezioni")).toHaveCount(0);
  expect(pageRequests).toHaveLength(0);
});

test("keeps only a compact search above the focused song reader", async ({ page }) => {
  await page.goto(songPath);

  await expect(page.locator("header .search")).toBeVisible();
  await expect(page.locator(".reader-panel")).toBeVisible();
  await expect(page.locator(".site-nav")).toHaveCount(0);
  await expect(page.locator(".side-panel")).toHaveCount(0);
});

test("replaces trailing source descriptions with the saved-song list", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("accordi-clean:saved-pages", JSON.stringify([
      { path: "/accordi/italiani/giorgia/girasole/", title: "Girasole", artist: "Giorgia", transpose: -2, fontSize: 19, savedAt: 1 },
    ]));
  });
  await page.goto(songPath);

  await expect(page.locator(".source-content #credits")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Brani salvati" })).toBeVisible();
  await expect(page.locator(".song-saved-list li")).toHaveCount(2);
  await expect(page.locator(".song-saved-list")).toContainText("Solo");
  await expect(page.locator(".song-saved-list")).toContainText("Girasole");
  await expect(page.locator(".song-saved-list")).toContainText("Trasposizione -2");
  await expect(page.locator(".song-saved-list")).toContainText("Testo 119%");
  await expect(page.locator(".song-saved-list")).not.toContainText("Giorgia");
});

for (const width of [320, 390, 760, 1280]) {
  test(`keeps chord rows aligned inside one horizontal scroller at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(songPath);
    await expect(page.locator(".chord-sheet")).toBeVisible();

    const layout = await page.evaluate(() => {
      const scroller = document.querySelector(".chord-sheet-scroll");
      const segments = [...document.querySelectorAll(".music-segment")];
      const alignedSegments = segments.every((segment) => {
        const chord = segment.querySelector(".music-chord").getBoundingClientRect();
        const lyric = segment.querySelector(".music-lyric").getBoundingClientRect();
        return Math.abs(chord.left - lyric.left) < 1;
      });
      const pairTracksStayOnOneLine = [...document.querySelectorAll(".music-pair-track")].every((track) => {
        const tops = [...track.children].map((child) => child.getBoundingClientRect().top);
        return getComputedStyle(track).flexWrap === "nowrap" && tops.every((top) => Math.abs(top - tops[0]) < 1);
      });
      const progressionsStayOnOneLine = [...document.querySelectorAll(".music-progression")]
        .every((row) => getComputedStyle(row).flexWrap === "nowrap");
      const adjacentPair = [...document.querySelectorAll(".music-pair-row")]
        .find((row) => row.nextElementSibling?.classList.contains("music-pair-row"));
      const nextPair = adjacentPair?.nextElementSibling;
      const fontSize = Number.parseFloat(getComputedStyle(document.querySelector(".chord-sheet-content")).fontSize);
      scroller.scrollLeft = 60;
      return {
        viewport: innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        alignedSegments,
        pairTracksStayOnOneLine,
        progressionsStayOnOneLine,
        sheetOverflows: scroller.scrollWidth > scroller.clientWidth,
        sheetCanScroll: scroller.scrollLeft > 0,
        sheetWidthRatio: scroller.clientWidth / innerWidth,
        sheetFontSize: fontSize,
        sheetBorderLeft: getComputedStyle(document.querySelector(".chord-sheet")).borderLeftWidth,
        sheetBackground: getComputedStyle(document.querySelector(".chord-sheet")).backgroundColor,
        verseGap: adjacentPair && nextPair
          ? nextPair.getBoundingClientRect().top - adjacentPair.getBoundingClientRect().bottom
          : 0,
        blankHeight: document.querySelector(".music-blank")?.getBoundingClientRect().height || 0,
        rowOwnsOverflow: [...document.querySelectorAll(".music-row")]
          .some((row) => ["auto", "scroll"].includes(getComputedStyle(row).overflowX)),
      };
    });

    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewport);
    expect(layout.alignedSegments).toBe(true);
    expect(layout.pairTracksStayOnOneLine).toBe(true);
    expect(layout.progressionsStayOnOneLine).toBe(true);
    expect(layout.rowOwnsOverflow).toBe(false);
    expect(layout.sheetBorderLeft).toBe("0px");
    expect(layout.sheetBackground).toBe("rgba(0, 0, 0, 0)");
    expect(layout.verseGap).toBeGreaterThanOrEqual(layout.sheetFontSize * .35);
    expect(layout.blankHeight).toBeGreaterThanOrEqual(layout.sheetFontSize * .85);
    if (width <= 760) {
      expect(layout.sheetOverflows).toBe(true);
      expect(layout.sheetCanScroll).toBe(true);
      expect(layout.sheetWidthRatio).toBeGreaterThan(.9);
      await expect(page.locator(".chord-scroll-hint")).toBeVisible();
    }
    expect(layout.sheetFontSize).toBe(width <= 390 ? 14 : 16);
  });
}

test("uses a compact phone scale while keeping the same percentage controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(songPath);
  const content = page.locator(".chord-sheet-content");
  await expect(page.locator(".font-size-value")).toHaveText("100%");
  await expect(content).toHaveCSS("font-size", "14px");

  for (let step = 0; step < 6; step += 1) await page.getByRole("button", { name: "Aumenta dimensione testo" }).click();
  await expect(page.locator(".font-size-value")).toHaveText("138%");
  await expect(content).toHaveCSS("font-size", "20px");
});

test("resizes chord text within bounds and persists it only for the current song", async ({ page }) => {
  await page.goto(songPath);
  const content = page.locator(".chord-sheet-content");
  const value = page.locator(".font-size-value");

  await expect(value).toHaveText("100%");
  await expect(content).toHaveCSS("font-size", "16px");

  for (let step = 0; step < 4; step += 1) await page.getByRole("button", { name: "Riduci dimensione testo" }).click();
  await expect(value).toHaveText("75%");
  await expect(content).toHaveCSS("font-size", "12px");
  await expect(page.getByRole("button", { name: "Riduci dimensione testo" })).toBeDisabled();

  for (let step = 0; step < 10; step += 1) await page.getByRole("button", { name: "Aumenta dimensione testo" }).click();
  await expect(value).toHaveText("138%");
  await expect(content).toHaveCSS("font-size", "22px");
  await expect(page.getByRole("button", { name: "Aumenta dimensione testo" })).toBeDisabled();
  await page.getByRole("button", { name: "Alza di un semitono" }).click();
  const enlargedLayout = await page.evaluate(() => ({
    bodyFits: document.body.scrollWidth <= innerWidth,
    segmentsAlign: [...document.querySelectorAll(".music-segment")].every((segment) => {
      const chord = segment.querySelector(".music-chord").getBoundingClientRect();
      const lyric = segment.querySelector(".music-lyric").getBoundingClientRect();
      return Math.abs(chord.left - lyric.left) < 1;
    }),
    pairTracksStayOnOneLine: [...document.querySelectorAll(".music-pair-track")]
      .every((track) => getComputedStyle(track).flexWrap === "nowrap"),
  }));
  expect(enlargedLayout).toEqual({ bodyFits: true, segmentsAlign: true, pairTracksStayOnOneLine: true });

  await page.getByRole("button", { name: "Reimposta dimensione testo al 100%" }).click();
  await expect(value).toHaveText("100%");
  await page.getByRole("button", { name: "Riduci dimensione testo" }).click();
  await page.reload();
  await expect(page.locator(".font-size-value")).toHaveText("94%");
  await expect(page.locator(".chord-sheet-content")).toHaveCSS("font-size", "15px");
  await page.goto("/accordi/test/secondo-brano/");
  await expect(page.locator(".font-size-value")).toHaveText("100%");
  await expect(page.locator(".chord-sheet-content")).toHaveCSS("font-size", "16px");
  await page.goto(songPath);
  await expect(page.locator(".font-size-value")).toHaveText("94%");
  await expect(page.locator(".chord-sheet-content")).toHaveCSS("font-size", "15px");
});

test("transposes flats, slash basses and enforces the selected range", async ({ page }) => {
  await page.goto(songPath);
  const chords = page.locator(".music-chord:not(.is-empty)");
  await expect(chords.filter({ hasText: /^LAb$/ })).toHaveCount(2);
  await expect(chords.filter({ hasText: /^MIb$/ })).toHaveCount(1);

  await page.getByRole("button", { name: "Alza di un semitono" }).click();
  const transposed = await chords.allTextContents();
  expect(transposed).toContain("LA");
  expect(transposed).toContain("MI");
  expect(transposed).toContain("REb/LAb");

  await page.getByRole("button", { name: "Reimposta trasposizione", exact: true }).click();
  for (let step = 0; step < 6; step += 1) await page.getByRole("button", { name: "Abbassa di un semitono" }).click();
  await expect(page.locator(".transpose-value")).toHaveText("-6");
  await expect(page.getByRole("button", { name: "Abbassa di un semitono" })).toBeDisabled();
  await page.reload();
  await expect(page.locator(".transpose-value")).toHaveText("-6");
  await page.goto("/accordi/test/secondo-brano/");
  await expect(page.locator(".transpose-value")).toHaveText("0");
  await page.goto(songPath);
  await expect(page.locator(".transpose-value")).toHaveText("-6");
});

test("downloads valid PDFs at zero, positive and negative transpositions", async ({ page }) => {
  for (const scenario of [
    { delta: 0, filename: "claudio-baglioni-solo-trasposizione-0.pdf" },
    { delta: 1, filename: "claudio-baglioni-solo-trasposizione-+1.pdf" },
    { delta: -6, filename: "claudio-baglioni-solo-trasposizione--6.pdf" },
  ]) {
    await page.goto(songPath);
    const resetTranspose = page.getByRole("button", { name: "Reimposta trasposizione", exact: true });
    if (await resetTranspose.isEnabled()) await resetTranspose.click();
    const buttonName = scenario.delta < 0 ? "Abbassa di un semitono" : "Alza di un semitono";
    for (let step = 0; step < Math.abs(scenario.delta); step += 1) {
      await page.getByRole("button", { name: buttonName }).click();
    }
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(scenario.filename);
    const bytes = await readFile(await download.path());
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    await expect(page.locator(".pdf-status")).toContainText("Download");
  }
});
