import { convertLatexToMarkup, convertLatexToMathMl, validateLatex } from "mathlive/ssr";
import { expect, it } from "vitest";
import { calculusIds, calculusTopics } from "../src/data/calculus";
import { generateQuestion } from "../src/math/generators";

it.each(calculusIds)("renders both forms, at every difficulty, for %s", skill => {
  const checked = new Set<string>();
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    const forms = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const question = generateQuestion(skill, seed, difficulty);
      forms.add(question.formId);
      const displayed = [question.promptLatex, ...question.workedSolution];
      if (question.answer.kind === "choice") {
        expect(question.answer.choices?.find(option => option.value === question.answer.latex)?.label).toBeTruthy();
      } else {
        displayed.push(question.answer.latex);
      }
      for (const latex of displayed) {
        if (checked.has(latex)) continue;
        checked.add(latex);
        const context = `${question.id} · ${latex}`;
        expect(validateLatex(latex), context).toEqual([]);
        expect(convertLatexToMathMl(latex), context).not.toContain("<merror");
        expect(convertLatexToMarkup(latex), context).not.toMatch(/ML__error|ML__placeholder/);
      }
    }
    expect(forms).toEqual(new Set(calculusTopics[skill].forms));
  }
});

function renderedFractions(...lines: string[]): string[] {
  const markup = lines.map(line => convertLatexToMathMl(line)).join("");
  const math = new DOMParser().parseFromString(`<math>${markup}</math>`, "text/html");
  for (const exponent of math.querySelectorAll("mfrac msup > :nth-child(2)")) exponent.prepend("^");
  return [...math.querySelectorAll("mfrac")].map(fraction =>
    [...fraction.children].map(part =>
      part.textContent.normalize("NFKC").replace(/[\s\u2061-\u2064]/g, "")
    ).join("/")
  );
}

it.each([[4, "x"], [2, "y"]] as const)("shows the first partial for seed %i with respect to %s", (seed, variable) => {
  const question = generateQuestion("calc_partial_derivatives", seed, "easy");
  const derivative = `∂f/∂${variable}`;
  expect(renderedFractions(question.promptLatex)).toContain(derivative);
  expect(renderedFractions(...question.workedSolution)).toContain(derivative);
});

it("writes the mixed derivative with the first differentiation variable on the right", () => {
  const question = generateQuestion("calc_partial_derivatives", 1, "easy");
  expect(renderedFractions(question.promptLatex)).toContain("∂^2f/∂y∂x");
  expect(renderedFractions(...question.workedSolution)).toEqual(
    expect.arrayContaining(["∂f/∂x", "∂^2f/∂y∂x"])
  );
});

it.each([[2, "z"], [1, "T"]] as const)("distinguishes partial and ordinary rates in the chain rule for seed %i", (seed, field) => {
  const question = generateQuestion("calc_chain_rule", seed, "easy");
  const terms = [`d${field}/dt`, `∂${field}/∂x`, `∂${field}/∂y`, "dx/dt", "dy/dt"];
  expect(renderedFractions(question.promptLatex)).toEqual(
    expect.arrayContaining(field === "T" ? terms : ["dz/dt"])
  );
  expect(renderedFractions(...question.workedSolution)).toEqual(expect.arrayContaining(terms));
});

it.each([1, 2])("writes both height partials in the surface area calculation for seed %i", seed => {
  const question = generateQuestion("calc_surface_area", seed, "easy");
  expect(renderedFractions(...question.workedSolution)).toEqual(
    expect.arrayContaining(["∂z/∂x", "∂z/∂y"])
  );
});

it.each([[2, "dy/dx"], [1, "d^2y/dx^2"]] as const)("shows the requested parametric derivative for seed %i", (seed, derivative) => {
  const question = generateQuestion("calc_parametric_calculus", seed, "easy");
  expect(renderedFractions(question.promptLatex)).toContain(derivative);
  expect(renderedFractions(...question.workedSolution)).toContain(derivative);
});
