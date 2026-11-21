import { expect, test } from "@playwright/test";
import { generateQuestion } from "../../src/math/generators";
import { statisticsSkillIds } from "../../src/data/skills";
import { createDefaultProgress } from "../../src/state/storage";
import type { LocalProgressV1 } from "../../src/types";

test("copying two worked answers keeps the guided statistics queue on counting", async ({ page }) => {
  await page.goto("/statistics-probability/");
  for (let index = 0; index < 2; index++) {
    await expect(page.getByRole("heading", { name: "Permutations & combinations" })).toBeVisible();
    const seed = parseInt((await page.locator(".problem-code").innerText()).split(" ")[1], 36);
    const answer = generateQuestion("counting", seed, "easy").answer.latex;
    await page.getByRole("button", { name: "Show worked solution" }).click();
    await expect(page.getByRole("heading", { name: "Worked solution" })).toBeVisible();
    await page.locator(".math-answer-field").focus();
    await page.keyboard.type(answer);
    await page.getByRole("button", { name: "Check answer" }).click();
    await page.getByRole("button", { name: "Load the next question" }).click();
    await expect(page.locator(".problem-code")).not.toHaveText(`Problem ${seed.toString(36).toUpperCase()}`);
  }
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!) as LocalProgressV1);
  expect(saved).toMatchObject({ mastery: { counting: 0.35 }, totalPoints: 0, currentStreak: 0 });
  await expect(page.getByRole("heading", { name: "Permutations & combinations" })).toBeVisible();
});

test("skipping blank or drafted statistics answers preserves readiness and counts only checks", async ({ page }) => {
  await page.goto("/statistics-probability/?topic=counting");
  const field = page.locator(".math-answer-field");
  for (const draft of ["", "9999999"]) {
    const problem = await page.locator(".problem-code").innerText();
    if (draft) {
      await field.focus();
      await page.keyboard.type(draft);
    }
    await page.getByRole("button", { name: "Skip this question" }).click();
    await expect(page.locator(".problem-code")).not.toHaveText(problem, { useInnerText: true });
  }
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No answers recorded yet." })).toBeVisible();

  await page.goto("/statistics-probability/?topic=counting");
  await field.focus();
  await page.keyboard.type("9999999");
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Check your answer.")).toBeVisible();
  await page.getByRole("button", { name: "Skip this question" }).click();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByLabel("Practice summary").locator(".summary-value")).toHaveText(["1", "0", "1"]);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!) as LocalProgressV1);
  expect(saved.mastery.counting).toBeCloseTo(0.28);
  expect(saved.recentPresentations).toHaveLength(5);
  expect(saved.rewardQuestion?.status).toBe("skipped");
});

test("guided review rotates through every mastered statistics topic when skipping", async ({ page }) => {
  const progress = createDefaultProgress();
  for (const id of statisticsSkillIds) progress.mastery[id] = 1;
  await page.addInitScript(record => localStorage.setItem("russelli.progress.v1", JSON.stringify(record)), progress);
  await page.goto("/statistics-probability/");
  const seen = new Set<string>();
  for (let index = 0; index < statisticsSkillIds.length; index++) {
    const problem = await page.locator(".problem-code").innerText();
    seen.add(await page.locator(".practice-context h1").innerText());
    await page.getByRole("button", { name: "Skip this question" }).click();
    await expect(page.locator(".problem-code")).not.toHaveText(problem, { useInnerText: true });
  }
  expect(seen.size).toBe(statisticsSkillIds.length);
});

test("preserves algebra draft history while counting only submitted checks", async ({ page }) => {
  await page.goto("/practice/");
  await page.locator(".math-answer-field").focus();
  await page.keyboard.type("1234");
  await page.getByRole("button", { name: "Skip this question" }).click();
  await expect(page.locator(".math-answer-field")).toHaveJSProperty("value", "");
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByLabel("Practice summary").locator(".summary-value")).toHaveText(["0", "0", "0"]);
  await expect(page.locator(".recent-results math-field")).toHaveJSProperty("value", "1234");
});
