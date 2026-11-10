import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { generateQuestion } from "../../src/math/generators";

test("opens the guided track and checks a matrix final answer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Practice linear algebra" }).click();
  await expect(page.getByText("Work this out on paper, then enter your final answer.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vectors & dot products" })).toBeVisible();

  await page.locator("select").selectOption("matrices");
  await expect(page.getByRole("heading", { name: "Matrix arithmetic" })).toBeVisible();
  await expect(page.locator("math-field.problem-equation")).toHaveAttribute("aria-label", /row 1 column 1/i);
  const seed = parseInt((await page.locator(".problem-code").innerText()).split(" ")[1], 36);
  const expected = generateQuestion("matrices", seed, "easy").answer.latex;
  const insert = page.getByRole("button", { name: "Insert 2 × 2 matrix" });
  await insert.focus();
  await page.keyboard.press("Enter");
  const field = page.locator("math-field.math-answer-field");
  await expect.poll(() => field.evaluate((element) => (element as HTMLElement & { value: string }).value)).toContain("\\begin{bmatrix}");
  await page.keyboard.press("1");
  await expect.poll(() => field.evaluate((element) => (element as HTMLElement & { value: string }).value)).toMatch(/^\\begin\{bmatrix\}1\s*&/);
  await page.keyboard.press("Tab");
  await page.keyboard.press("2");
  await expect.poll(() => field.evaluate((element) => (element as HTMLElement & { value: string }).value)).toMatch(/^\\begin\{bmatrix\}1\s*&\s*2/);
  await field.evaluate((element, latex) => {
    const mathField = element as HTMLElement & { value: string };
    mathField.value = latex;
    mathField.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }, expected);
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByText("Answer accepted.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show worked solution" }).click();
  await expect(page.locator(".worked-solution math-field.static-math").first()).toHaveAttribute("aria-label", /Solution step 1 .*row 1 column 1/i);

  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Linear algebra", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Matrix arithmetic" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Algebra", exact: true })).toBeVisible();
  const untouched = page.locator(".mastery-row").filter({ has: page.getByRole("heading", { name: "Eigenvalues & eigenvectors" }) });
  await expect(untouched.getByText("No answer on record")).toBeVisible();
  await expect(untouched.getByRole("meter")).toHaveCount(0);
});

test("matrix entry works by touch and the layout fits narrow and zoomed screens", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/linear-algebra/?topic=matrices");
  await expect(page.locator("math-field.problem-equation")).toBeVisible();
  const button = page.getByRole("button", { name: "Insert 2 × 2 matrix" });
  if (testInfo.project.name === "mobile") await button.tap();
  else await button.click();
  await expect.poll(() => page.locator("math-field.math-answer-field").evaluate((element) =>
    (element as HTMLElement & { value: string }).value)).toContain("\\begin{bmatrix}");
  await page.goto("/linear-algebra/?topic=linear_systems");
  for (const width of [320, 360, 640, 752, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}px`).toBeLessThanOrEqual(width);
    const fits = await page.locator("math-field.problem-equation").evaluate((field) => {
      const content = field.shadowRoot!.querySelector<HTMLElement>("[part=content]")!;
      return content.scrollWidth <= content.clientWidth + 1;
    });
    expect(fits, `${width}px math`).toBe(true);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("home track index reflows without hiding content", async ({ page }) => {
  await page.goto("/");
  for (const width of [320, 360, 640, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}px`).toBeLessThanOrEqual(width);
    await expect(page.getByRole("link", { name: "Practice linear algebra" })).toBeVisible();
  }
  for (const width of [320, 752]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const clipped = await page.locator(".linear-track-intro li").evaluateAll((items) => items.some((item) =>
      item.getBoundingClientRect().right > document.documentElement.clientWidth + 1
    ));
    expect(clipped, `${width}px at 200% text`).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});
