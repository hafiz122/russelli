import { describe, expect, it } from "vitest";
import { theoryGenerators } from "../src/math/testingTheory";
import type { Difficulty, Question } from "../src/types";

type Rational = [number, number];
function rational(latex: string): Rational {
  const parts = /^\\frac\{(\d+)\}\{(\d+)\}$/.exec(latex);
  return parts ? [Number(parts[1]), Number(parts[2])] : [Number(latex), 1];
}

function exact(latex: string, numerator: bigint, denominator: bigint, id: string) {
  const [top, bottom] = rational(latex);
  expect(Number.isSafeInteger(top) && Number.isSafeInteger(bottom), id).toBe(true);
  expect(BigInt(top) * denominator, id).toBe(BigInt(bottom) * numerator);
}

// Enumerate binary strings and weight each independently by its success and failure counts.
const cache = new Map<string, bigint[]>();
function masses(n: number, [a, d]: Rational) {
  const key = `${n},${a},${d}`;
  if (!cache.has(key)) {
    const row = Array<bigint>(n + 1).fill(0n);
    for (let outcome = 0; outcome < 2 ** n; outcome++) {
      const k = outcome.toString(2).split("1").length - 1;
      row[k] += BigInt(a) ** BigInt(k) * BigInt(d - a) ** BigInt(n - k);
    }
    cache.set(key, row);
  }
  return cache.get(key)!;
}

function read(q: Question, key: string): Rational {
  const start = q.promptLatex.indexOf(key);
  if (start < 0) throw new Error(`Missing ${key} in ${q.promptLatex}`);
  const value = q.promptLatex.slice(start + key.length).match(/^(\\frac\{\d+\}\{\d+\}|\d+)/)![1];
  return rational(value);
}

function checkReference(q: Question, n: number, p: Rational) {
  const row = masses(n, p);
  const denominator = BigInt(p[1]) ** BigInt(n);
  const table = q.referenceTable!;
  const divisor = BigInt(table.caption.match(/each weight by (\d+)/)![1]);
  for (const [k, w] of table.rows) expect(BigInt(w) * denominator, q.id).toBe(row[Number(k)] * divisor);
}

function checkErrors(q: Question) {
  const n = read(q, "n=")[0];
  const p = read(q, q.formId === "actual_size" ? "H_0:p=" : "H_1:p=");
  const lo = q.promptLatex.match(/X\\le (\d+)/);
  const hi = q.promptLatex.match(/X\\ge (\d+)/);
  expect(Boolean(lo || hi), q.id).toBe(true);
  const beta = q.instruction.includes("Type II error");
  const total = BigInt(p[1]) ** BigInt(n);
  const rejected = masses(n, p).reduce((s, w, k) =>
    s + ((lo && k <= Number(lo[1])) || (hi && k >= Number(hi[1])) ? w : 0n), 0n);
  exact(q.answer.latex, beta ? total - rejected : rejected, total, q.id);
  checkReference(q, n, p);
}

function checkRatio(q: Question) {
  const n = read(q, "n=")[0];
  const p0 = read(q, "H_0:p=");
  const nullMass = masses(n, p0);
  const nullDen = BigInt(p0[1]) ** BigInt(n);
  if (q.formId === "neyman_pearson_cutoff") {
    const alternative = read(q, "H_1:p=");
    const altMass = masses(n, alternative);
    const ranked = Array.from({ length: n + 1 }, (_, k) => k).sort((i, j) =>
      Number(altMass[j] * nullMass[i] - altMass[i] * nullMass[j]));
    const [alphaTop, alphaBottom] = read(q, "\\alpha=");
    let weight = 0n;
    let boundary = -1;
    for (const k of ranked) {
      weight += nullMass[k];
      if (weight * BigInt(alphaBottom) === nullDen * BigInt(alphaTop)) {
        boundary = k;
        break;
      }
    }
    expect(boundary, q.id).toBeGreaterThanOrEqual(0);
    expect(q.answer.latex, q.id).toBe(String(boundary));
    checkReference(q, n, p0);
  } else {
    const x = read(q, "x=")[0];
    const maximum = masses(n, [x, n])[x];
    const ratioNumerator = nullMass[x] * BigInt(n) ** BigInt(n);
    const ratioDenominator = nullDen * maximum;
    expect(ratioNumerator > 0n && ratioNumerator < ratioDenominator, q.id).toBe(true);
    exact(q.answer.latex, ratioNumerator, ratioDenominator, q.id);
  }
}

describe("test size, power, and likelihood-ratio exercises", () => {
  for (const difficulty of ["easy", "medium", "hard"] satisfies Difficulty[]) {
    it(`checks exact rejection probabilities and likelihood orderings across 1,000 ${difficulty} seeds per topic`, () => {
      const targets = new Set<string>();
      for (let seed = 1; seed <= 1_000; seed++) {
        const q = theoryGenerators.errors_power.generate(seed, difficulty);
        checkErrors(q);
        targets.add(q.formId === "actual_size" ? "size" : q.instruction.includes("Type II") ? "beta" : "power");
        checkRatio(theoryGenerators.likelihood_ratio.generate(seed, difficulty));
      }
      expect(targets).toEqual(new Set(["size", "beta", "power"]));
    });
  }
});
