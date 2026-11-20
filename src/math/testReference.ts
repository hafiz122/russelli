import { erfc } from "@cortex-js/compute-engine/numerics";
import type { ReferenceTable } from "../types";

export type ReferenceLaw =
  | { family: "normal" }
  | { family: "t" | "chi_square"; df: number }
  | { family: "f"; df1: number; df2: number };

// The degrees of freedom in these exercises are integers, so both beta
// parameters can be reached in whole steps from 1/2 or 1 (DLMF §8.17(iv)).
function betaProbability(x: number, targetA: number, targetB: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let a = Number.isInteger(targetA) ? 1 : 0.5;
  let b = Number.isInteger(targetB) ? 1 : 0.5;
  let probability: number;
  let beta: number;
  if (a === 0.5 && b === 0.5) {
    probability = 2 * Math.asin(Math.sqrt(x)) / Math.PI;
    beta = Math.PI;
  } else if (a === b) {
    probability = x;
    beta = 1;
  } else {
    probability = a === 0.5 ? Math.sqrt(x) : x / (1 + Math.sqrt(1 - x));
    beta = 2;
  }
  let term = x ** a * (1 - x) ** b / beta;
  while (a < targetA) {
    probability -= term / a;
    term *= x * (a + b) / a;
    a++;
  }
  while (b < targetB) {
    probability += term / b;
    term *= (1 - x) * (a + b) / b;
    b++;
  }
  return probability;
}

function chiSquareProbability(x: number, df: number): number {
  if (x <= 0) return 0;
  const y = x / 2;
  let shape = df % 2 === 0 ? 1 : 0.5;
  let upper = shape === 1 ? Math.exp(-y) : erfc(Math.sqrt(y));
  let term = Math.exp(-y) * (shape === 1 ? y : 2 * Math.sqrt(y / Math.PI));
  while (shape < df / 2) {
    upper += term;
    shape++;
    term *= y / shape;
  }
  return 1 - upper;
}

function lowerTail(law: ReferenceLaw, x: number): number {
  switch (law.family) {
    case "normal":
      return erfc(-x / Math.SQRT2) / 2;
    case "t": {
      if (x === 0) return 0.5;
      const smallerTail = betaProbability(law.df / (law.df + x * x), law.df / 2, 0.5) / 2;
      return x < 0 ? smallerTail : 1 - smallerTail;
    }
    case "chi_square":
      return chiSquareProbability(x, law.df);
    case "f":
      return x <= 0 ? 0 : betaProbability(law.df1 * x / (law.df1 * x + law.df2), law.df1 / 2, law.df2 / 2);
  }
}

const lawLabels = {
  normal: ["Standard normal", "z", "P(Z ≤ z)"],
  t: ["Student’s t", "t", "P(T ≤ t)"],
  chi_square: ["Chi-square", "x", "P(χ² ≤ x)"],
  f: ["F distribution", "f", "P(F ≤ f)"]
} as const;

export function referenceFor(law: ReferenceLaw, statistic: number, areaDigits = 9): { lower: number; table: ReferenceTable } {
  const [name, header, area] = lawLabels[law.family];
  const degrees = law.family === "f" ? ` (numerator df ${law.df1}, denominator df ${law.df2})`
    : law.family === "normal" ? "" : ` (df ${law.df})`;
  const positiveSupport = law.family === "chi_square" || law.family === "f";
  const step = positiveSupport && statistic > 0 ? Math.min(0.25, statistic / 3) : 0.25;
  const observedIndex = positiveSupport && statistic === 0 ? 0 : Math.abs(Math.round(statistic * 1000)) % 3;
  const probability = (x: number) => Math.max(0, Math.min(1, lowerTail(law, x)));
  const rows = [0, 1, 2].map(index => {
    const x = statistic + (index - observedIndex) * step;
    return [String(Number(x.toFixed(8))), probability(x).toFixed(areaDigits)];
  });
  return {
    lower: probability(statistic),
    table: { caption: `${name}${degrees} lower-tail probabilities`, headers: [header, area], rows }
  };
}
