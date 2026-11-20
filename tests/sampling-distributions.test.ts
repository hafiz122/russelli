import { describe, expect, it } from "vitest";
import { samplingGenerators } from "../src/math/samplingDistributions";
import type { Difficulty, DistributionFamily, Question } from "../src/types";

const difficulties: Difficulty[] = ["easy", "medium", "hard"];
const tex = String.raw;

function number(latex: string): number {
  const rational = /^\\frac\{(-?\d+)\}\{(\d+)\}$/.exec(latex);
  return rational ? Number(rational[1]) / Number(rational[2]) : Number(latex);
}

function given(prompt: string, label: string): number {
  const start = prompt.indexOf(`${label}=`);
  if (start < 0) throw new Error(`Missing ${label} in ${prompt}`);
  return Number(prompt.slice(start + label.length + 1).match(/^-?\d+/)?.[0]);
}

function checkLaw(q: Question, family: DistributionFamily, ...parameters: number[]) {
  expect(q.answer.kind, q.id).toBe("distribution");
  expect(q.answer.distribution?.family, q.id).toBe(family);
  const actual = q.answer.distribution!.parameters.map(number);
  expect(actual.length, q.id).toBe(parameters.length);
  for (const [index, expected] of parameters.entries()) expect(actual[index], q.id).toBeCloseTo(expected, 10);
  expect(q.workedSolution.at(-1), q.id).toContain(q.answer.latex);
}

function checkSampleMeans(q: Question) {
  const n = given(q.promptLatex, "n");
  if (q.formId === "normal_mean") {
    const mean = given(q.promptLatex, tex`\mu`);
    let variance: number;
    if (q.promptLatex.includes(tex`\sigma^2=`)) variance = given(q.promptLatex, tex`\sigma^2`);
    else if (q.promptLatex.includes(tex`\sigma=`)) variance = given(q.promptLatex, tex`\sigma`) ** 2;
    else variance = given(q.promptLatex, "E[X_i^2]") - mean ** 2;
    expect(variance, q.id).toBeGreaterThan(0);
    expect(q.instruction, q.id).toMatch(/independent.*normal.*exact/);
    checkLaw(q, "normal", mean, variance / n);
    return;
  }

  // Reconstruct the population from the two probabilities the learner sees.
  const mass = [...q.promptLatex.matchAll(/P\(X_i=(-?\d+)\)=([^,]+)/g)]
    .map((match) => ({ x: Number(match[1]), p: number(match[2]) }));
  expect(mass, q.id).toHaveLength(2);
  expect(mass[0].p + mass[1].p, q.id).toBeCloseTo(1, 12);
  expect(n * Math.min(mass[0].p, mass[1].p), q.id).toBeGreaterThanOrEqual(24.999999);
  const mean = mass.reduce((sum, { x, p }) => sum + p * x, 0);
  const variance = mass.reduce((sum, { x, p }) => sum + p * (x - mean) ** 2, 0);
  const isSum = q.promptLatex.endsWith(tex`Y=\sum_{i=1}^n X_i`);
  if (!isSum) expect(q.promptLatex, q.id).toContain(tex`Y=\bar X`);
  expect(q.instruction, q.id).toMatch(/independent.*central limit theorem.*approximate/);
  expect(q.workedSolution.at(-1), q.id).toContain(tex`\approx`);
  checkLaw(q, "normal", isSum ? n * mean : mean, isSum ? n * variance : variance / n);
}

function checkOneSampleLaws(q: Question) {
  const n = given(q.promptLatex, "n");
  expect(n, q.id).toBeGreaterThan(1);
  expect(q.instruction, q.id).toMatch(/independent.*normal/);
  if (q.formId === "studentized_mean") {
    const statistics = [
      tex`T=\frac{\bar X-\mu}{S/\sqrt n}`,
      tex`T=\frac{\sqrt n(\bar X-\mu)}{S}`,
      tex`Q=\sum_{i=1}^n(X_i-\bar X)^2,\quad T=\frac{\bar X-\mu}{\sqrt{Q/[n(n-1)]}}`
    ];
    expect(statistics.some((form) => q.promptLatex.endsWith(form)), q.id).toBe(true);
    checkLaw(q, "t", n - 1);
    return;
  }
  const variance = given(q.promptLatex, tex`\sigma^2`);
  expect(variance, q.id).toBeGreaterThan(0);
  const statistics = [
    tex`V=\frac{(n-1)S^2}{${variance}}`,
    tex`Q=\sum_{i=1}^n(X_i-\bar X)^2,\quad V=Q/${variance}`,
    tex`M_2=\frac{1}{n}\sum_{i=1}^n X_i^2,\quad V=\frac{n(M_2-\bar X^2)}{${variance}}`
  ];
  expect(statistics.some((form) => q.promptLatex.endsWith(form)), q.id).toBe(true);
  checkLaw(q, "chi_square", n - 1);
}

function checkTwoSampleLaws(q: Question) {
  expect(q.instruction, q.id).toMatch(/independent random samples.*normal populations/);
  if (q.formId === "difference_of_means") {
    const samples = [...q.promptLatex.matchAll(/\)=\((-?\d+),(\d+),(\d+)\)/g)]
      .map((match) => match.slice(1).map(Number));
    expect(samples.length, q.id).toBe(2);
    expect(q.promptLatex.endsWith(tex`D=\bar X_1-\bar X_2`), q.id).toBe(true);
    let variance = 0;
    for (const [index, [, spread, n]] of samples.entries()) {
      const unitVariance = q.promptLatex.includes(tex`\sigma_${index + 1}^2`) ? spread : spread ** 2;
      // Each observation enters D with coefficient ±1/n.
      variance += n * (1 / n) ** 2 * unitVariance;
    }
    checkLaw(q, "normal", samples[0][0] - samples[1][0], variance);
    return;
  }
  const sizes = [given(q.promptLatex, "n_1"), given(q.promptLatex, "n_2")];
  expect(sizes[0], q.id).not.toBe(sizes[1]);
  const [first, second] = [...q.promptLatex.matchAll(/S_([12])\^2/g)].map((match) => Number(match[1]));
  expect([first, second].sort(), q.id).toEqual([1, 2]);
  if (!q.promptLatex.includes(tex`\sigma`)) {
    expect(q.instruction, q.id).toContain("equal variances");
  } else {
    const ratios = [
      tex`R=\frac{S_${first}^2/\sigma_${first}^2}{S_${second}^2/\sigma_${second}^2}`,
      tex`R=\frac{\sigma_${second}^2 S_${first}^2}{\sigma_${first}^2 S_${second}^2}`
    ];
    expect(ratios.some((ratio) => q.promptLatex.endsWith(ratio)), q.id).toBe(true);
  }
  checkLaw(q, "f", sizes[first - 1] - 1, sizes[second - 1] - 1);
}

describe("sampling-distribution generators", () => {
  for (const difficulty of difficulties) {
    it(`identifies the law and parameters from each displayed problem across 1,000 ${difficulty} seeds`, () => {
      for (let seed = 1; seed <= 1_000; seed++) {
        checkSampleMeans(samplingGenerators.sampling_distributions.generate(seed, difficulty));
        checkOneSampleLaws(samplingGenerators.one_sample_laws.generate(seed, difficulty));
        checkTwoSampleLaws(samplingGenerators.two_sample_laws.generate(seed, difficulty));
      }
    });
  }
});
