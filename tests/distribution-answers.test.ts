import { describe, expect, it } from "vitest";
import { distributionAnswer, distributionLatex, readDistribution } from "../src/math/distributions";
import { generateQuestion, generators } from "../src/math/generators";
import { isParseableAnswer, validateAnswer } from "../src/math/validator";
import type { DistributionFamily } from "../src/types";

const question = (family: DistributionFamily, ...parameters: string[]) => ({
  ...generateQuestion("expressions", 1, "easy"),
  answer: distributionAnswer(family, ...parameters)
});

describe("distribution answers", () => {
  it.each([
    { family: "normal", expected: ["-3", "\\frac{1}{4}"], actual: ["-3", "0.25"] },
    { family: "t", expected: ["10"], actual: ["11-1"] },
    { family: "chi_square", expected: ["8"], actual: ["2^3"] },
    { family: "f", expected: ["3", "4"], actual: ["3", "\\sqrt{16}"] }
  ] satisfies { family: DistributionFamily; expected: string[]; actual: string[] }[])(
    "checks the parameters for $family", ({ family, expected, actual }) => {
      const problem = question(family, ...expected);
      const result = validateAnswer(problem, distributionLatex(family, actual));
      expect(result.correct).toBe(true);
      expect(validateAnswer(problem, result.normalizedAnswer).correct).toBe(true);
    }
  );

  it("distinguishes the family, parameter order and variance convention", () => {
    expect(validateAnswer(question("t", "6"), distributionLatex("chi_square", ["6"]))).toMatchObject({ parseable: true, correct: false });
    expect(validateAnswer(question("f", "2", "8"), distributionLatex("f", ["8", "2"])).correct).toBe(false);
    expect(validateAnswer(question("normal", "3", "4"), distributionLatex("normal", ["3", "2"])).correct).toBe(false);
    expect(validateAnswer(question("normal", "0", "1"), "(0,1)").parseable).toBe(false);
  });

  it("requires exact parameter values even inside the engine's numerical tolerance", () => {
    const problem = question("normal", "4", "\\frac{1}{3}");
    expect(validateAnswer(problem, distributionLatex("normal", ["4", "0.3333333333333333"])).correct).toBe(false);
    expect(validateAnswer(problem, distributionLatex("normal", ["4+10^{-12}", "\\frac{1}{3}"])).correct).toBe(false);
    expect(validateAnswer(problem, distributionLatex("normal", ["4", "0.333333333333333333333"])).correct).toBe(false);
  });

  it("waits for a complete set of parameters", () => {
    const problem = question("normal", "0", "1");
    for (const entry of ["", " ", "\\placeholder{}", "\\frac{}{2}", "1,2", "a=2"]) {
      const partial = distributionLatex("normal", ["0", entry]);
      expect(readDistribution(partial)?.parameters).toEqual(["0", entry]);
      expect(isParseableAnswer(problem, partial), entry).toBe(false);
    }
    expect(isParseableAnswer(problem, distributionLatex("normal", ["1"]))).toBe(false);
    for (const broken of ["t_{", "t_{{1}", "t_{{1},}", "F_{{1}{2}}", "F_{{1},{2}}extra"]) {
      expect(readDistribution(broken)).toBeNull();
    }
    expect(isParseableAnswer(problem, "")).toBe(false);
  });

  it("compares equivalent symbolic parameters", () => {
    const problem = question("normal", "\\mu", "\\frac{\\sigma^2}{n}");
    expect(validateAnswer(problem, distributionLatex("normal", ["\\mu", "\\sigma^2 n^{-1}"])).correct).toBe(true);
  });
});

describe("exact numerical statistics answers", () => {
  it("accepts a terminating decimal and rejects nearby decimals on both sides", () => {
    const generator = generators.conditional_probability;
    const half = generator.generate(30, "easy");
    expect(generator.validate(half, "0.5").correct).toBe(true);
    expect(generator.validate(half, "0.50000000000000000000000").correct).toBe(true);
    for (const nearHalf of ["0.499999999999", "0.500000000001", "0.49999999999999995805696"]) {
      expect(generator.validate(half, nearHalf)).toMatchObject({ parseable: true, correct: false });
    }
    const third = generator.generate(8, "easy");
    expect(generator.validate(third, "\\frac{2}{6}").correct).toBe(true);
    expect(generator.validate(third, "0.333333333333333333333").correct).toBe(false);
  });

  it("requires an exact count for a large permutation problem", () => {
    const generator = generators.counting;
    const problem = generator.generate(30, "hard");
    expect(generator.validate(problem, "181440.0").correct).toBe(true);
    for (const nearCount of ["181439.999999999999", "181440.000000000001"]) {
      expect(generator.validate(problem, nearCount)).toMatchObject({ parseable: true, correct: false });
    }
  });
});
