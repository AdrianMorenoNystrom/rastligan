import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL!;
if (url !== "http://127.0.0.1:55431")
  throw new Error("E2E tillåter endast projektets isolerade lokala Supabase.");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const code = process.env.E2E_ADRIAN_CODE!;
async function capture(page: Page, options: Parameters<Page["screenshot"]>[0]) {
  await mkdir("artifacts/screenshots", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot(options);
}
test("publika vyer, filter, interaktiva diagram och responsiv layout", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ligatabellen" }),
  ).toBeVisible();
  const table = page.locator(".league-table");
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(table.getByRole("link", { name: "Adrian" })).toBeVisible();
  await expect(table.getByRole("link", { name: "Dave" })).toBeVisible();
  await expect(table.getByRole("link", { name: "Elias" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(info.project.use.viewport!.width);
  await mkdir("artifacts/screenshots", { recursive: true });
  await capture(page, {
    path: `artifacts/screenshots/ligan-${info.project.name}.png`,
    fullPage: true,
  });
  await table.getByRole("link", { name: "Adrian" }).click();
  await expect(
    page.getByRole("heading", { name: "Adrian", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "30 dagar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "30 dagar", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Eget intervall", exact: true })
    .click();
  await page.getByLabel("Från", { exact: true }).fill("2026-10-22");
  await page.getByLabel("Till", { exact: true }).fill("2026-10-26");
  await expect(
    page
      .locator(".metric")
      .filter({ hasText: /^Raster/ })
      .locator("strong"),
  ).toHaveText("5");
  await page
    .getByLabel("Spelarens utvecklingsmått", { exact: true })
    .selectOption("matchWinPercent");
  const playerChart = page.locator(".chart-card").first();
  await expect(playerChart).toContainText("Matchvinstprocent");
  await playerChart.locator("summary").click();
  await expect(playerChart.locator("tbody")).toContainText("matcher");
  await playerChart.locator("summary").click();
  await page
    .getByLabel("Spelarens utvecklingsmått", { exact: true })
    .selectOption("ppr");
  await capture(page, {
    path: `artifacts/screenshots/profil-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Översikt", exact: true }).click();
  const performance = page.locator(".chart-card").first();
  await expect(
    performance.getByRole("heading", { name: "Poäng per rast över tid" }),
  ).toBeVisible();
  await expect(performance.locator(".recharts-surface")).toBeVisible();
  const activity = page.locator(".chart-card").nth(1);
  await activity.locator("summary").click();
  const activityValues = () =>
    activity
      .locator("tbody td")
      .evaluateAll((cells) =>
        cells.reduce((sum, c) => sum + Number(c.textContent), 0),
      );
  expect(await activityValues()).toBe(7);
  await page
    .getByLabel("Aktivitetsmått", { exact: true })
    .selectOption("matches");
  await expect(
    activity.getByRole("heading", { name: "Matchaktivitet", exact: true }),
  ).toBeVisible();
  expect(await activityValues()).toBe(27);
  await page
    .getByLabel("Aktivitetsmått", { exact: true })
    .selectOption("breaks");
  await activity.locator("summary").click();
  await performance.getByRole("button", { name: "Dave", exact: true }).click();
  await expect(
    performance.getByRole("button", { name: "Dave", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await performance.getByRole("button", { name: "Dave", exact: true }).click();
  await performance.locator("summary").click();
  await expect(performance.getByRole("table")).toBeVisible();
  await performance.locator("summary").click();
  const chart = performance.locator(".recharts-surface");
  await chart.focus();
  await page.keyboard.press("ArrowRight");
  await expect(performance.locator(".chart-tooltip")).toBeVisible();
  await capture(page, {
    path: `artifacts/screenshots/statistik-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Dueller", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ligapoäng inom duellen" }),
  ).toBeVisible();
  await page.locator(".duel-selector a").last().click();
  await expect(page.locator(".duel-heading")).toContainText("Dave");
  await expect(page.locator(".duel-heading")).toContainText("Elias");
  await capture(page, {
    path: `artifacts/screenshots/duell-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Rekord", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Högst P/R per månad" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Största matchskillnad under en rast" }),
  ).toBeVisible();
  await capture(page, {
    path: `artifacts/screenshots/rekord-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/#/raster");
  await expect(
    page.getByRole("heading", { name: "Raster", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Spelarpar", exact: true })
    .selectOption("dave-elias");
  await expect(page.locator(".match-row")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /^Redigera / })).toHaveCount(0);
  await capture(page, {
    path: `artifacts/screenshots/matcher-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(info.project.use.viewport!.width);
  expect(errors).toEqual([]);
});
test("personlig kod, skapa, ändra, ta bort, bestående session och utloggning", async ({
  page,
}, info) => {
  const date = "2001-02-03";
  let id: string | undefined;
  const before = await admin.rpc("league_snapshot");
  const initialCount = before.data.count;
  try {
    await page.goto("/");
    await page
      .getByRole("link", { name: "Registrera rast", exact: true })
      .click();
    await expect(page.getByLabel("Personlig kod")).toBeVisible();
    await capture(page, {
      path: `artifacts/screenshots/login-${info.project.name}.png`,
      fullPage: true,
    });
    await page.getByLabel("Personlig kod").fill(code);
    await page.getByRole("button", { name: "Logga in", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Adrian mot Dave", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Adrian mot Dave", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Spara rast", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Öka Adrian" }).click();
    await page.getByLabel("Rastdatum", { exact: true }).fill(date);
    await capture(page, {
      path: `artifacts/screenshots/registrera-${info.project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Spara rast", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Rast sparad");
    const snapshot = await admin.rpc("league_snapshot");
    expect(snapshot.data.count).toBe(initialCount + 1);
    id = snapshot.data.matches.find(
      (m: { played_on: string }) => m.played_on === date,
    ).id;
    await page.goto("/#/");
    await expect(
      page
        .locator(".league-table tbody")
        .getByRole("row")
        .filter({ hasText: "Adrian" }),
    ).toContainText("7");
    await page.reload();
    await expect(page.locator(".editor-button")).toContainText("Adrian");
    await page.goto("/#/raster");
    await page.getByLabel("Från datum").fill(date);
    await page.getByLabel("Till datum").fill(date);
    await expect(page.locator(".match-row")).toHaveCount(1);
    await page
      .getByRole("button", { name: /Redigera Adrian mot Dave/ })
      .click();
    await page.getByLabel("Vunna matcher för Adrian").fill("2");
    await page.getByLabel("Vunna matcher för Dave").fill("2");
    await page.getByLabel("Rastdatum", { exact: true }).fill("2001-02-04");
    await page
      .getByRole("button", { name: "Spara ändringar", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByLabel("Till datum").fill("2001-02-04");
    await expect(page.locator(".match-score")).toContainText("2:2");
    const edited = (await admin.from("matches").select().eq("id", id).single())
      .data!;
    expect(edited.score1).toBe(2);
    expect(edited.score2).toBe(2);
    expect(edited.played_on).toBe("2001-02-04");
    await page.goto("/#/statistik/spelare/adrian");
    await expect(
      page.locator(".metric").filter({ hasText: "Ligapoäng" }).first(),
    ).toContainText("5");
    await page.goto("/#/raster");
    await page.getByLabel("Från datum").fill("2001-02-04");
    await page.getByLabel("Till datum").fill("2001-02-04");
    await page
      .getByRole("button", { name: /Redigera Adrian mot Dave/ })
      .click();
    await page
      .getByRole("button", { name: "Ta bort rast", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ja, ta bort", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await admin.rpc("league_snapshot")).data.count).toBe(initialCount);
    id = undefined;
    await page.locator(".editor-button").click();
    await page.getByRole("button", { name: "Logga ut", exact: true }).click();
    await expect(page.locator(".editor-button")).toContainText("Redigerarläge");
    await page.goto("/#/registrera");
    await expect(page.getByLabel("Personlig kod")).toBeVisible();
  } finally {
    if (id) await admin.from("matches").delete().eq("id", id);
  }
});
