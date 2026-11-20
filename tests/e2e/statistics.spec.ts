import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { generateQuestion } from "../../src/math/generators";
import { createDefaultProgress } from "../../src/state/storage";

test("saves a distribution retry, rewards it once, and resumes the chosen topic", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Practice statistics & probability" }).click();
  await expect(page.getByRole("heading", { name: "Permutations & combinations" })).toBeVisible();
  await page.getByLabel("Practice focus").selectOption("one_sample_laws");
  const family = page.getByLabel("Distribution family");
  const check = page.getByRole("button", { name: "Check answer" });
  await expect(family).toHaveValue("");
  await expect(check).toBeDisabled();
  const seed = parseInt((await page.locator(".problem-code").innerText()).split(" ")[1], 36);
  const law = generateQuestion("one_sample_laws", seed, "easy").answer.distribution!;
  await family.selectOption(law.family === "t" ? "chi_square" : "t");
  const field = page.locator('math-field[aria-label="Degrees of freedom"]');
  await field.focus();
  await page.keyboard.type(law.parameters[0]);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Check your answer.")).toBeVisible();
  await page.getByRole("button", { name: "Reveal the next hint" }).click();
  await expect(page.locator(".hint-list li")).toHaveCount(1);

  await family.selectOption(law.family);
  await expect(check).toBeDisabled();
  await field.focus();
  await page.keyboard.type(law.parameters[0]);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Answer accepted.")).toBeVisible();
  await expect(page.getByText("+10 points.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Show worked solution" }).click();
  await expect(page.getByRole("heading", { name: "Worked solution" })).toBeVisible();
  await page.getByRole("button", { name: "Load the next question" }).click();
  await expect(family).toHaveValue("");

  await page.getByRole("link", { name: "Progress", exact: true }).click();
  const topic = page.locator(".mastery-row").filter({ has: page.getByRole("heading", { name: "One-sample sampling laws" }) });
  await expect(topic.getByRole("meter")).toBeVisible();
  await expect(topic.getByRole("link")).toHaveAttribute("href", /statistics-probability\/\?topic=one_sample_laws$/);
  await expect(page.locator(".recent-results .result-accepted")).toHaveCount(1);
  await page.getByRole("link", { name: "Statistics & probability", exact: true }).click();
  await expect(page.getByLabel("Practice focus")).toHaveValue("one_sample_laws");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!));
  expect(stored).toMatchObject({ totalPoints: 10, calibrationIndex: 0, preferredStatisticsSkill: "one_sample_laws" });
});

test("keeps a two-parameter answer accessible at narrow widths and enlarged text", async ({ page }) => {
  await page.goto("/statistics-probability/?topic=two_sample_laws");
  const family = page.getByLabel("Distribution family");
  await family.selectOption("f");
  await family.focus();
  await page.keyboard.press("Tab");
  const numerator = page.locator('math-field[aria-label="Numerator degrees of freedom"]');
  await expect(numerator).toBeFocused();
  await page.keyboard.type("7");
  await expect(page.getByRole("button", { name: "Check answer" })).toBeDisabled();
  const denominator = page.locator('math-field[aria-label="Denominator degrees of freedom"]');
  await denominator.focus();
  await page.keyboard.type("9");
  await expect(page.getByRole("button", { name: "Check answer" })).toBeEnabled();
  await denominator.blur();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  for (const control of [family, numerator, denominator]) {
    const bounds = await control.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(321);
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
});

test("grades a counting answer exactly when entered as a decimal", async ({ page }) => {
  await page.goto("/statistics-probability/?topic=counting");
  const seed = parseInt((await page.locator(".problem-code").innerText()).split(" ")[1], 36);
  const expected = Number(generateQuestion("counting", seed, "easy").answer.latex);
  const field = page.locator("math-field.math-answer-field");
  for (const value of [`${expected - 1}.999999999999`, `${expected}.000000000001`, `${expected}.0`]) {
    await field.evaluate((element, latex) => {
      (element as HTMLElement & { value: string }).value = latex;
      element.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }, value);
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.locator(".feedback strong")).toHaveText(value.endsWith(".0") ? "Answer accepted." : "Check your answer.");
  }
});

test("recovers a saved algebra record and ignores a topic from a different subject", async ({ page }) => {
  const initial = { ...createDefaultProgress(), calibrationIndex: 3, totalPoints: 30, preferredLinearSkill: "matrices" };
  await page.goto("/");
  await page.evaluate((old) => {
    const { preferredStatisticsSkill, ...record } = old;
    delete (record.mastery as Partial<typeof record.mastery>).counting;
    localStorage.setItem("russelli.progress.v1", JSON.stringify(record));
  }, initial);
  await page.goto("/statistics-probability/?topic=functions");
  await expect(page.getByRole("heading", { name: "Permutations & combinations" })).toBeVisible();
  await page.getByRole("link", { name: "Algebra", exact: true }).click();
  await expect(page.getByText("Calibration 4 of 8")).toBeVisible();
  await page.getByRole("link", { name: "Linear algebra", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Matrix arithmetic" })).toBeVisible();
  await expect(page.getByLabel("Practice rewards").getByText("30", { exact: true })).toBeVisible();
});
