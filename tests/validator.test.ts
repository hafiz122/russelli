import { describe, expect, it } from "vitest";
import { validateAnswer } from "../src/math/validator";
import type { AnswerKind, Question } from "../src/types";

function question(expected: string, kind: AnswerKind, extras: Partial<Question["answer"]> = {}): Question {
  return {
    id: "test:easy:1",
    seed: 1,
    generatorVersion: 1,
    skillId: "expressions",
    difficulty: "easy",
    formId: "test",
    problemKey: "test:x",
    promptLatex: "x",
    instruction: "Test",
    answer: { latex: expected, kind, ...extras },
    hints: ["Hint"],
    workedSolution: [expected]
  };
}

describe("answer equivalence", () => {
  it("reduces equivalent fractions", () => {
    expect(validateAnswer(question("\\frac{1}{2}", "number"), "\\frac{2}{4}").correct).toBe(true);
  });

  it("accepts reordered and expanded polynomial expressions", () => {
    expect(validateAnswer(question("x^2+3x+2", "expression"), "2+x^2+3x").correct).toBe(true);
    expect(validateAnswer(question("x^2+3x+2", "expression"), "(x+1)(x+2)").correct).toBe(true);
  });

  it("accepts proportional forms of the same equation", () => {
    expect(validateAnswer(question("y=2x+3", "equation"), "2x-y=-3").correct).toBe(true);
    expect(validateAnswer(question("y=2x+3", "equation"), "4x-2y=-6").correct).toBe(true);
    expect(validateAnswer(question("y=2x+3", "equation"), "y=2x+4").correct).toBe(false);
  });

  it("rejects different lines that coincide along the old sampling path", () => {
    const line = question("y=2x+3", "equation");
    expect(validateAnswer(line, "x+y=0").correct).toBe(false);
    expect(validateAnswer(line, "x-y=-2").correct).toBe(false);
  });

  it("preserves grouped fractional inequality boundaries", () => {
    const interval = question("[\\frac{11}{2},\\infty)", "interval");
    expect(validateAnswer(interval, "x\\ge\\frac{11}{2}").correct).toBe(true);
    const normalized = validateAnswer(interval, "x\\ge\\frac{11}{2}").normalizedAnswer;
    expect(validateAnswer(interval, normalized).correct).toBe(true);
    expect(validateAnswer(interval, "\\frac{11}{2}\\le x").correct).toBe(true);
    expect(validateAnswer(question("[-\\frac{3}{11},\\infty)", "interval"), "x\\ge-\\frac{3}{11}").correct).toBe(true);
  });

  it("rejects rational factors in a polynomial factoring task", () => {
    const factoring = question("(x+1)(x+2)", "expression", { requiresFactoredForm: true });
    expect(validateAnswer(factoring, "x(x+3+\\frac2x)").correct).toBe(false);
  });

  it("requires common factors to be cancelled regardless of spelling", () => {
    const rational = question("\\frac{x+1}{x+2}", "expression", { forbiddenFactorLatex: "(x-3)" });
    expect(validateAnswer(rational, "\\frac{(3-x)(x+1)}{(3-x)(x+2)}").correct).toBe(false);
    expect(validateAnswer(rational, "\\frac{(x+(-3))(x+1)}{(x+(-3))(x+2)}").correct).toBe(false);
    expect(validateAnswer(rational, "\\left(\\frac{(3-x)(x+1)}{(3-x)(x+2)}\\right)").correct).toBe(false);
    expect(validateAnswer(rational, "\\frac{-x-1}{-x-2}").correct).toBe(true);
  });

  it("checks ordered pair position", () => {
    const orderedPair = question("(2,-3)", "ordered_pair");
    expect(validateAnswer(orderedPair, "(\\frac{4}{2},-3)").correct).toBe(true);
    expect(validateAnswer(orderedPair, "(-3,2)").correct).toBe(false);
  });

  it("checks triples component by component", () => {
    const triple = question("(1,-2,3)", "ordered_triple");
    expect(validateAnswer(triple, "(\\frac{2}{2},-2,3)").correct).toBe(true);
    expect(validateAnswer(triple, "(1,3,-2)").correct).toBe(false);
    expect(validateAnswer(triple, "(1,-2)").parseable).toBe(false);
    expect(validateAnswer(triple, "(1,-2,3").parseable).toBe(false);
    expect(validateAnswer(triple, "(1,-2,3]").parseable).toBe(false);
  });

  it("checks matrix dimensions and equivalent entries", () => {
    const matrix = question("\\begin{bmatrix}1&\\frac{1}{2}\\\\0&-3\\end{bmatrix}", "matrix");
    expect(validateAnswer(matrix, "\\begin{pmatrix}1&0.5\\\\0&-3\\end{pmatrix}").correct).toBe(true);
    expect(validateAnswer(matrix, "\\begin{bmatrix}1&\\frac{1}{2}\\\\-3&0\\end{bmatrix}").correct).toBe(false);
    expect(validateAnswer(matrix, "\\begin{bmatrix}1&\\frac{1}{2}&0\\\\0&-3&0\\end{bmatrix}").correct).toBe(false);
  });

  it("explains a matrix dimension mismatch without rejecting valid matrix input", () => {
    const matrix = question("\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}", "matrix");
    const result = validateAnswer(matrix, "\\begin{bmatrix}1&2&0\\\\3&4&0\\end{bmatrix}");

    expect(result.parseable).toBe(true);
    expect(result.correct).toBe(false);
    expect(result.retryEligible).toBe(true);
    expect(result.feedback).toBe("Your answer is a 2 by 3 matrix. Enter a 2 by 2 matrix.");
  });

  it("accepts nonzero scalar multiples of an eigenvector", () => {
    const vector = question("(2,-3)", "vector_direction");
    expect(validateAnswer(vector, "(-4,6)").correct).toBe(true);
    expect(validateAnswer(vector, "(\\frac{1}{2},-\\frac{3}{4})").correct).toBe(true);
    expect(validateAnswer(vector, "(0,0)").correct).toBe(false);
    expect(validateAnswer(vector, "(2,3)").correct).toBe(false);
    expect(validateAnswer(vector, "(2t,-3t)").correct).toBe(false);
    expect(validateAnswer(vector, "(-4,6]").parseable).toBe(false);
    expect(validateAnswer(vector, "(-4,6").parseable).toBe(false);
  });

  it("accepts interval and inequality forms of the same set", () => {
    const interval = question("[2,\\infty)", "interval");
    expect(validateAnswer(interval, "[\\frac{4}{2},\\infty)").correct).toBe(true);
    expect(validateAnswer(interval, "x\\ge2").correct).toBe(true);
    expect(validateAnswer(interval, "2\\le x").correct).toBe(true);
    expect(validateAnswer(interval, "x>2").correct).toBe(false);
  });

  it("accepts mathematically equivalent interval endpoints", () => {
    const lowerBounded = question("[\\frac{1}{2},\\infty)", "interval");
    const upperBounded = question("(-\\infty,\\frac{3}{4}]", "interval");

    expect(validateAnswer(lowerBounded, "[0.5,\\infty)").correct).toBe(true);
    expect(validateAnswer(lowerBounded, "x\\ge0.5").correct).toBe(true);
    expect(validateAnswer(upperBounded, "x\\le0.75").correct).toBe(true);
  });

  it("accepts interval brackets serialized by MathLive", () => {
    const interval = question("[-3,\\infty)", "interval");
    const result = validateAnswer(interval, "\\left\\lbrack-3,\\infty\\right)");

    expect(result.parseable).toBe(true);
    expect(result.correct).toBe(true);
  });

  it("explains that infinity cannot use a closed bracket", () => {
    const interval = question("[-3,\\infty)", "interval");
    const result = validateAnswer(interval, "\\left\\lbrack-3,\\infty\\right\\rbrack");

    expect(result.parseable).toBe(true);
    expect(result.correct).toBe(false);
    expect(result.feedback).toBe("Infinity is never included. Use a parenthesis next to infinity.");
  });

  it("requires visible factor structure when factoring is requested", () => {
    const factoring = question("(x-1)(x+2)", "expression", { requiresFactoredForm: true });
    expect(validateAnswer(factoring, "(x+2)(x-1)").correct).toBe(true);
    expect(validateAnswer(factoring, "x^2+x-2").correct).toBe(false);
  });

  it("requires a common factor to be cancelled", () => {
    const rational = question("\\frac{x+1}{x+2}", "expression", { forbiddenFactorLatex: "(x-3)" });
    expect(validateAnswer(rational, "\\frac{x+1}{x+2}").correct).toBe(true);
    expect(validateAnswer(rational, "\\frac{(x-3)(x+1)}{(x-3)(x+2)}").correct).toBe(false);
  });

  it("rejects incomplete math input", () => {
    const result = validateAnswer(question("2", "number"), "\\frac{2}{");
    expect(result.parseable).toBe(false);
    expect(result.retryEligible).toBe(true);
  });
});
