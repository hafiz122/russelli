import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { getSkill, statisticsSkillIds } from "../../src/data/skills";
import { generateQuestion } from "../../src/math/generators";
import { formatPValue, readTestAnswer } from "../../src/math/testAnswers";
import { createDefaultProgress } from "../../src/state/storage";
import type { LocalProgressV1, SkillId } from "../../src/types";

const topics = ["hypothesis_testing", "one_sample_tests", "comparing_means", "proportion_tests",
  "variance_tests", "errors_power", "likelihood_ratio"] as const satisfies readonly SkillId[];

test("opens all seven inference topics directly from the statistics course index", async ({ page }) => {
  test.slow();
  await page.goto("/");
  for (const id of topics) {
    const title = getSkill(id).title;
    const link = page.getByRole("link", { name: title, exact: true });
    await expect(link).toHaveAttribute("href", `/statistics-probability/?topic=${id}`);
    await link.click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByLabel("Practice focus")).toHaveValue(id);
    await expect(page.locator("math-field.problem-equation")).toBeVisible();
    if (id === "errors_power" || id === "likelihood_ratio") {
      await expect(page.locator("math-field.math-answer-field")).toBeVisible();
      await expect(page.getByRole("radio")).toHaveCount(0);
    } else {
      await expect(page.locator('math-field[aria-label="p-value"]')).toBeVisible();
      await expect(page.getByRole("group", { name: "Decision", exact: true }).getByRole("radio")).toHaveCount(2);
    }
    await page.getByRole("link", { name: "russelli home" }).click();
  }
});

test("checks a p-value and decision together and awards the correct retry once", async ({ page }) => {
  await page.goto("/statistics-probability/?topic=one_sample_tests");
  const pValue = page.locator('math-field[aria-label="p-value"]');
  const check = page.getByRole("button", { name: "Check answer", exact: true });
  const reject = page.getByRole("radio", { name: "Reject H₀", exact: true });
  const retain = page.getByRole("radio", { name: "Fail to reject H₀", exact: true });
  await expect(reject).not.toBeChecked();
  await expect(retain).not.toBeChecked();
  await expect(check).toBeDisabled();

  const seed = parseInt((await page.locator(".problem-code").innerText()).split(" ")[1], 36);
  const question = generateQuestion("one_sample_tests", seed, "easy");
  const reference = question.answer.testResult!;
  const rejecting = reference.pValue <= reference.alpha;
  const rightChoice = rejecting ? reject : retain;
  const wrongChoice = rejecting ? retain : reject;
  const value = formatPValue(reference.pValue);
  await wrongChoice.focus();
  await page.keyboard.press("Space");
  await expect(wrongChoice).toBeChecked();
  await expect(check).toBeDisabled();
  await pValue.focus();
  await page.keyboard.type(value);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Check your answer.", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Decision", exact: true })).toBeEnabled();

  await rightChoice.focus();
  await page.keyboard.press("Space");
  await expect(check).toBeEnabled();
  await check.click();
  await expect(page.getByText("Answer accepted.", { exact: true })).toBeVisible();
  await expect(rightChoice).toBeDisabled();
  await expect(page.getByText("+10 points. 1 in a row.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show worked solution" }).click();
  await expect(page.getByRole("heading", { name: "Worked solution" })).toBeVisible();
  await page.getByRole("button", { name: "Load the next question" }).click();
  await expect(reject).not.toBeChecked();
  await expect(retain).not.toBeChecked();
  await expect(check).toBeDisabled();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.locator(".recent-results .result-accepted")).toHaveCount(1);
  await expect(page.locator(".mastery-row").filter({ has: page.getByRole("heading", { name: "Tests for one mean" }) }).getByRole("meter")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!) as LocalProgressV1);
  expect(saved).toMatchObject({ totalPoints: 10, currentStreak: 1, calibrationIndex: 0 });
  expect(saved.recentAttempts.map((attempt) => attempt.correct)).toEqual([false, true]);
  expect(readTestAnswer(saved.recentAttempts[1].rawLatex)?.decision).toBe(rejecting ? "reject" : "fail_to_reject");
});

test("keeps reference values and keyboard controls readable on a narrow, enlarged screen", async ({ page }) => {
  await page.goto("/statistics-probability/?topic=comparing_means");
  const table = page.getByRole("table", { name: /lower-tail probabilities/ });
  await expect(table.getByRole("columnheader")).toHaveCount(2);
  await expect(table.getByRole("rowheader")).toHaveCount(3);
  await expect(table.getByRole("cell")).toHaveCount(3);
  const reject = page.getByRole("radio", { name: "Reject H₀", exact: true });
  const retain = page.getByRole("radio", { name: "Fail to reject H₀", exact: true });
  await reject.focus();
  await page.keyboard.press("ArrowRight");
  await expect(retain).toBeFocused();
  await expect(retain).toBeChecked();
  await expect.poll(() => retain.evaluate((input) => parseFloat(getComputedStyle(input).outlineWidth))).toBeGreaterThan(0);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.evaluate(() => document.fonts.ready);
  const controls = page.locator(".test-answer math-field, .test-decision label, table caption, table th, table td");
  expect(await controls.evaluateAll((elements) => elements.every((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= -1 && bounds.right <= window.innerWidth + 1;
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("restores an eight-topic statistics record and continues its guided path", async ({ page }) => {
  const old = createDefaultProgress();
  old.calibrationIndex = 3;
  old.totalPoints = 90;
  old.preferredLinearSkill = "matrices";
  old.preferredStatisticsSkill = "discrete_variables";
  for (const id of statisticsSkillIds) old.mastery[id] = 0.76;
  for (const id of topics) delete (old.mastery as Partial<LocalProgressV1["mastery"]>)[id];
  await page.goto("/");
  await page.evaluate((record) => localStorage.setItem("russelli.progress.v1", JSON.stringify(record)), old);
  await page.getByRole("link", { name: "Statistics & probability", exact: true }).click();
  await expect(page.getByLabel("Practice focus")).toHaveValue("discrete_variables");
  await page.getByLabel("Practice focus").selectOption("adaptive");
  await expect(page.getByRole("heading", { name: "Hypothesis testing", exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!) as LocalProgressV1);
  expect(saved).toMatchObject({ calibrationIndex: 3, totalPoints: 90, preferredLinearSkill: "matrices", mastery: { discrete_variables: 0.76 } });
  for (const id of topics) expect(saved.mastery[id]).toBe(0.35);
});

test("wraps the interpretation and keeps wide worked equations keyboard-scrollable", async ({ page }) => {
  await page.goto("/statistics-probability/?topic=comparing_means");
  await page.getByRole("button", { name: "Show worked solution" }).click();
  const conclusion = page.locator(".worked-conclusion");
  await expect(conclusion).toBeVisible();
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await expect.poll(() => conclusion.evaluate(p => p.scrollWidth <= p.clientWidth + 1)).toBe(true);
    const wide = page.locator(".worked-solution .scrollable-math[tabindex='0']").first();
    await expect(wide).toBeVisible();
    await wide.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => wide.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    await expect.poll(() => wide.evaluate(node => {
      const field = node.querySelector("math-field")!;
      const content = field.shadowRoot!.querySelector("[part=content]")!;
      return content.scrollWidth <= content.clientWidth + 1 && node.scrollWidth > node.clientWidth;
    })).toBe(true);
  }
});
