import { describe, expect, it } from "vitest";
import { generators } from "../src/math/generators";
import type { Difficulty, SkillId } from "../src/types";

const difficulties: Difficulty[] = ["easy", "medium", "hard"];
const topics: SkillId[] = ["vectors", "matrices", "linear_systems", "determinants_inverses", "eigen"];

function number(latex: string): number {
  const rational = latex.match(/^(-?)\\frac\{(-?\d+)\}\{(\d+)\}$/);
  return rational ? (rational[1] ? -1 : 1) * Number(rational[2]) / Number(rational[3]) : Number(latex);
}

function matrices(latex: string): number[][][] {
  return [...latex.matchAll(/\\begin\{bmatrix\}([\s\S]*?)\\end\{bmatrix\}/g)].map((match) =>
    match[1].split("\\\\").map((row) => row.split("&").map(number))
  );
}

function tuple(latex: string): number[] {
  return latex.replace(/[()]/g, "").split(",").map(number);
}

function product(left: number[][], right: number[][]): number[][] {
  return left.map((row) => right[0].map((_, column) => row.reduce((sum, value, index) => sum + value * right[index][column], 0)));
}

function determinant(m: number[][]): number {
  return m.length === 2
    ? m[0][0] * m[1][1] - m[0][1] * m[1][0]
    : m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

describe("linear algebra generators", () => {
  for (const difficulty of difficulties) {
    it(`has independently correct results for 1,000 seeds per topic at ${difficulty}`, () => {
      for (const skillId of topics) {
        for (let seed = 1; seed <= 1_000; seed += 1) {
          const q = generators[skillId].generate(seed, difficulty);
          expect(q.workedSolution.at(-1), q.id).toContain(q.answer.latex);
          expect(q.workedSolution.join(" "), q.id).not.toMatch(/NaN|Infinity|undefined/);
          const input = matrices(q.promptLatex);
          const output = matrices(q.answer.latex);
          const answer = tuple(q.answer.latex);
          switch (q.formId) {
            case "linear_combination": {
              const scale = Number(q.problemKey.split(",").at(-1));
              expect(answer, q.id).toEqual(input[0].map((row, i) => row[0] + scale * input[1][i][0]));
              break;
            }
            case "dot_product":
              expect(number(q.answer.latex), q.id).toBe(input[0].reduce((sum, row, i) => sum + row[0] * input[1][i][0], 0));
              break;
            case "addition":
              expect(output[0], q.id).toEqual(input[0].map((row, i) => row.map((value, j) => value + input[1][i][j])));
              break;
            case "multiplication":
              expect(output[0], q.id).toEqual(product(input[0], input[1]));
              break;
            case "solve_3x3": {
              const values = q.problemKey.split(":")[2].split(",").map(Number);
              const coefficients = [values.slice(0, 3), values.slice(3, 6), values.slice(6, 9)];
              const rights = [...q.promptLatex.matchAll(/=(-?\d+)/g)].map((match) => Number(match[1]));
              expect(rights, q.id).toEqual(product(coefficients, answer.map((value) => [value])).map((row) => row[0]));
              expect(determinant(coefficients), q.id).not.toBe(0);
              break;
            }
            case "rref_2x3": {
              const a = input[0];
              expect(determinant(a.map((row) => row.slice(0, 2))), q.id).not.toBe(0);
              expect(output[0], q.id).toEqual([[1, 0, output[0][0][2]], [0, 1, output[0][1][2]]]);
              expect(product(a.map((row) => row.slice(0, 2)), output[0].map((row) => [row[2]])), q.id)
                .toEqual(a.map((row) => [row[2]]));
              break;
            }
            case "determinant":
              expect(number(q.answer.latex), q.id).toBeCloseTo(determinant(input[0]), 10);
              break;
            case "inverse_2x2": {
              const both = product(input[0], output[0]);
              for (let row = 0; row < 2; row += 1) for (let col = 0; col < 2; col += 1) {
                expect(both[row][col], q.id).toBeCloseTo(row === col ? 1 : 0, 10);
              }
              break;
            }
            case "eigenvalues": {
              const [small, large] = answer;
              expect(small, q.id).toBeLessThan(large);
              expect(small + large, q.id).toBe(input[0][0][0] + input[0][1][1]);
              expect(small * large, q.id).toBeCloseTo(determinant(input[0]), 10);
              break;
            }
            case "eigenvector": {
              const lambda = Number(q.problemKey.split(",").at(-1));
              expect(answer, q.id).not.toEqual([0, 0]);
              product(input[0], answer.map((value) => [value])).forEach((row, i) => {
                expect(row[0], q.id).toBeCloseTo(lambda * answer[i], 10);
              });
              break;
            }
            default:
              throw new Error(`Unhandled form ${q.formId}`);
          }
        }
      }
    });
  }
});
