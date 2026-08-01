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
  test(`keeps chord layout contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(songPath);
    await expect(page.locator(".chord-sheet")).toBeVisible();

    const layout = await page.evaluate(() => {
      const collisions = [...document.querySelectorAll(".music-pair-row")].some((row) => {
        const chords = [...row.querySelectorAll(".music-chord:not(.is-empty)")].map((node) => node.getBoundingClientRect());
        return chords.some((box, index) => index > 0
          && Math.abs(box.top - chords[index - 1].top) < 2
          && box.left < chords[index - 1].right);
      });
      const raw = document.querySelector(".music-raw");
      return {
        viewport: innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        collisions,
        rawScrollsLocally: raw ? raw.scrollWidth > raw.clientWidth : false,
      };
    });

    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewport);
    expect(layout.collisions).toBe(false);
    if (width <= 390) expect(layout.rawScrollsLocally).toBe(true);
  });
}

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

  await page.getByRole("button", { name: "Reimposta" }).click();
  for (let step = 0; step < 6; step += 1) await page.getByRole("button", { name: "Abbassa di un semitono" }).click();
  await expect(page.locator(".music-toolbar strong")).toHaveText("-6");
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
