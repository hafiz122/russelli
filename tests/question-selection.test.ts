import { describe, expect, it } from "vitest";
import { formIds, generateQuestion } from "../src/math/generators";
import { selectQuestion } from "../src/state/questionSelection";
import type { Question, RecentPresentation, SkillId } from "../src/types";

function presentation(question: Question, presentationId: string): RecentPresentation {
  return {
    presentationId,
    questionId: question.id,
    seed: question.seed,
    skillId: question.skillId,
    difficulty: question.difficulty,
    calibrationIndex: null,
    formId: question.formId,
    problemKey: question.problemKey,
    answerKey: `${question.answer.kind}:${question.answer.latex}`
  };
}

function select(
  skillId: SkillId,
  recentPresentations: RecentPresentation[] = [],
  previousFormId: string | null = null,
  randomUint32: () => number = () => 0
) {
  return selectQuestion({
    skillId,
    difficulty: "easy",
    recentPresentations,
    previousFormId,
    presentationId: `display-${recentPresentations.length}`,
    randomUint32
  });
}

describe("question selection", () => {
  it("alternates forms within a tab for every topic", () => {
    for (const skillId of Object.keys(formIds) as SkillId[]) {
      const first = select(skillId);
      const second = select(skillId, [first.presentation], first.question.formId);
      const third = select(skillId, [first.presentation, second.presentation], second.question.formId);

      expect(second.question.formId, skillId).not.toBe(first.question.formId);
      expect(third.question.formId, skillId).toBe(first.question.formId);
    }
  });

  it("uses the latest stored form on first load when a tab has no prior form", () => {
    const shown = generateQuestion("linear", 2, "easy");
    const next = select("linear", [presentation(shown, "shown")]);
    expect(next.question.formId).toBe(formIds.linear[1]);
  });

  it("prioritizes the tab's last form over another tab's latest form", () => {
    const local = generateQuestion("linear", 2, "easy");
    const otherTab = generateQuestion("linear", 3, "easy");
    const next = select("linear", [presentation(local, "local"), presentation(otherTab, "other")], local.formId);
    expect(next.question.formId).toBe(otherTab.formId);
  });

  it("avoids a displayed mathematical duplicate from another seed", () => {
    const firstCandidate = generateQuestion("exponents_radicals", 2, "easy");
    const next = select("exponents_radicals", [presentation(firstCandidate, "shown")], formIds.exponents_radicals[1]);
    expect(next.question.formId).toBe(firstCandidate.formId);
    expect(next.question.problemKey).not.toBe(firstCandidate.problemKey);
  });

  it("prefers an answer absent from the last four displays of the topic", () => {
    const firstCandidate = generateQuestion("linear", 2, "easy");
    let prior: Question | undefined;
    for (let seed = 34; seed < 2_000; seed += 2) {
      const candidate = generateQuestion("linear", seed, "easy");
      if (candidate.answer.latex === firstCandidate.answer.latex && candidate.problemKey !== firstCandidate.problemKey) {
        prior = candidate;
        break;
      }
    }
    expect(prior).toBeDefined();
    const next = select("linear", [presentation(prior!, "prior")], formIds.linear[1]);
    expect(next.question.answer.latex).not.toBe(firstCandidate.answer.latex);
  });

  it("draws a bounded set of distinct candidate seeds and falls back to the oldest repeat", () => {
    const candidates = Array.from({ length: 16 }, (_, index) => generateQuestion("linear", 2 * (index + 1), "easy"));
    const history = candidates.map((question, index) => presentation(question, `shown-${index}`));
    let draws = 0;
    const selected = select("linear", history, formIds.linear[1], () => {
      draws += 1;
      return 0;
    });
    const lastSeen = (question: Question) => {
      for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index].problemKey === question.problemKey) return index;
      }
      return -1;
    };
    const expectedIndex = Math.min(...candidates.map(lastSeen));

    expect(lastSeen(selected.question)).toBe(expectedIndex);
    expect(draws).toBe(17);
  });
});
