import { ComputeEngine } from "@cortex-js/compute-engine";
import { describe, expect, it } from "vitest";
import { statisticsFoundationGenerators } from "../src/math/statisticsFoundations";
import type { Difficulty, Question } from "../src/types";

const difficulties: Difficulty[] = ["easy", "medium", "hard"];
const ce = new ComputeEngine();
const evaluations = new Map<string, number>();

function number(latex: string): number {
  const ratio = latex.match(/^\\frac\{(-?\d+)\}\{(\d+)\}$/);
  return ratio ? Number(ratio[1]) / Number(ratio[2]) : Number(latex);
}

function value(latex: string, variable: string, point: number): number {
  const key = `${latex}:${variable}:${point}`;
  if (!evaluations.has(key)) {
    evaluations.set(key, ce.parse(latex).subs({ [variable]: point }).N().re);
  }
  return evaluations.get(key)!;
}

// Five-point Newton–Cotes integrates all the polynomial densities in these exercises exactly.
function integrate(fn: (x: number) => number, a: number, b: number): number {
  const step = (b - a) / 4;
  return (b - a) / 90 * (7 * fn(a) + 32 * fn(a + step) + 12 * fn(a + 2 * step) + 32 * fn(a + 3 * step) + 7 * fn(b));
}

function checkCounting(q: Question): void {
  const [, nText, kText] = q.promptLatex.match(/^n=(\d+),\\quad k=(\d+)$/)!;
  const n = Number(nText);
  const k = Number(kText);
  const needsOne = q.instruction.includes("One specified person");
  const needsExactlyOne = q.instruction.includes("Exactly one of two");
  let subsets = 0;
  for (let mask = 1; mask < 2 ** n; mask++) {
    const members = mask.toString(2).split("1").length - 1;
    if (members !== k || (needsOne && !(mask & 1))) continue;
    if (needsExactlyOne && (mask & 3) !== 1 && (mask & 3) !== 2) continue;
    subsets++;
  }
  let count = subsets;
  if (q.formId === "permutations") {
    for (let places = 2; places <= k; places++) count *= places;
  }
  expect(number(q.answer.latex), q.id).toBe(count);
}

function checkDraw(q: Question): void {
  const [, reds, blues] = q.promptLatex.match(/^R=(\d+),\\quad B=(\d+)$/)!;
  const beads = [...Array(Number(reds) - 1).fill("red"), ...Array(Number(blues)).fill("blue")];
  let total = 0;
  let hits = 0;
  for (const [i, x] of beads.entries()) for (const [j, y] of beads.entries()) {
    if (i === j) continue;
    total++;
    const hit = q.difficulty === "easy" ? x === "red" : q.difficulty === "medium" ? x === "red" && y === "red" : x !== y;
    if (hit) hits++;
  }
  expect(number(q.answer.latex), q.id).toBeCloseTo(hits / total, 12);
}

function checkBayes(q: Question): void {
  const [, prior, rateA, rateB] = q.promptLatex.match(/P\(A\)=(.*?)\\\\P\(R\\mid A\)=(.*?)\\\\P\(R\\mid B\)=(.*?)\\end/s)!;
  const p = number(prior);
  const red = p * number(rateA) + (1 - p) * number(rateB);
  const posterior = number(q.answer.latex);
  expect(posterior * red, q.id).toBeCloseTo(p * number(rateA), 12);
  expect([p, number(rateA), number(rateB)], q.id).not.toContain(posterior);
}

function checkMoments(q: Question): void {
  const [, values, masses, statistic] = q.promptLatex.match(/\\begin\{array\}\{c\|ccc\}x&(.*?)\\\\p\(x\)&(.*?)\\end\{array\}\\\\(.*?)\\end/s)!;
  const support = values.split("&").map(Number);
  const probabilities = masses.split("&").map(number);
  expect(probabilities.every(p => p > 0), q.id).toBe(true);
  expect(probabilities.reduce((sum, p) => sum + p, 0), q.id).toBeCloseTo(1, 12);
  const affine = statistic.match(/\((\d+)X\+(\d+)\)/);
  const xs = support.map(x => affine ? Number(affine[1]) * x + Number(affine[2]) : x);
  const mean = xs.reduce((sum, x, i) => sum + x * probabilities[i], 0);
  const expected = statistic === "E[X]" ? mean : xs.reduce((sum, x, i) => sum + (x - mean) ** 2 * probabilities[i], 0);
  expect(number(q.answer.latex), q.id).toBeCloseTo(expected, 10);
}

function checkBinomial(q: Question): void {
  const [, nText, pText, event, kText] = q.promptLatex.match(/^n=(\d+),\\quad p=(.*?),\\quad P\(X(=|\\ge |\\le )(\d+)\)$/)!;
  const n = Number(nText);
  const k = Number(kText);
  const p = number(pText);
  let pmf = [1];
  for (let i = 0; i < n; i++) {
    pmf = Array.from({ length: i + 2 }, (_, j) => (pmf[j] ?? 0) * (1 - p) + (pmf[j - 1] ?? 0) * p);
  }
  const expected = pmf.reduce((sum, mass, j) => {
    const include = event === "=" ? j === k : event === "\\ge " ? j >= k : j <= k;
    return sum + (include ? mass : 0);
  }, 0);
  expect(number(q.answer.latex), q.id).toBeCloseTo(expected, 12);
}

function checkContinuous(q: Question): void {
  const [, factor, polynomial, lower, upper] = q.promptLatex.match(/f\(x\)=(c|\\frac\{\d+\}\{\d+\}|\d+)(.*?),\\quad (\d+)<x<(\d+)/)!;
  const [, exponent, constant] = polynomial.replace(/\\left\(|\\right\)/g, "").match(/^x(?:\^\{(\d+)\})?(?:\+(\d+))?$/)!;
  const coefficient = number(factor === "c" ? q.answer.latex : factor);
  const f = (x: number) => coefficient * (x ** Number(exponent ?? 1) + Number(constant ?? 0));
  expect(integrate(f, Number(lower), Number(upper)), q.id).toBeCloseTo(1, 12);
  if (factor !== "c") {
    const [, a, b] = q.promptLatex.match(/P\((\d+)<X<(\d+)\)/)!;
    expect(number(q.answer.latex), q.id).toBeCloseTo(integrate(f, Number(a), Number(b)), 12);
  }
}

function checkTransformation(q: Question): void {
  const [, density, shift, signedScale, exponent, lo, hi] = q.promptLatex.match(/f_X\(x\)=(.*?),\\quad Y=(\d+)([+-]\d+)X(?:\^\{(\d+)\})?\\\\(\d+)<y<(\d+)/)!;
  const g = (x: number) => Number(shift) + Number(signedScale) * x ** Number(exponent ?? 1);
  const f = (x: number) => value(density, "x", x);
  const transformed = (y: number) => value(q.answer.latex, "y", y);
  expect([Number(lo), Number(hi)], q.id).toEqual([g(0), g(1)].sort((a, b) => a - b));
  expect(integrate(f, 0, 1), q.id).toBeCloseTo(1, 12);
  if (q.formId === "transformed_cdf") {
    for (const x of [0.25, 0.5, 0.75]) {
      const mass = Number(signedScale) > 0 ? integrate(f, 0, x) : integrate(f, x, 1);
      expect(transformed(g(x)), q.id).toBeCloseTo(mass, 10);
    }
  } else {
    const [a, b] = [g(0.25), g(0.75)].sort((a, b) => a - b);
    expect(integrate(transformed, a, b), q.id).toBeCloseTo(integrate(f, 0.25, 0.75), 10);
    expect(integrate(transformed, Number(lo), Number(hi)), q.id).toBeCloseTo(1, 10);
  }
}

const checks: Record<string, (q: Question) => void> = {
  permutations: checkCounting, combinations: checkCounting, conditional_draw: checkDraw, bayes: checkBayes,
  finite_moments: checkMoments, binomial_probability: checkBinomial, normalize_density: checkContinuous,
  density_probability: checkContinuous, transformed_cdf: checkTransformation, transformed_density: checkTransformation
};

describe("statistics foundation generators", () => {
  it("distinguishes an ordered finish from an unordered committee", () => {
    const { counting } = statisticsFoundationGenerators;
    for (const seed of [1, 2]) {
      const q = counting.generate(seed, "easy");
      const k = Number(q.promptLatex.match(/k=(\d+)/)![1]);
      let orders = 1;
      for (let i = 2; i <= k; i++) orders *= i;
      const wrong = number(q.answer.latex) * (q.formId === "permutations" ? 1 / orders : orders);
      expect(counting.validate(q, String(wrong)).correct).toBe(false);
    }
  });

  it("rejects using the original bag and reversing a conditional probability", () => {
    const generator = statisticsFoundationGenerators.conditional_probability;
    const draw = generator.generate(2, "easy");
    const [, r, b] = draw.promptLatex.match(/R=(\d+).*B=(\d+)/)!;
    const unconditioned = `\\frac{${r}}{${Number(r) + Number(b)}}`;
    expect(generator.validate(draw, unconditioned)).toMatchObject({ parseable: true, correct: false });
    const bayes = generator.generate(1, "medium");
    const likelihood = bayes.promptLatex.match(/P\(R\\mid A\)=(.*?)\\\\P/)!;
    expect(generator.validate(bayes, likelihood[1])).toMatchObject({ parseable: true, correct: false });
  });

  for (const generator of Object.values(statisticsFoundationGenerators)) {
    for (const difficulty of difficulties) {
      it(`independently checks ${generator.skillId} at ${difficulty} across 1,000 seeds`, () => {
        for (let seed = 1; seed <= 1_000; seed++) {
          const q = generator.generate(seed, difficulty);
          checks[q.formId](q);
          expect(q.workedSolution.at(-1), q.id).toContain(q.answer.latex);
        }
      });
    }
  }
});
