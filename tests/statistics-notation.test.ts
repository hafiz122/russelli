import { convertLatexToMathMl, validateLatex } from "mathlive/ssr";
import { expect, it } from "vitest";
import { statisticsSkillIds } from "../src/data/skills";
import { generateQuestion } from "../src/math/generators";

it.each(statisticsSkillIds)("renders prompts, answers, and solutions for %s", (skillId) => {
  const checked = new Set<string>();
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    for (let seed = 1; seed <= 12; seed++) {
      const question = generateQuestion(skillId, seed, difficulty);
      for (const latex of [question.promptLatex, question.answer.latex, ...question.workedSolution]) {
        if (checked.has(latex)) continue;
        checked.add(latex);
        const context = `${question.id} · ${latex}`;
        expect(validateLatex(latex), context).toEqual([]);
        expect(convertLatexToMathMl(latex), context).not.toContain("<merror");
      }
    }
  }
});

it.each([
  ["hypothesis_testing", 2, "z", "obs"],
  ["one_sample_tests", 1, "t", "obs"],
  ["proportion_tests", 2, "p", "val"],
  ["errors_power", 2, "α", "actual"]
] as const)("groups the %s subscript as a single upright label", (skillId, seed, base, label) => {
  const question = generateQuestion(skillId, seed, "easy");
  const steps = question.workedSolution.map(step => convertLatexToMathMl(step)).join("");
  const math = new DOMParser().parseFromString(`<math>${steps}</math>`, "text/html");
  const grouped = [...math.querySelectorAll("msub")].some(sub => {
    const [symbol, subscript] = sub.children;
    return symbol.textContent === base && subscript.textContent === label &&
      subscript.localName === "mi" && subscript.getAttribute("mathvariant") === "normal";
  });
  expect(grouped).toBe(true);
});
