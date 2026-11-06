import { describe, expect, it } from "vitest";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { skillIds } from "../src/data/skills";
import { formIds, generators } from "../src/math/generators";
import type { Difficulty } from "../src/types";

const difficulties: Difficulty[] = ["easy", "medium", "hard"];
const ce = new ComputeEngine();

describe("deterministic question generators", () => {
  for (const difficulty of difficulties) {
    it(`rational ${difficulty} solutions satisfy the original equation across 1,000 seeds`, () => {
      for (let seed = 1; seed <= 1_000; seed += 2) {
        const question = generators.rational.generate(seed, difficulty);
        const equation = question.promptLatex.match(/^\\frac\{(-?\d+)\}\{x([+-]\d+)\}=(-?\d+)$/);
        expect(equation, question.id).not.toBeNull();
        const [, numerator, shift, multiplier] = equation!;
        const denominator = Number(question.answer.latex) + Number(shift);

        expect(denominator, `${question.id} solution must be in the domain`).not.toBe(0);
        expect(Number(numerator) / denominator, question.id).toBe(Number(multiplier));
      }
    });
  }

  it("shows the negative input as the base when squaring in a composition solution", () => {
    const question = generators.functions.generate(4, "easy");

    expect(question.workedSolution[0]).toBe("g(-5)=(-5)^2-4=21");
  });

  for (const skillId of skillIds) {
    for (const difficulty of difficulties) {
      it(`${skillId} ${difficulty} is reproducible and solvable across 1,000 seeds`, () => {
        const generator = generators[skillId];

        for (let seed = 1; seed <= 1_000; seed += 1) {
          const first = generator.generate(seed, difficulty);
          const second = generator.generate(seed, difficulty);
          const changedGenerator = skillId === "expressions" || skillId === "polynomials";

          expect(second).toEqual(first);
          expect(first.id).toBe(changedGenerator
            ? `${skillId}:v2:${difficulty}:${seed}`
            : `${skillId}:${difficulty}:${seed}`);
          expect(first.seed).toBe(seed);
          expect(first.generatorVersion).toBe(changedGenerator ? 2 : 1);
          expect(first.formId).toBe(formIds[skillId][seed % 2]);
          expect(first.problemKey).toContain(`${skillId}:${first.formId}:`);
          expect(first.promptLatex).not.toMatch(/NaN|Infinity|undefined/);
          expect(first.answer.latex).not.toMatch(/NaN|Infinity|undefined/);
          expect(first.hints.length).toBeGreaterThan(0);
          expect(first.workedSolution.length).toBeGreaterThan(0);

          const result = generator.validate(first, first.answer.latex);
          expect(result.parseable, `${first.id} answer should parse`).toBe(true);
          expect(result.correct, `${first.id} should accept its exact answer ${first.answer.latex}`).toBe(true);
        }
      });
    }
  }

  it("canonically identifies commutative problems with swapped operands", () => {
    for (const skillId of ["polynomials", "exponents_radicals"] as const) {
      const seen = new Map<string, string>();
      let foundSwappedPrompt = false;
      for (let seed = 1; seed <= 1_000; seed += 2) {
        const question = generators[skillId].generate(seed, "easy");
        const earlierPrompt = seen.get(question.problemKey);
        if (earlierPrompt && earlierPrompt !== question.promptLatex) {
          foundSwappedPrompt = true;
          break;
        }
        seen.set(question.problemKey, question.promptLatex);
      }
      expect(foundSwappedPrompt, `${skillId} should identify swapped operands`).toBe(true);
    }
  });

  for (const difficulty of difficulties) {
    it(`new ${difficulty} forms give mathematically correct answers across 500 seeds each`, () => {
      for (let seed = 2; seed <= 1_000; seed += 2) {
        const evaluation = generators.expressions.generate(seed, difficulty);
        const match = evaluation.promptLatex.match(/^p\(x\)=(.*),\\quad p\((-?\d+)\)$/);
        expect(match, evaluation.id).not.toBeNull();
        const calculated = ce.parse(match![1]).subs({ x: Number(match![2]) }).simplify();
        expect(calculated.is(ce.parse(evaluation.answer.latex)), evaluation.id).toBe(true);

        const addition = generators.polynomials.generate(seed, difficulty);
        const sum = ce.parse(addition.promptLatex).simplify();
        expect(sum.isIdenticallyEqual(ce.parse(addition.answer.latex)), addition.id).toBe(true);
      }
    });
  }
});
