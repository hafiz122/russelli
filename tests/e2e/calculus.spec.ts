import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { calculusIds, calculusTopics, chapters, topicsForFocus } from "../../src/data/calculus";
import type { Outcome } from "../../src/math/calculusTopic";
import { generateQuestion } from "../../src/math/generators";
import type { Difficulty } from "../../src/types";

async function shownQuestion(page: Page) {
  const title = await page.locator(".practice-context h1").innerText();
  const id = calculusIds.find(id => calculusTopics[id].title === title);
  if (!id) throw new Error(`No calculus topic named ${title}`);
  const code = await page.locator(".problem-code").innerText();
  const difficulty = (await page.locator(".difficulty-label").innerText()).toLowerCase() as Difficulty;
  const question = generateQuestion(id, parseInt(code.split(" ")[1], 36), difficulty);
  await expect(page.locator("#problem-instruction")).toHaveText(question.instruction);
  return question;
}

async function advance(page: Page, action: "Skip this question" | "Load the next question") {
  const code = await page.locator(".problem-code").innerText();
  await page.getByRole("button", { name: action }).click();
  await expect(page.locator(".problem-code")).not.toHaveText(code, { useInnerText: true });
}

async function enterInteger(page: Page, latex: string) {
  expect(latex).toMatch(/^-?\d+$/);
  await page.locator('math-field[aria-label="Final calculus answer"]').focus();
  await page.keyboard.type(latex);
  await page.keyboard.press("Enter");
}

function outcomeCard(page: Page, outcome: Outcome) {
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name: new RegExp(`^${outcome} ·`) }) });
}

async function expectCount(page: Page, outcome: Outcome, count: number) {
  const total = topicsForFocus({ clo: outcome }).length;
  await expect(outcomeCard(page, outcome)).toContainText(`${count} of ${total} topics solved independently`);
}

test("home chapters, deep links and the practice selector keep the chosen scope", async ({ page }) => {
  await page.goto("/");
  const chapterList = page.getByRole("list", { name: "Calculus chapters" });
  for (const chapter of chapters) {
    await expect(chapterList.getByRole("link", { name: chapter.title })).toHaveAttribute("href", `/calculus/?chapter=${chapter.number}`);
  }
  await chapterList.getByRole("link", { name: "Partial Derivatives", exact: true }).click();
  const picker = page.getByRole("combobox", { name: "Choose calculus practice" });
  await expect(picker).toHaveValue("chapter=4");
  expect(topicsForFocus({ chapter: 4 })).toContain((await shownQuestion(page)).skillId);
  await advance(page, "Skip this question");
  expect(topicsForFocus({ chapter: 4 })).toContain((await shownQuestion(page)).skillId);

  await picker.selectOption("topic=calc_chain_rule");
  await expect(page).toHaveURL(/\/calculus\/\?topic=calc_chain_rule$/);
  await expect(page.getByRole("heading", { name: "The chain rule", exact: true })).toBeVisible();
  const original = await shownQuestion(page);
  await enterInteger(page, original.answer.latex);
  await expect(page.getByText("Answer accepted.", { exact: true })).toBeVisible();
  await advance(page, "Load the next question");
  expect((await shownQuestion(page)).skillId).toBe("calc_chain_rule");

  await picker.selectOption("clo=CLO2");
  await expect(page).toHaveURL(/\/calculus\/\?clo=CLO2$/);
  expect((await shownQuestion(page)).outcome).toBe("CLO2");
  await advance(page, "Skip this question");
  const integral = await shownQuestion(page);
  expect(integral.outcome).toBe("CLO2");
  const field = page.locator('math-field[aria-label="Final calculus answer"]');
  await field.evaluate((element, latex) => {
    (element as HTMLElement & { value: string }).value = latex;
    element.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }, integral.answer.latex);
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await advance(page, "Load the next question");
  expect((await shownQuestion(page)).outcome).toBe("CLO2");
  await expect(picker).toHaveValue("clo=CLO2");
  await expect(picker.locator('option[value="clo=CLO4"]')).toHaveCount(0);
});

test("a keyboard-only concept answer updates its outcome and recent check", async ({ page }) => {
  await page.goto("/calculus/?topic=calc_dot_product&clo=CLO1");
  const question = await shownQuestion(page);
  const choices = question.answer.choices!;
  const correctIndex = choices.findIndex(item => item.value === question.answer.latex);
  const radios = page.getByRole("radio");
  await expect(radios).toHaveCount(choices.length);
  await expect(page.getByRole("button", { name: "Check answer", exact: true })).toBeDisabled();

  // Start in the document and navigate to the native radio group with the keyboard.
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    if (await radios.first().evaluate(el => el === document.activeElement)) break;
  }
  await expect(radios.first()).toBeFocused();
  for (let i = 0; i < correctIndex; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  const selected = page.getByRole("radio", { name: choices[correctIndex].label, exact: true });
  await expect(selected).toBeFocused();
  await expect(selected).toBeChecked();
  expect(await selected.evaluate(el => {
    const focus = getComputedStyle(el.closest("label")!);
    return focus.outlineStyle !== "none" && parseFloat(focus.outlineWidth) >= 2;
  })).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Answer accepted.", { exact: true })).toBeVisible();
  await advance(page, "Load the next question");
  expect((await shownQuestion(page)).outcome).toBe("CLO1");
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expectCount(page, "CLO1", 1);
  await expect(page.locator(".recent-results")).toContainText(choices[correctIndex].label);
});

test("another tab can choose a topic while the first tab stays on its guided chapter path", async ({ page, context }) => {
  await page.goto("/calculus/");
  const first = await shownQuestion(page);
  const secondTab = await context.newPage();
  await secondTab.goto("/calculus/");
  await secondTab.getByLabel("Choose calculus practice").selectOption("topic=calc_chain_rule");
  await expect(secondTab.locator(".practice-context h1")).toHaveText("The chain rule");
  await expect(page.getByLabel("Choose calculus practice")).toHaveValue("");
  await advance(page, "Skip this question");
  expect((await shownQuestion(page)).skillId).toBe(first.skillId);
});

test("only independent first answers count, and progress and reset synchronize across tabs", async ({ page, context }) => {
  const records = await context.newPage();
  await records.goto("/progress/");
  await expectCount(records, "CLO3", 0);
  await expect(records.getByText("Outcome description unavailable.", { exact: false })).toBeVisible();
  const card = outcomeCard(records, "CLO3");
  await card.locator("summary").click();
  const topicLink = card.getByRole("link", { name: "The dot product", exact: true });
  const href = await topicLink.getAttribute("href");
  expect(href).toBe("/calculus/?topic=calc_dot_product&clo=CLO3");
  await page.goto(href!);
  for (const [i, mode] of (["hint", "solution", "retry", "independent", "repeat"] as const).entries()) {
    const q = await shownQuestion(page);
    expect(q.outcome).toBe("CLO3");
    if (mode === "hint") {
      await page.getByRole("button", { name: "Reveal the next hint" }).click();
      await expect(page.locator(".hint-list")).toContainText(q.hints[0]);
    } else if (mode === "solution") {
      await page.getByRole("button", { name: "Show worked solution" }).click();
      await expect(page.getByRole("heading", { name: "Worked solution" })).toBeVisible();
    } else if (mode === "retry") {
      await enterInteger(page, "999999");
      await expect(page.getByText("Check your answer.", { exact: true })).toBeVisible();
      const field = page.locator('math-field[aria-label="Final calculus answer"]');
      await field.focus();
      for (let digit = 0; digit < 6; digit++) await page.keyboard.press("Backspace");
      await expect(field).toHaveJSProperty("value", "");
    }
    await enterInteger(page, q.answer.latex);
    await expect(page.getByText("Answer accepted.", { exact: true })).toBeVisible();
    await expect(records.locator(".record-summary .summary-value").nth(1)).toHaveText(String(i + 1));
    await expectCount(records, "CLO3", i < 3 ? 0 : 1);
    if (mode === "hint") await expect(records.locator(".recent-results")).toContainText("attempt 1 · hint used");
    if (mode !== "repeat") await advance(page, "Load the next question");
  }
  await expect(topicLink).toHaveCount(0);
  await records.getByRole("button", { name: "Reset local progress" }).click();
  await records.getByRole("dialog").getByRole("button", { name: "Reset progress", exact: true }).click();
  await expectCount(records, "CLO3", 0);
  await expect(records.getByRole("heading", { name: "No answers recorded yet." })).toBeVisible();
  await expect(page.getByLabel("Practice rewards").locator("dd").first()).toHaveText("0");
  await expect(page.getByRole("button", { name: "Check answer", exact: true })).toBeDisabled();
});

test("long calculus prompts and worked steps reflow or scroll with keyboard at 200% text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/calculus/?topic=calc_spherical_integrals");
  const q = await shownQuestion(page);
  const prompt = page.locator("math-field.problem-equation");
  await expect(prompt).toHaveAttribute("aria-label", `${q.instruction} ${q.promptDescription}`);
  await page.getByRole("button", { name: "Show worked solution" }).click();
  await expect(page.locator(".worked-solution math-field")).toHaveCount(q.workedSolution.length);
  const math = page.locator(".problem-sheet math-field.static-math, .worked-solution math-field.static-math");
  await page.evaluate(() => document.fonts.ready);
  const originalSize = await prompt.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  for (const width of [320, 640, 1024, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect.poll(() => nav.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(1);
  await expect.poll(() => prompt.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(1.95 * originalSize);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect.poll(() => math.evaluateAll(fields => fields.every(el => {
    const host = el.parentElement!;
    return (host.scrollWidth <= host.clientWidth + 1 || (host.tabIndex === 0 && getComputedStyle(host).overflowX === "auto")) &&
      Boolean(el.shadowRoot?.querySelector(".ML__latex")?.textContent) &&
      !el.shadowRoot?.querySelector(".ML__error, .ML__placeholder");
  }))).toBe(true);
  const scrollable = page.locator(".worked-solution .scrollable-math[tabindex='0']").first();
  await expect(scrollable).toBeVisible();
  await scrollable.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => scrollable.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter(issue => issue.id === "color-contrast" || ["serious", "critical"].includes(issue.impact ?? ""))).toEqual([]);
});
