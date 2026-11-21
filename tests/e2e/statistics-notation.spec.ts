import { expect, test } from "@playwright/test";
import type { MathfieldElement } from "mathlive";

test("renders the observed z label as one subscript in the question and its worked solution", async ({ page }) => {
  await page.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, "getRandomValues", {
      configurable: true,
      value: (array: Uint32Array<ArrayBuffer>) => {
        if (array instanceof Uint32Array && array.length === 1) {
          array[0] = 0;
          return array;
        }
        return original(array);
      }
    });
  });
  await page.goto("/statistics-probability/?topic=hypothesis_testing");
  await expect(page.getByRole("heading", { name: "Hypothesis testing", exact: true })).toBeVisible();
  await expect(page.locator(".problem-code")).toHaveText("Problem 2");
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Worked solution", exact: true })).toBeVisible();

  const fields = page.locator("math-field.problem-equation, .worked-solution math-field");
  await expect.poll(() => fields.evaluateAll((nodes) => nodes.length > 1 &&
    nodes.every((node) => Boolean(node.shadowRoot?.querySelector(".ML__latex")?.textContent)))).toBe(true);

  const rendered = await fields.evaluateAll((nodes) => nodes.map((node) => {
    const field = node as MathfieldElement;
    const display = field.shadowRoot!.querySelector(".ML__latex")!;
    const mathml = new DOMParser().parseFromString(`<math>${field.getValue("math-ml")}</math>`, "text/html");
    const observedSubscript = [...mathml.querySelectorAll("msub")].some((sub) => {
      const [base, label] = sub.children;
      return base?.textContent === "z" && ["mi", "mtext"].includes(label?.localName) && label.textContent === "obs";
    });
    return {
      observedSubscript,
      visibleText: display.textContent.replace(/[\s\u200b]/g, "").replaceAll("−", "-"),
      visibleError: Boolean(display.querySelector(".ML__error, .ML__placeholder")),
      markupError: Boolean(mathml.querySelector("merror")),
      errors: field.errors.map((error) => error.code)
    };
  }));

  for (const math of rendered) {
    expect(math.visibleText).not.toMatch(/\\[a-zA-Z]+|�/);
    expect(math.visibleError).toBe(false);
    expect(math.markupError, math.visibleText).toBe(false);
    expect(math.errors, math.visibleText).toEqual([]);
  }
  expect(rendered[0].observedSubscript).toBe(true);
  const statistic = rendered[0].visibleText.match(/zobs=(-?\d+(?:\.\d+)?)/)?.[1];
  expect(statistic).toBeDefined();
  await expect(fields.first()).toHaveAttribute("aria-label", new RegExp(`Observed z statistic ${statistic?.replace(".", "\\.")}\\b`, "i"));
  expect(rendered.slice(1).some((step) => step.observedSubscript && step.visibleText.includes(`zobs=${statistic}`))).toBe(true);
});
