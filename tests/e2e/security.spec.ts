import { expect, test } from "@playwright/test";

const craftedAnswers = [
  "\\htmlStyle{background-image:url(https://audit.invalid/pixel)}{1}",
  "\\style{background-image:url(https://audit.invalid/alternate)}{1}"
];

test("math answers cannot load third-party images", async ({ page }) => {
  let externalRequests = 0;
  await page.route("https://audit.invalid/**", (route) => {
    externalRequests += 1;
    return route.abort();
  });
  await page.addInitScript(() => {
    const auditWindow = window as Window & { blockedMathImages?: number };
    auditWindow.blockedMathImages = 0;
    document.addEventListener("securitypolicyviolation", (event) => {
      if (event.violatedDirective === "img-src" && event.blockedURI.startsWith("https://audit.invalid")) {
        auditWindow.blockedMathImages = (auditWindow.blockedMathImages ?? 0) + 1;
      }
    });
  });

  for (const path of ["/practice/", "/linear-algebra/"]) {
    await page.goto(path);
    const field = page.locator("math-field.math-answer-field");
    await expect(field).toBeVisible();
    for (const [index, answer] of craftedAnswers.entries()) {
      await field.evaluate((element, latex) => {
        const mathField = element as HTMLElement & { value: string };
        mathField.value = latex;
        mathField.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: latex }));
      }, answer);
      await expect.poll(() => page.evaluate(() => (window as Window & { blockedMathImages?: number }).blockedMathImages ?? 0))
        .toBeGreaterThan(index);
    }
  }

  await page.getByRole("button", { name: "Skip this question" }).click();
  await expect.poll(() => page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("russelli.progress.v1") ?? "null") as {
      recentAttempts?: Array<{ rawLatex: string }>;
    } | null;
    return saved?.recentAttempts?.at(-1)?.rawLatex.includes("audit.invalid") ?? false;
  })).toBe(true);
  await page.getByRole("link", { name: "Progress" }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { blockedMathImages?: number }).blockedMathImages ?? 0))
    .toBeGreaterThan(0);
  expect(externalRequests).toBe(0);
});
