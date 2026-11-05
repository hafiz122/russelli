import { describe, expect, it } from "vitest";
import { chooseSkill, recordAttempt } from "../src/state/adaptive";
import { applyRewardEvent } from "../src/state/rewards";
import { createDefaultProgress, loadProgress, saveProgress } from "../src/state/storage";
import type { Attempt } from "../src/types";

function answer(seed: number, presentationId: string, calibrationIndex: number | null = null, overrides: Partial<Attempt> = {}): Attempt {
  return {
    questionId: `expressions:easy:${seed}`, presentationId, calibrationIndex,
    seed, skillId: "expressions", difficulty: "easy", rawLatex: "2x", normalizedAnswer: "2x",
    correct: true, attemptCount: 1, solutionRevealed: false,
    timestamp: "2026-11-05T00:00:00.000Z", ...overrides
  };
}

describe("calibration presentation slots", () => {
  it("consumes a shared calibration slot once while retaining both answers' rewards", () => {
    let progress = recordAttempt(createDefaultProgress(), answer(1, "tab-a", 0));
    progress = recordAttempt(progress, answer(2, "tab-b", 0));
    expect(progress.calibrationIndex).toBe(1);
    expect(chooseSkill(progress)).toBe("linear");
    expect(progress).toMatchObject({ totalPoints: 20, currentStreak: 2, calibrationCompleted: false });
    expect(progress.mastery.expressions).toBeCloseTo(0.51);
    expect(progress.recentAttempts).toHaveLength(2);
  });

  it("does not let a stale retry consume the next slot", () => {
    let progress = recordAttempt(createDefaultProgress(), answer(1, "tab-a", 0, { correct: false }));
    progress = recordAttempt(progress, answer(2, "tab-b", 0));
    progress = recordAttempt(progress, answer(1, "tab-a", 0, { attemptCount: 2 }));
    expect(progress.calibrationIndex).toBe(1);
    expect(progress.totalPoints).toBe(20);
    expect(progress.mastery.expressions).toBeCloseTo(0.40);
  });

  it("does not let a stale solution completion consume the next slot", () => {
    let progress = recordAttempt(createDefaultProgress(), answer(1, "tab-a", 0));
    progress = recordAttempt(progress, answer(2, "tab-b", 0, { correct: false, solutionRevealed: true }));
    expect(progress.calibrationIndex).toBe(1);
    expect(progress.totalPoints).toBe(10);
  });

  it("advances the current slot for a solution completion", () => {
    const progress = recordAttempt(createDefaultProgress(), answer(1, "tab-a", 0, { correct: false, solutionRevealed: true }));
    expect(progress.calibrationIndex).toBe(1);
    expect(progress.totalPoints).toBe(0);
  });

  it("does not consume a slot for a question presented outside calibration", () => {
    expect(recordAttempt(createDefaultProgress(), answer(1, "adaptive", null)).calibrationIndex).toBe(0);
  });

  it("does not infer a displayed slot from legacy attempt data", () => {
    const { calibrationIndex, ...legacy } = answer(1, "legacy");
    expect(recordAttempt(createDefaultProgress(), legacy).calibrationIndex).toBe(0);
  });
});

describe("reward presentation identities", () => {
  it.each([{ order: [0, 1, 2] }, { order: [0, 2, 1] }])("rewards equal content in separate presentations in order $order", ({ order }) => {
    const answers = [answer(1, "tab-a"), answer(1, "tab-b"), answer(2, "tab-c")];
    let progress = createDefaultProgress();
    for (const index of order) progress = recordAttempt(progress, answers[index]);
    expect(progress).toMatchObject({ totalPoints: 30, currentStreak: 3, bestStreak: 3 });
    expect(new Set(progress.recentAttempts.map((attempt) => attempt.presentationId)).size).toBe(3);
  });

  it.each(["reveal_solution", "skip"] as const)("does not transfer %s eligibility to a separate presentation", (type) => {
    let progress = applyRewardEvent(createDefaultProgress(), {
      type, questionId: answer(1, "tab-a").questionId, presentationId: "tab-a"
    });
    progress = recordAttempt(progress, answer(1, "tab-b"));
    expect(progress).toMatchObject({ totalPoints: 10, currentStreak: 1 });
  });

  it("persists presentation identity and blocks duplicate submissions after reload", () => {
    const progress = recordAttempt(createDefaultProgress(), answer(1, "tab-a"));
    saveProgress(progress);
    const loaded = loadProgress().progress;
    expect(loaded.rewardQuestion?.presentationId).toBe("tab-a");
    expect(recordAttempt(loaded, answer(1, "tab-a"))).toMatchObject({ totalPoints: 10, currentStreak: 1 });
    expect(recordAttempt(loaded, answer(1, "tab-b"))).toMatchObject({ totalPoints: 20, currentStreak: 2 });
  });

  it("retains legacy reward records without blocking a newly presented question", () => {
    const { presentationId, ...legacy } = answer(1, "legacy");
    const progress = recordAttempt(createDefaultProgress(), legacy);
    saveProgress(progress);
    const loaded = loadProgress().progress;
    expect(loaded.rewardQuestion).toEqual({ questionId: legacy.questionId, status: "awarded" });
    expect(recordAttempt(loaded, answer(1, "new-run"))).toMatchObject({ totalPoints: 20, currentStreak: 2 });
  });
});
