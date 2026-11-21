import { describe, expect, it } from "vitest";
import { meanTestGenerators } from "../src/math/meanTests";
import { readTestAnswer } from "../src/math/testAnswers";
import type { Difficulty, Question } from "../src/types";

type Tail = "left" | "right" | "two";
const levels: Difficulty[] = ["easy", "medium", "hard"];
const numeric = "(-?\\d+(?:\\.\\d+)?)";

function given(prompt: string, label: string): number {
  const start = prompt.indexOf(label);
  if (start < 0) throw new Error(`Missing ${label} in ${prompt}`);
  return Number(prompt.slice(start + label.length).match(new RegExp("^" + numeric))![1]);
}

function array(latex: string, label: string): number[] {
  const start = latex.indexOf(label) + label.length;
  return latex.slice(start).match(/^[\d.&-]+/)![0].split("&").map(Number);
}

function mean(data: number[]): number {
  return data.reduce((a, b) => a + b, 0) / data.length;
}

function checkGivens(q: Question): { statistic: number; df?: number; tail: Tail } {
  const prompt = q.promptLatex;
  if (q.skillId === "hypothesis_testing") {
    expect(prompt, q.id).not.toContain("H_a");
    const two = q.formId === "two_sided_claim";
    const tail = two ? "two" : q.instruction.includes("below the reference") || q.instruction.includes("longer on average than A") ? "left" : "right";
    if (q.difficulty === "medium") {
      return { statistic: (given(prompt, "\\bar x=") - given(prompt, "\\mu_0=")) / given(prompt, "\\operatorname{SE}(\\bar X)="), tail };
    }
    if (q.difficulty === "easy") return { statistic: given(prompt, "z_{\\mathrm{obs}}="), tail };
    return { statistic: given(prompt, "t_{\\mathrm{obs}}="), df: given(prompt, "\\nu="), tail };
  }
  const hypothesis = prompt.match(/H_a:(.*?)(?:,\\quad|\\\\)/)![1];
  const tail = hypothesis.includes("\\ne") ? "two" : hypothesis.includes("<") ? "left" : "right";
  if (q.skillId === "one_sample_tests") {
    const n = given(prompt, "n=");
    const target = given(prompt, "H_0:\\mu=");
    const xbar = q.difficulty === "hard" ? given(prompt, "\\sum x_i=") / n : given(prompt, "\\bar x=");
    const known = q.formId === "known_sigma";
    const symbol = known ? "\\sigma" : "s";
    let variance: number;
    if (q.difficulty === "easy") variance = given(prompt, symbol + "=") ** 2;
    else if (!known && q.difficulty === "hard") variance = given(prompt, "\\sum(x_i-\\bar x)^2=") / (n - 1);
    else variance = given(prompt, symbol + "^2=");
    return { tail, statistic: (xbar - target) / Math.sqrt(variance / n), df: known ? undefined : n - 1 };
  }
  if (q.formId === "paired_t") {
    let differences: number[];
    if (q.difficulty === "easy") {
      const n = given(prompt, "n=");
      return { tail, statistic: given(prompt, "\\bar d=") / Math.sqrt(given(prompt, "s_D^2=") / n), df: n - 1 };
    }
    if (q.difficulty === "medium") {
      differences = prompt.match(/d_i:\\quad ([\d.,\\ -]+)/)![1].split(",").map(v => Number(v.replace(/\\/g, "").trim()));
    } else {
      const before = array(prompt, "\\text{Before}&");
      const after = array(prompt, "\\text{After}&");
      expect([...before, ...after].every(t => t > 0), q.id).toBe(true);
      differences = after.map((time, i) => time - before[i]);
    }
    const n = differences.length;
    const center = mean(differences);
    const ss = differences.reduce((sum, v) => sum + (v - center) ** 2, 0);
    return { tail, statistic: center / Math.sqrt(ss / ((n - 1) * n)), df: n - 1 };
  }
  const groups = [...prompt.matchAll(/=\((\d+),(-?[\d.]+),(\d+)\)/g)].map(match => match.slice(1).map(Number));
  const [[nA, meanA, spreadA], [nB, meanB, spreadB]] = groups;
  expect(Math.min(meanA, meanB), q.id).toBeGreaterThan(0);
  const target = given(prompt, "H_0:\\mu_A-\\mu_B=");
  const df = nA + nB - 2;
  const pooled = q.difficulty === "hard" ? (spreadA + spreadB) / df : ((nA - 1) * spreadA + (nB - 1) * spreadB) / df;
  expect(pooled, q.id).toBeGreaterThan(0);
  if (q.difficulty !== "easy") expect(nA, q.id).not.toBe(nB);
  return { tail, statistic: (meanA - meanB - target) / Math.sqrt(pooled * (1 / nA + 1 / nB)), df };
}

// A trigonometric substitution in the t-density gives an integral of cos(theta)^(df−1).
function cosIntegral(m: number, angle: number): number {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  let integral = m % 2 === 0 ? angle : sin;
  for (let k = m % 2 + 2; k <= m; k += 2) integral = (sin * cos ** (k - 1) + (k - 1) * integral) / k;
  return integral;
}

function independentCdf(x: number, df?: number): number {
  if (df !== undefined) {
    const angle = Math.atan(x / Math.sqrt(df));
    return 0.5 + cosIntegral(df - 1, angle) / (2 * cosIntegral(df - 1, Math.PI / 2));
  }
  const step = x / 128;
  let sum = 1 + Math.exp(-x * x / 2);
  for (let i = 1; i < 128; i++) sum += (i % 2 ? 4 : 2) * Math.exp(-((i * step) ** 2) / 2);
  return 0.5 + sum * step / (3 * Math.sqrt(2 * Math.PI));
}

describe("hypotheses, one-sample tests and comparing means", () => {
  it("checks independent CDF oracles against normal and Cauchy reference values", () => {
    expect(independentCdf(1.96)).toBeCloseTo(0.97500210485, 9);
    expect(independentCdf(-1, 1)).toBeCloseTo(0.25, 12);
    expect(independentCdf(2.22813885, 10)).toBeCloseTo(0.975, 7);
  });
  for (const generator of Object.values(meanTestGenerators)) {
    for (const difficulty of levels) {
      it(`recovers ${generator.skillId} statistics, tails and decisions from the givens for 1,000 ${difficulty} seeds`, () => {
        const tails = new Set<Tail>();
        const outcomes = new Map<string, Set<string>>();
        for (let seed = 1; seed <= 1000; seed++) {
          const q = generator.generate(seed, difficulty);
          const { statistic, df, tail } = checkGivens(q);
          const table = q.referenceTable!;
          const row = table.rows.find(([x]) => Math.abs(Number(x) - statistic) < 1e-8);
          expect(row, q.id).toBeDefined();
          const lower = independentCdf(statistic, df);
          expect(Number(row![1]), q.id).toBeCloseTo(lower, 8);
          if (df !== undefined) expect(table.caption, q.id).toContain(`df ${df})`);
          else expect(table.caption, q.id).toContain("Standard normal");
          const expected = tail === "left" ? lower : tail === "right" ? 1 - lower : 2 * Math.min(lower, 1 - lower);
          const alpha = given(q.promptLatex, "\\alpha=");
          const accepted = q.answer.testResult!;
          expect(accepted.alpha, q.id).toBe(alpha);
          expect(accepted.pValue, q.id).toBeCloseTo(expected, 8);
          expect(Math.abs(expected - alpha), q.id).toBeGreaterThan(0.001);
          const response = readTestAnswer(q.answer.latex)!;
          const decision = expected <= alpha ? "reject" : "fail_to_reject";
          expect(response, q.id).toEqual({ pValue: expected.toFixed(4), decision });
          expect(q.workedSolution[0], q.id).toMatch(/^H_0:/);
          expect(q.workedSolution[1], q.id).toMatch(/^H_a:/);
          const rule = q.workedSolution.at(-1);
          expect(rule, q.id).toContain(decision === "reject" ? "p\\le\\alpha" : "p>\\alpha");
          expect(rule, q.id).toContain(decision === "reject" ? "\\text{Reject }H_0" : "\\text{Fail to reject }H_0");
          expect(q.workedConclusion, q.id).toContain(decision === "reject" ? "Evidence supports" : "Insufficient evidence for");
          expect(q.workedSolution.join(" "), q.id).not.toContain(q.workedConclusion!);
          tails.add(tail);
          if (!outcomes.has(q.formId)) outcomes.set(q.formId, new Set());
          outcomes.get(q.formId)!.add(decision);
        }
        expect(tails.has("left") && tails.has("right")).toBe(true);
        if (difficulty !== "easy" || generator.skillId === "hypothesis_testing") expect(tails.has("two")).toBe(true);
        for (const outcomesForForm of outcomes.values()) expect(outcomesForForm.size).toBe(2);
      });
    }
  }
});
