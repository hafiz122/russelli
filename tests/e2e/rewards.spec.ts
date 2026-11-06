import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { generateQuestion } from "../../src/math/generators";
import { createDefaultProgress } from "../../src/state/storage";
import type { Difficulty, LocalProgressV1 } from "../../src/types";
import { skills, skillIds } from "../../src/data/skills";

async function startPractice(page: Page, overrides: Partial<LocalProgressV1> = {}, path = "/practice/?topic=expressions") {
  await page.goto("/");
  await page.evaluate((progress) => localStorage.setItem("russelli.progress.v1", JSON.stringify(progress)), {
    ...createDefaultProgress(), ...overrides
  });
  await page.goto(path);
  await expect(page.locator(".problem-code")).toBeVisible();
}

async function enterAnswer(page: Page, latex: string) {
  await page.locator("math-field.math-answer-field").evaluate((element, value) => {
    (element as HTMLElement & { value: string }).value = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }, latex);
}

async function enterCorrectAnswer(page: Page) {
  const code = (await page.locator(".problem-code").textContent())!;
  const seed = Number.parseInt(code!.replace("Problem ", ""), 36);
  const difficulty = await page.locator(".difficulty-label").textContent() as Difficulty;
  const title = await page.locator(".practice-context h1").textContent();
  const skill = skills.find((item) => item.title === title)!;
  await enterAnswer(page, generateQuestion(skill.id, seed, difficulty).answer.latex);
}

async function solve(page: Page, repeatSubmission = false) {
  await enterCorrectAnswer(page);
  if (repeatSubmission) {
    await page.locator("math-field.math-answer-field").evaluate((element) => {
      for (let index = 0; index < 2; index++) {
        element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      }
    });
  } else {
    await page.getByRole("button", { name: "Check answer", exact: true }).click();
  }
  await expect(page.getByText("Answer accepted.", { exact: true })).toBeVisible();
  await expect(page.locator(".feedback")).toHaveAttribute("aria-live", "polite");
}

async function expectRewards(page: Page, points: number, streak: number) {
  await expect(page.locator(".practice-rewards dd")).toHaveText([String(points), String(streak)]);
}

async function openOtherPractice(page: Page, delayStorageEvents = false, path = "/practice/?topic=expressions") {
  const other = await page.context().newPage();
  await other.addInitScript((delay) => {
    if (delay) window.addEventListener("storage", (event) => event.stopImmediatePropagation());
  }, delayStorageEvents);
  await other.goto(path);
  await expect(other.locator(".problem-code")).toBeVisible();
  return other;
}

async function loadNext(page: Page) {
  const previousCode = await page.locator(".problem-code").textContent();
  await page.getByRole("button", { name: "Load the next question" }).click();
  await expect.poll(() => page.locator(".problem-code").textContent()).not.toBe(previousCode);
}

test("shared calibration presentations cover all eight topics without skipping a slot", async ({ page }) => {
  await startPractice(page, {}, "/practice/");
  const other = await openOtherPractice(page, false, "/practice/");
  await solve(page);
  await solve(other);
  await expectRewards(page, 20, 2);
  await loadNext(page);
  await expect(page.locator(".practice-context .plain-kicker")).toHaveText("Calibration 2 of 8");
  for (const skillId of skillIds.slice(1)) {
    await expect(page.locator(".practice-context h1")).toHaveText(skills.find((skill) => skill.id === skillId)!.title);
    await solve(page);
    if (skillId !== "functions") await loadNext(page);
  }
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!));
  expect(stored.calibrationCompleted).toBe(true);
  expect(stored.calibrationIndex).toBe(8);
  expect(stored.recentAttempts.map((attempt: { skillId: string }) => attempt.skillId)).toEqual(["expressions", ...skillIds]);
  expect(stored.recentAttempts.slice(0, 2).map((attempt: { calibrationIndex: number }) => attempt.calibrationIndex)).toEqual([0, 0]);
});

test("a stale calibration solution completion cannot skip the current topic", async ({ page }) => {
  await startPractice(page, {}, "/practice/");
  const other = await openOtherPractice(page, false, "/practice/");
  await solve(page);
  await other.getByRole("button", { name: "Show worked solution" }).click();
  await expect(other.getByRole("heading", { name: "Worked solution" })).toBeVisible();
  await other.getByRole("button", { name: "Skip this question" }).click();
  await expect(other.locator(".practice-context .plain-kicker")).toHaveText("Calibration 2 of 8");
  await expect(other.locator(".practice-context h1")).toHaveText("Equations & inequalities");
});

for (const order of [[0, 1, 2], [0, 2, 1]]) {
  test(`reserved questions earn independent points in presentation order ${order.join("-")}`, async ({ page }) => {
    await startPractice(page);
    const same = await openOtherPractice(page);
    const distinct = await openOtherPractice(page);
    await expect(same.locator(".problem-code")).not.toHaveText((await page.locator(".problem-code").textContent())!);
    const tabs = [page, same, distinct];
    for (let index = 0; index < order.length; index++) {
      await solve(tabs[order[index]]);
      await expectRewards(tabs[order[index]], (index + 1) * 10, index + 1);
    }
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!));
    expect(stored.totalPoints).toBe(30);
    expect(new Set(stored.recentAttempts.map((attempt: { questionId: string }) => attempt.questionId)).size).toBe(3);
    expect(new Set(stored.recentAttempts.map((attempt: { presentationId: string }) => attempt.presentationId)).size).toBe(3);
  });
}

test("revealing one presentation does not disqualify another tab's question", async ({ page }) => {
  await startPractice(page);
  const same = await openOtherPractice(page);
  await page.getByRole("button", { name: "Show worked solution" }).click();
  await expect(page.getByRole("heading", { name: "Worked solution" })).toBeVisible();
  await solve(same);
  await expectRewards(same, 10, 1);
  await solve(page);
  await expectRewards(page, 10, 1);
});

test("retains both tabs' answers and synchronizes their rewards", async ({ page }) => {
  await startPractice(page);
  const other = await openOtherPractice(page);
  await solve(page);
  await solve(other);
  await expectRewards(page, 20, 2);
  await expectRewards(other, 20, 2);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!));
  expect(stored.recentAttempts).toHaveLength(2);
  expect(new Set(stored.recentAttempts.map((attempt: { questionId: string }) => attempt.questionId)).size).toBe(2);
});

test("avoids the previous form after reload and skip, including abandoned questions", async ({ page }) => {
  await startPractice(page, {}, "/practice/?topic=polynomials");
  const history = () => page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!).recentPresentations as Array<{
    formId: string;
    problemKey: string;
  }>);
  const first = (await history()).at(-1)!;

  await page.reload();
  await expect(page.locator(".problem-code")).toBeVisible();
  await expect.poll(async () => (await history()).length).toBe(2);
  const second = (await history()).at(-1)!;
  expect(second.formId).not.toBe(first.formId);
  expect(second.problemKey).not.toBe(first.problemKey);

  await page.getByRole("button", { name: "Skip this question" }).click();
  await expect.poll(async () => (await history()).length).toBe(3);
  const third = (await history()).at(-1)!;
  expect(third.formId).not.toBe(second.formId);
  expect(third.problemKey).not.toBe(second.problemKey);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!).recentAttempts.length)).toBe(1);
});

test("preserves concurrent awards even before tabs receive storage notifications", async ({ page }) => {
  await startPractice(page);
  const other = await openOtherPractice(page, true);
  await Promise.all([enterCorrectAnswer(page), enterCorrectAnswer(other)]);
  await Promise.all([
    page.getByRole("button", { name: "Check answer", exact: true }).click(),
    other.getByRole("button", { name: "Check answer", exact: true }).click()
  ]);
  await expectRewards(page, 20, 2);
  await other.reload();
  await expectRewards(other, 20, 2);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!));
  expect(stored.recentAttempts).toHaveLength(2);
});

test("reset clears other practice tabs and starts a new reward record", async ({ page }) => {
  await startPractice(page);
  const other = await openOtherPractice(page);
  await solve(other);
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await page.getByRole("button", { name: "Reset local progress" }).click();
  await page.getByRole("button", { name: "Reset progress", exact: true }).click();
  await expectRewards(other, 0, 0);
  await expect(other.getByRole("button", { name: "Check answer", exact: true })).toBeDisabled();
  await solve(other);
  await expectRewards(other, 10, 1);
  await expect(page.locator(".reward-summary dd")).toHaveText(["10", "1", "1"]);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!));
  expect(stored.recentAttempts).toHaveLength(1);
});

test("rejects pre-reset state even when a tab misses the reset notification", async ({ page }) => {
  await startPractice(page);
  const other = await openOtherPractice(page, true);
  await solve(other);
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await page.getByRole("button", { name: "Reset local progress" }).click();
  await page.getByRole("button", { name: "Reset progress", exact: true }).click();
  await other.getByRole("button", { name: "Load the next question" }).click();
  await expect(other.getByRole("button", { name: "Check answer", exact: true })).toBeDisabled();
  await expectRewards(other, 0, 0);
  const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!));
  expect(cleared.totalPoints).toBe(0);
  expect(cleared.recentAttempts).toEqual([]);
  await solve(other);
  await expectRewards(other, 10, 1);
  const resumed = await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!));
  expect(resumed.recentAttempts).toHaveLength(1);
});

test("viewing an accepted answer's solution preserves another tab's streak", async ({ page }) => {
  await startPractice(page);
  const other = await openOtherPractice(page);
  await solve(page);
  await solve(other);
  await page.getByRole("button", { name: "Show worked solution" }).click();
  await expect(page.getByRole("heading", { name: "Worked solution" })).toBeVisible();
  await expectRewards(page, 20, 2);
  await expectRewards(other, 20, 2);
});

test("solving a revealed question does not erase a streak earned in another tab", async ({ page }) => {
  await startPractice(page);
  const other = await openOtherPractice(page);
  await page.getByRole("button", { name: "Show worked solution" }).click();
  await expect(page.getByRole("heading", { name: "Worked solution" })).toBeVisible();
  await solve(other);
  await solve(page);
  await expectRewards(page, 10, 1);
  await expectRewards(other, 10, 1);
});

test("keeps a failed save retryable without accepting or awarding the answer", async ({ page }) => {
  await startPractice(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let failNextSave = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === "russelli.progress.v1" && failNextSave) {
        failNextSave = false;
        throw new DOMException("Browser storage is unavailable.", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await enterCorrectAnswer(page);
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Progress could not be saved");
  await expect(page.getByText("Answer accepted.", { exact: true })).toHaveCount(0);
  await expectRewards(page, 0, 0);
  await expect(page.getByRole("button", { name: "Check answer", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByText("Answer accepted.", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expectRewards(page, 10, 1);
});

test("retries an initial question reservation after saving fails", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((progress) => localStorage.setItem("russelli.progress.v1", JSON.stringify(progress)), createDefaultProgress());
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    let failNextSave = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === "russelli.progress.v1" && failNextSave) {
        failNextSave = false;
        throw new DOMException("Browser storage is unavailable.", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page.goto("/practice/?topic=linear");

  await expect(page.getByRole("heading", { name: "Question unavailable" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("could not be saved");
  await expect(page.getByRole("button", { name: "Try again" })).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!).recentPresentations)).toEqual([]);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".problem-code")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("russelli.progress.v1")!).recentPresentations)).toHaveLength(1);
});

test("keeps keyboard focus available for a wrong-answer retry", async ({ page }) => {
  await startPractice(page);
  const field = page.locator("math-field.math-answer-field");
  await field.focus();
  await enterAnswer(page, "123456789");
  await field.press("Enter");
  await expect(page.getByText("Check your answer.", { exact: true })).toBeVisible();
  await expect(field).toBeFocused();
  await enterCorrectAnswer(page);
  await field.press("Enter");
  await expect(page.getByText("Answer accepted.", { exact: true })).toBeVisible();
  await expectRewards(page, 10, 1);
});

test("awards milestone bonuses once and persists through navigation and reload", async ({ page }) => {
  await startPractice(page);
  for (let index = 1; index <= 10; index++) {
    await solve(page, index === 5);
    await expectRewards(page, index * 10 + Math.floor(index / 5) * 10, index);
    if (index % 5 === 0) await expect(page.locator(".feedback")).toContainText("10 streak bonus");
    await page.locator("math-field.math-answer-field").evaluate((element) => {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    await expectRewards(page, index * 10 + Math.floor(index / 5) * 10, index);
    if (index < 10) await loadNext(page);
  }
  await page.getByRole("button", { name: "Show worked solution" }).click();
  await expectRewards(page, 120, 10);
  await page.reload();
  await expectRewards(page, 120, 10);
  await page.locator("select").selectOption("functions");
  await expect(page.getByRole("heading", { name: "Functions", exact: true })).toBeVisible();
  await expectRewards(page, 120, 10);
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.locator(".reward-summary dd")).toHaveText(["120", "10", "10"]);
});

test("allows hints and retries but resets on mistakes, skips, and solution reveals", async ({ page }) => {
  await startPractice(page);
  await solve(page);
  await loadNext(page);
  await page.getByRole("button", { name: "Reveal the next hint" }).click();
  await expectRewards(page, 10, 1);
  await enterAnswer(page, "123456789");
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expectRewards(page, 10, 0);
  await solve(page);
  await expectRewards(page, 20, 1);
  await loadNext(page);
  await page.getByRole("button", { name: "Skip this question" }).click();
  await expectRewards(page, 20, 0);
  await solve(page);
  await loadNext(page);
  await page.getByRole("button", { name: "Show worked solution" }).click();
  await expectRewards(page, 30, 0);
  await expect(page.locator(".solution-points-note[role=status]")).toContainText("No points for this question");
  await solve(page);
  await expectRewards(page, 30, 0);
  await expect(page.locator(".feedback")).toContainText("No points");
});

test("keeps each problem fixed across mastery thresholds on success and retry", async ({ page }) => {
  const initial = createDefaultProgress();
  await startPractice(page, { mastery: { ...initial.mastery, expressions: 0.44 } });
  const prompt = await page.locator("math-field.problem-equation").evaluate((element) => (element as HTMLElement & { value: string }).value);
  const code = (await page.locator(".problem-code").textContent())!;
  await solve(page);
  await expect(page.locator(".difficulty-label")).toHaveText("easy");
  await expect(page.locator(".problem-code")).toHaveText(code);
  await expect(page.locator("math-field.problem-equation")).toHaveJSProperty("value", prompt);
  await loadNext(page);
  await expect(page.locator(".difficulty-label")).toHaveText("medium");
  const nextCode = (await page.locator(".problem-code").textContent())!;
  for (let index = 0; index < 2; index++) {
    await enterAnswer(page, "123456789");
    await page.getByRole("button", { name: "Check answer", exact: true }).click();
  }
  await expect(page.locator(".difficulty-label")).toHaveText("medium");
  await expect(page.locator(".problem-code")).toHaveText(nextCode);
  await solve(page);
  await loadNext(page);
  await expect(page.locator(".difficulty-label")).toHaveText("easy");
});

test("explains points, ignores incomplete input, and resets all rewards", async ({ page }) => {
  await startPractice(page);
  await expectRewards(page, 0, 0);
  await expect(page.getByRole("button", { name: "Check answer", exact: true })).toBeDisabled();
  const rules = page.getByText("How points work", { exact: true });
  await rules.focus();
  await expect(rules).toBeFocused();
  expect(await rules.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await rules.press("Enter");
  await expect(page.locator(".points-help[open]")).toContainText("every fifth");
  await enterAnswer(page, "\\frac");
  await expect(page.getByRole("button", { name: "Check answer", exact: true })).toBeDisabled();
  await expectRewards(page, 0, 0);
  await solve(page);
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await page.getByRole("button", { name: "Reset local progress" }).click();
  await expect(page.getByRole("dialog")).toContainText("points and streaks");
  await page.keyboard.press("Escape");
  await expect(page.locator(".reward-summary dd")).toHaveText(["10", "1", "1"]);
  await page.getByRole("button", { name: "Reset local progress" }).click();
  await page.getByRole("button", { name: "Reset progress", exact: true }).click();
  await expect(page.locator(".reward-summary dd")).toHaveText(["0", "0", "0"]);
  await expect(page.getByRole("heading", { name: "No answers recorded yet." })).toBeVisible();
});

test("reward interfaces reflow with large counts and pass accessibility checks", async ({ page }) => {
  await startPractice(page, { totalPoints: 1234567890123, currentStreak: 123456789, bestStreak: 123456789 });
  for (const route of ["/practice/?topic=expressions", "/progress/"]) {
    await page.goto(route);
    for (const width of [320, 360, 640, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${route} page at ${width}px`)
        .toBeLessThanOrEqual(width);
      if (route.startsWith("/practice")) {
        const placeholderFits = await page.locator("math-field.math-answer-field").evaluate((element) => {
          const placeholder = element.shadowRoot!.querySelector('[part="placeholder"]')!.getBoundingClientRect();
          const content = element.shadowRoot!.querySelector('[part="content"]')!.getBoundingClientRect();
          return placeholder.right <= content.right + 1;
        });
        expect(placeholderFits, `Answer placeholder at ${width}px`).toBe(true);
      }
      await page.getByText("How points work", { exact: true }).click();
      const overflow = await page.evaluate(() => [...document.querySelectorAll(".practice-rewards *, .reward-summary *, .points-help *")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.left < 0 || rect.right > document.documentElement.clientWidth + 1 || element.scrollWidth > element.clientWidth + 1);
        }).map((element) => element.outerHTML));
      expect(overflow, `${route} at ${width}px`).toEqual([]);
      await page.getByText("How points work", { exact: true }).click();
    }
    await page.setViewportSize({ width: 640, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.getByText("How points work", { exact: true }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  }
});
