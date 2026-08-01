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
      scroller.scrollLeft = 60;
      return {
        viewport: innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        alignedSegments,
        pairTracksStayOnOneLine,
        progressionsStayOnOneLine,
        sheetOverflows: scroller.scrollWidth > scroller.clientWidth,
        sheetCanScroll: scroller.scrollLeft > 0,
        rowOwnsOverflow: [...document.querySelectorAll(".music-row")]
          .some((row) => ["auto", "scroll"].includes(getComputedStyle(row).overflowX)),
      };
    });

    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewport);
    expect(layout.alignedSegments).toBe(true);
    expect(layout.pairTracksStayOnOneLine).toBe(true);
    expect(layout.progressionsStayOnOneLine).toBe(true);
    expect(layout.rowOwnsOverflow).toBe(false);
    if (width <= 760) {
      expect(layout.sheetOverflows).toBe(true);
      expect(layout.sheetCanScroll).toBe(true);
      await expect(page.locator(".chord-scroll-hint")).toBeVisible();
    }
  });
}

test("resizes chord text within bounds, resets it and persists the preference", async ({ page }) => {
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
});

test("downloads valid PDFs at zero, positive and negative transpositions", async ({ page }) => {
  for (const scenario of [
    { delta: 0, filename: "claudio-baglioni-solo-trasposizione-0.pdf" },
    { delta: 1, filename: "claudio-baglioni-solo-trasposizione-+1.pdf" },
    { delta: -6, filename: "claudio-baglioni-solo-trasposizione--6.pdf" },
  ]) {
    await page.goto(songPath);
    const buttonName = scenario.delta < 0 ? "Abbassa di un semitono" : "Alza di un semitono";
    for (let step = 0; step < Math.abs(scenario.delta); step += 1) {
      await page.getByRole("button", { name: buttonName }).click();
    }
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Scarica PDF" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(scenario.filename);
    const bytes = await readFile(await download.path());
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    await expect(page.locator(".pdf-status")).toContainText("Download");
  }
});
