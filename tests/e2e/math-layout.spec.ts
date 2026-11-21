import { expect, test, type Page } from "@playwright/test";
import { generateQuestion } from "../../src/math/generators";
import { createDefaultProgress } from "../../src/state/storage";
import { getSkill, tracks } from "../../src/data/skills";
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
    const host = field.parentElement!;
    const content = field.shadowRoot!.querySelector<HTMLElement>("[part=content]")!;
    const expression = field.shadowRoot!.querySelector<HTMLElement>(".ML__latex")!;
    const bounds = content.getBoundingClientRect();
    const math = expression.getBoundingClientRect();
    const region = host.getBoundingClientRect();
    const reachable = host.scrollWidth <= host.clientWidth + 1 ||
      (getComputedStyle(host).overflowX === "auto" && host.tabIndex === 0);
    return reachable && region.left >= -1 && region.right <= window.innerWidth + 1 &&
      math.left >= bounds.left - 1 && math.right <= bounds.right + 1 &&
      content.scrollWidth <= content.clientWidth + 1;
  }), { message: "every part of the expression should fit or be reachable in its keyboard-scrollable region" }).toBe(true);
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
  { skill: "eigen", seed: 3, difficulty: "hard" },
  { skill: "discrete_variables", seed: 2, difficulty: "hard" },
  { skill: "conditional_probability", seed: 3, difficulty: "hard" },
  { skill: "transformations", seed: 3, difficulty: "hard" },
  { skill: "sampling_distributions", seed: 3, difficulty: "hard" },
  { skill: "one_sample_laws", seed: 2, difficulty: "hard" },
  { skill: "two_sample_laws", seed: 2, difficulty: "hard" },
  { skill: "hypothesis_testing", seed: 2, difficulty: "hard" },
  { skill: "one_sample_tests", seed: 3, difficulty: "hard" },
  { skill: "comparing_means", seed: 2, difficulty: "hard" },
  { skill: "comparing_means", seed: 3, difficulty: "hard" },
  { skill: "proportion_tests", seed: 3, difficulty: "hard" },
  { skill: "variance_tests", seed: 3, difficulty: "hard" },
  { skill: "variance_tests", seed: 9725, difficulty: "hard" },
  { skill: "errors_power", seed: 2, difficulty: "hard" },
  { skill: "likelihood_ratio", seed: 3, difficulty: "hard" }
] satisfies { skill: SkillId; seed: number; difficulty: "easy" | "hard" }[]) {
  test(`fits ${scenario.skill} seed ${scenario.seed} inside the question box when resized`, async ({ page }) => {
    const progress = createDefaultProgress();
    progress.mastery[scenario.skill] = scenario.difficulty === "hard" ? 0.9 : 0.35;
    await selectSeed(page, scenario.seed);
    await page.addInitScript((initial) => {
      localStorage.setItem("russelli.progress.v1", JSON.stringify(initial));
    }, progress);
    await page.setViewportSize({ width: 320, height: 900 });
    const path = tracks[getSkill(scenario.skill).track].path;
    await page.goto(`${path}?topic=${scenario.skill}`);
    await expect(page.locator("math-field.problem-equation")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (scenario.skill === "discrete_variables") {
      await expect(page.locator("math-field.problem-equation")).toHaveAttribute("aria-label",
        /(?:X equals -?\d+ with probability \d+ over \d+\. ){3}Find the variance/);
    }
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
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll("body *")]
      .filter(element => !element.parentElement?.closest(".scrollable-math[tabindex='0']"))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 12).map((element) => `${element.tagName}.${element.className} ${Math.round(element.getBoundingClientRect().right)}`))
    ).toEqual([]);
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

for (const skill of ["continuous_variables", "comparing_means"] as const) {
  test(`enlarging statistics text enlarges the ${skill} prompt at 320px`, async ({ page }) => {
    const progress = createDefaultProgress();
    progress.mastery[skill] = 0.9;
    await selectSeed(page, 2);
    await page.addInitScript((record) => {
      localStorage.setItem("russelli.progress.v1", JSON.stringify(record));
    }, progress);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/statistics-probability/?topic=${skill}`);
    const field = page.locator("math-field.problem-equation");
    await expect(field).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const textSize = () => field.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const initial = await textSize();
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await expect.poll(textSize).toBeGreaterThanOrEqual(initial * 1.95);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

    if (skill === "comparing_means") {
      const table = field.locator("..");
      await expect(table).toHaveAttribute("tabindex", "0");
      await table.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => table.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
      await table.evaluate(el => { el.scrollLeft = el.scrollWidth; });
      expect(await table.evaluate(el => el.scrollWidth - el.clientWidth - el.scrollLeft)).toBeLessThanOrEqual(1);
    }
  });
}
