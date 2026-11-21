import type { Difficulty, Question } from "../types";
import type { SeededRandom } from "./rng";

export type Outcome = "CLO1" | "CLO2" | "CLO3";
export type Chapter = 1 | 2 | 3 | 4 | 5;
export type CalculusProblem = Pick<Question,
  "instruction" | "promptLatex" | "answer" | "hints" | "workedSolution" | "workedConclusion" | "promptDescription">;

export function topic(
  chapter: Chapter,
  title: string,
  forms: readonly [string, string],
  outcomes: readonly [Outcome, Outcome],
  generate: (form: 0 | 1, rng: SeededRandom, difficulty: Difficulty) => CalculusProblem
) {
  return { chapter, title, forms, outcomes, generate };
}
