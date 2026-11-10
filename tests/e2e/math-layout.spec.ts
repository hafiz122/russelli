import { expect, test, type Page } from "@playwright/test";
import { generateQuestion } from "../../src/math/generators";
import { createDefaultProgress } from "../../src/state/storage";
import type { SkillId } from "../../src/types";

async function selectSeed(page: Page, seed: number) {
  await page.addInitScript((desiredSeed) => {
    const original = crypto.getRandomValues.bind(crypto);
    let draw = 0;
    Object.defineProperty(crypto, "getRandomValues", {
      configurable: true,
      value: (array: Uint32Array<ArrayBuffer>) => {
        if (array instanceof Uint32Array && array.length === 1 && draw < 18) {
          array[0] = draw === 0 ? desiredSeed % 2 : draw <= 16 ? Math.floor((desiredSeed - 1) / 2) : 0;
          draw += 1;
          return array;
        }
        return original(array);
      }
    });
  }, seed);
}

async function expectExpressionFits(page: Page) {
  await expect.poll(() => page.locator("math-field.problem-equation").evaluate((field) => {
    const content = field.shadowRoot!.querySelector<HTMLElement>("[part=content]")!;
    const expression = field.shadowRoot!.querySelector<HTMLElement>(".ML__latex")!;
    const bounds = content.getBoundingClientRect();
    const math = expression.getBoundingClientRect();
    return math.left >= bounds.left - 1 && math.right <= bounds.right + 1 &&
      content.scrollWidth <= content.clientWidth + 1;
  }), { message: "the entire expression should be visible without horizontal scrolling" }).toBe(true);
}

for (const scenario of [
  { skill: "expressions", seed: 2, difficulty: "easy" },
  { skill: "polynomials", seed: 2, difficulty: "hard" },
  { skill: "functions", seed: 2, difficulty: "hard" },
  { skill: "functions", seed: 23594, difficulty: "easy" },
  { skill: "lines_systems", seed: 3, difficulty: "hard" },
  { skill: "lines_systems", seed: 2, difficulty: "hard" },
  { skill: "rational", seed: 2, difficulty: "hard" },
  { skill: "matrices", seed: 3, difficulty: "hard" },
  { skill: "linear_systems", seed: 2, difficulty: "hard" },
  { skill: "determinants_inverses", seed: 2, difficulty: "hard" },
  { skill: "eigen", seed: 3, difficulty: "hard" }
] satisfies { skill: SkillId; seed: number; difficulty: "easy" | "hard" }[]) {
  test(`fits ${scenario.skill} seed ${scenario.seed} inside the question box when resized`, async ({ page }) => {
    const progress = createDefaultProgress();
    progress.mastery[scenario.skill] = scenario.difficulty === "hard" ? 0.9 : 0.35;
    await selectSeed(page, scenario.seed);
    await page.addInitScript((initial) => {
      localStorage.setItem("russelli.progress.v1", JSON.stringify(initial));
    }, progress);
    await page.setViewportSize({ width: 320, height: 900 });
    const path = ["matrices", "linear_systems", "determinants_inverses", "eigen"].includes(scenario.skill)
      ? "/linear-algebra/" : "/practice/";
    await page.goto(`${path}?topic=${scenario.skill}`);
    await expect(page.locator("math-field.problem-equation")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (scenario.seed === 23594) {
      expect(generateQuestion("functions", scenario.seed, "easy").promptLatex).toBe(
        "f(x)=-6x-4,\\quad g(x)=x^2+2,\\quad (f\\circ g)(2)"
      );
    }

    for (const width of [320, 640, 768, 1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await expectExpressionFits(page);
    }

    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await expectExpressionFits(page);
    const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 12).map((element) => `${element.tagName}.${element.className} ${Math.round(element.getBoundingClientRect().right)}`));
    expect(overflow).toEqual([]);
  });
}

test("reflows a composition without changing the answer or leaving short questions undersized", async ({ page }) => {
  await selectSeed(page, 2);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/practice/?topic=functions");
  await expectExpressionFits(page);
  await expect.poll(() => page.locator("math-field.problem-equation").evaluate((field) =>
    field.shadowRoot!.querySelector(".ML__mtable") !== null
  )).toBe(true);

  const answer = generateQuestion("functions", 2, "easy").answer.latex;
  await page.locator("math-field.math-answer-field").evaluate((field, latex) => {
    (field as HTMLElement & { value: string }).value = latex;
    field.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }, answer);
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByText("Answer accepted.", { exact: true })).toBeVisible();

  await page.locator("select").selectOption("exponents_radicals");
  await expectExpressionFits(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(() => page.locator("math-field.problem-equation").evaluate((field) =>
    parseFloat(getComputedStyle(field).fontSize)
  )).toBeGreaterThan(50);
});
