import { describe, expect, it } from "vitest";
import { proportionVarianceGenerators } from "../src/math/proportionVarianceTests";
import { formatPValue, readTestAnswer } from "../src/math/testAnswers";
import type { Difficulty, Question } from "../src/types";

function simpson(fn: (x: number) => number, upper: number): number {
  const parts = 240;
  const step = upper / parts;
  let sum = fn(0) + fn(upper);
  for (let i = 1; i < parts; i++) sum += (i % 2 ? 4 : 2) * fn(i * step);
  return sum * step / 3;
}

function gammaHalf(df: number): number {
  if (df === 1) return Math.sqrt(Math.PI);
  if (df === 2) return 1;
  return (df / 2 - 1) * gammaHalf(df - 2);
}

function alternative(q: Question): "left" | "right" | "two" {
  const expr = q.promptLatex.split("H_1:")[1].split(",")[0];
  return expr.includes("\\ne") ? "two" : expr.includes("<") ? "left" : "right";
}

function fromLower(q: Question, lower: number): number {
  const tail = alternative(q);
  return tail === "two" ? 2 * Math.min(lower, 1 - lower) : tail === "left" ? lower : 1 - lower;
}

function checkContinuous(q: Question, statistic: number, lower: number) {
  const record = q.referenceTable!.rows.find(([x]) => Math.abs(Number(x) - statistic) <= 5.1e-9);
  expect(record, q.id).toBeDefined();
  expect(Number(record![1]), q.id).toBeCloseTo(lower, 7);
  const reported = readTestAnswer(q.answer.latex)!;
  expect(reported.pValue, q.id).toBe(formatPValue(fromLower(q, Number(record![1]))));
  return fromLower(q, lower);
}

function rational(text: string): number {
  const fraction = /^\\frac\{(\d+)\}\{(\d+)\}$/.exec(text);
  return fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(text);
}

function proportions(q: Question): number {
  if (q.formId === "exact_binomial") {
    const n = Number(q.promptLatex.match(/n=(\d+)/)![1]);
    const observed = Number(q.promptLatex.match(/x=(\d+)/)![1]);
    const p0 = rational(q.promptLatex.match(/H_0:p=([^,]+)/)![1]);
    // Binomial recurrence from the mass of zero successes.
    let probability = (1 - p0) ** n;
    let tail = 0;
    const divisor = Number(q.referenceTable!.caption.match(/each weight by (\d+)/)![1]);
    for (let k = 0; k <= n; k++) {
      if (alternative(q) === "left" ? k <= observed : k >= observed) tail += probability;
      const row = q.referenceTable!.rows.find(([label]) => label === String(k));
      if (row) expect(Number(row[1]) / divisor, q.id).toBeCloseTo(probability, 12);
      probability *= (n - k) * p0 / ((k + 1) * (1 - p0));
    }
    return tail;
  }
  const pairs = [...q.promptLatex.matchAll(/=\((\d+),(\d+)\)/g)].map(m => [Number(m[1]), Number(m[2])]);
  const [[x, n], [y, m]] = pairs;
  const p = (x + y) / (n + m);
  expect(Math.min(n * p, n * (1 - p), m * p, m * (1 - p)), q.id).toBeGreaterThanOrEqual(10);
  const z = (x * m - y * n) / Math.sqrt(n * m * (n + m) * p * (1 - p));
  const normal = 0.5 + simpson(t => Math.exp(-t * t / 2) / Math.sqrt(2 * Math.PI), z);
  return checkContinuous(q, z, normal);
}

function variances(q: Question): number {
  if (q.formId === "one_variance") {
    const df = Number(q.promptLatex.match(/n=(\d+)/)![1]) - 1;
    const nullVariance = Number(q.promptLatex.match(/H_0:\\sigma\^2=(\d+)/)![1]);
    const s = q.promptLatex.match(/s\^2=(\d+)/);
    const sum = s ? df * Number(s[1]) : Number(q.promptLatex.match(/Q=(\d+)/)![1]);
    const chi = sum / nullVariance;
    // Integrate the density with x=t² to avoid fractional powers at zero.
    const constant = 2 / (2 ** (df / 2) * gammaHalf(df));
    const lower = simpson(t => constant * t ** (df - 1) * Math.exp(-t * t / 2), Math.sqrt(chi));
    expect(q.referenceTable!.caption, q.id).toContain(`df ${df}`);
    return checkContinuous(q, chi, lower);
  }
  const pairs = [...q.promptLatex.matchAll(/=\((\d+),(\d+)\)/g)].map(m => [Number(m[1]), Number(m[2])]);
  const [[n, v1], [m, v2]] = pairs;
  const ratio = Number(q.promptLatex.match(/H_0:\\rho=(\d+)/)![1]);
  const f = v1 / v2 / ratio;
  const df1 = n - 1, df2 = m - 1;
  expect(df1, q.id).not.toBe(df2);
  expect(q.referenceTable!.caption, q.id).toContain(`numerator df ${df1}, denominator df ${df2}`);
  // Beta-integral representation after the substitution t=sin²(theta).
  const density = (angle: number) => Math.sin(angle) ** (df1 - 1) * Math.cos(angle) ** (df2 - 1);
  const angle = Math.atan(Math.sqrt(f * df1 / df2));
  return checkContinuous(q, f, simpson(density, angle) / simpson(density, Math.PI / 2));
}

describe("proportion and variance tests", () => {
  it("preserves the fourth decimal when doubling the F upper tail at 12/7 with 11 and 24 degrees of freedom", () => {
    const q = proportionVarianceGenerators.variance_tests.generate(9725, "hard");
    expect(q.referenceTable!.caption).toContain("numerator df 11, denominator df 24");
    const table = q.referenceTable!;
    const entry = table.rows.find(([label]) => label === "1.71428571")!;
    expect(entry[1]).toBe("0.869625000094");
    for (const [x, area] of table.rows) {
      expect(x).toMatch(/^\d+\.\d{1,8}$/);
      expect(area).toMatch(/^0\.\d{12}$/);
    }
    expect(formatPValue(2 * (1 - Number(entry[1])))).toBe("0.2607");
    expect(readTestAnswer(q.answer.latex)!.pValue).toBe("0.2607");
    expect(q.workedSolution.join(" ")).toContain(entry[1]);
  });

  for (const difficulty of ["easy", "medium", "hard"] satisfies Difficulty[]) {
    it(`derives tails and decisions from the observations across 1,000 ${difficulty} seeds per topic`, () => {
      const decisions = new Map<string, Set<string>>();
      for (let seed = 1; seed <= 1_000; seed++) {
        for (const [key, generator] of Object.entries(proportionVarianceGenerators)) {
          const q = generator.generate(seed, difficulty);
          const p = key === "proportion_tests" ? proportions(q) : variances(q);
          const alpha = Number(q.promptLatex.match(/\\alpha=([\d.]+)/)![1]);
          const decision = p <= alpha ? "reject" : "fail_to_reject";
          expect(q.answer.testResult!.pValue, q.id).toBeCloseTo(p, 7);
          expect(q.answer.testResult!.alpha, q.id).toBe(alpha);
          expect(readTestAnswer(q.answer.latex)!.decision, q.id).toBe(decision);
          expect(Number(readTestAnswer(q.answer.latex)!.pValue) <= alpha, q.id).toBe(p <= alpha);
          expect(q.workedSolution.at(-1), q.id).toContain(q.answer.latex);
          const conclusion = q.workedConclusion!;
          expect(conclusion, q.id).toMatch(decision === "reject" ? /^The data support the claim that/ : /^There is insufficient evidence that/);
          expect(conclusion, q.id).toContain({ left: "is below", right: "is above", two: "differs from" }[alternative(q)]);
          const quantity = {
            exact_binomial: "success probability", pooled_proportions: "success probability in the first population",
            one_variance: "population variance", two_variances: "ratio of the first population variance to the second"
          }[q.formId];
          expect(conclusion, q.id).toContain(quantity);
          expect(conclusion, q.id).not.toMatch(/[\\{}]/);
          if (!decisions.has(q.formId)) decisions.set(q.formId, new Set());
          decisions.get(q.formId)!.add(decision);
        }
      }
      for (const outcomes of decisions.values()) expect(outcomes).toEqual(new Set(["reject", "fail_to_reject"]));
    });
  }
});
