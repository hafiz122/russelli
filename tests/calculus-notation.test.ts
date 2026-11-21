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
