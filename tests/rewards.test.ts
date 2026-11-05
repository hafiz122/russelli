import { describe, expect, it } from "vitest";
import { recordAttempt } from "../src/state/adaptive";
import { applyRewardEvent } from "../src/state/rewards";
import { clearProgress, createDefaultProgress, loadProgress, saveProgress } from "../src/state/storage";
import type { Attempt } from "../src/types";
import { skillIds } from "../src/data/skills";

function answer(index: number, overrides: Partial<Attempt> = {}): Attempt {
  return {
    questionId: `expressions:easy:${index}`,
    seed: index,
    skillId: "expressions",
    difficulty: "easy",
    rawLatex: "2x",
    normalizedAnswer: "2x",
    correct: true,
    attemptCount: 1,
    solutionRevealed: false,
    timestamp: "2026-11-05T00:00:00.000Z",
    ...overrides
  };
}

describe("points and correct-answer streaks", () => {
  it("starts with zero rewards", () => {
    expect(createDefaultProgress()).toMatchObject({ totalPoints: 0, currentStreak: 0, bestStreak: 0 });
  });

  it("awards ten points per answer and ten extra at each fifth answer", () => {
    let progress = createDefaultProgress();
    for (let index = 1; index <= 10; index++) {
      progress = recordAttempt(progress, answer(index));
      expect(progress.totalPoints).toBe(index * 10 + Math.floor(index / 5) * 10);
      expect(progress.currentStreak).toBe(index);
      expect(progress.bestStreak).toBe(index);
    }
  });

  it("resets on a mistake and rewards a correct retry", () => {
    let progress = recordAttempt(createDefaultProgress(), answer(1));
    progress = recordAttempt(progress, answer(2, { correct: false }));
    expect(progress).toMatchObject({ totalPoints: 10, currentStreak: 0, bestStreak: 1 });
    progress = recordAttempt(progress, answer(2, { attemptCount: 2 }));
    expect(progress).toMatchObject({ totalPoints: 20, currentStreak: 1, bestStreak: 1 });
  });

  it("allows hints and rewards every topic and difficulty during calibration", () => {
    for (const skillId of skillIds) {
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        const progress = recordAttempt(createDefaultProgress(), answer(1, { skillId, difficulty, attemptCount: 2 }));
        expect(progress).toMatchObject({ totalPoints: 10, currentStreak: 1, calibrationCompleted: false });
        const adaptive = recordAttempt({ ...progress, calibrationCompleted: true }, answer(2, { skillId, difficulty }));
        expect(adaptive).toMatchObject({ totalPoints: 20, currentStreak: 2 });
      }
    }
  });

  it("cannot award the same question twice, even after saving and loading", () => {
    let progress = recordAttempt(createDefaultProgress(), answer(1));
    saveProgress(progress);
    progress = recordAttempt(loadProgress().progress, answer(1));
    expect(progress).toMatchObject({ totalPoints: 10, currentStreak: 1, bestStreak: 1 });
  });

  it("awards nothing after a worked solution", () => {
    let progress = recordAttempt(createDefaultProgress(), answer(1));
    progress = applyRewardEvent(progress, { type: "reveal_solution", questionId: answer(2).questionId });
    progress = recordAttempt(progress, answer(2, { solutionRevealed: true }));
    expect(progress).toMatchObject({ totalPoints: 10, currentStreak: 0, bestStreak: 1 });
  });

  it("keeps a later streak when accepting an already revealed question", () => {
    let progress = applyRewardEvent(createDefaultProgress(), { type: "reveal_solution", questionId: answer(1).questionId });
    progress = recordAttempt(progress, answer(2));
    progress = recordAttempt(progress, answer(1, { solutionRevealed: true }));
    expect(progress).toMatchObject({ totalPoints: 10, currentStreak: 1, bestStreak: 1 });
  });

  it("resets immediately on a solution reveal and retains ineligibility after reload", () => {
    const before = recordAttempt(createDefaultProgress(), answer(1));
    const revealed = applyRewardEvent(before, { type: "reveal_solution", questionId: answer(2).questionId });
    expect(before.currentStreak).toBe(1);
    expect(revealed).toMatchObject({ totalPoints: 10, currentStreak: 0, bestStreak: 1 });
    saveProgress(revealed);
    const solved = recordAttempt(loadProgress().progress, answer(2));
    expect(solved).toMatchObject({ totalPoints: 10, currentStreak: 0, bestStreak: 1 });
  });

  it("does not change rewards when viewing an accepted answer's solution", () => {
    const progress = recordAttempt(createDefaultProgress(), answer(1));
    expect(applyRewardEvent(progress, { type: "reveal_solution", questionId: answer(1).questionId })).toBe(progress);
  });

  it("resets on skip and cannot reward a late submission for the skipped question", () => {
    const progress = applyRewardEvent(recordAttempt(createDefaultProgress(), answer(1)), {
      type: "skip", questionId: answer(2).questionId
    });
    expect(progress).toMatchObject({ totalPoints: 10, currentStreak: 0, bestStreak: 1 });
    expect(recordAttempt(progress, answer(2))).toMatchObject({ totalPoints: 10, currentStreak: 0 });
    expect(recordAttempt(progress, answer(3))).toMatchObject({ totalPoints: 20, currentStreak: 1 });
  });

  it("ignores unparseable input", () => {
    const progress = recordAttempt(createDefaultProgress(), answer(1));
    expect(applyRewardEvent(progress, {
      type: "answer", questionId: answer(2).questionId, parseable: false, correct: false
    })).toBe(progress);
  });

  it("keeps cumulative rewards after the attempt history is trimmed", () => {
    let progress = createDefaultProgress();
    for (let index = 1; index <= 100; index++) progress = recordAttempt(progress, answer(index));
    expect(progress.recentAttempts).toHaveLength(80);
    expect(progress).toMatchObject({ totalPoints: 1200, currentStreak: 100, bestStreak: 100 });
    saveProgress(progress);
    expect(loadProgress().progress).toEqual(progress);
  });
});

describe("reward storage compatibility", () => {
  it("keeps old learning records without awarding historical points", () => {
    const old = recordAttempt(createDefaultProgress(), answer(1));
    const { totalPoints, currentStreak, bestStreak, rewardQuestion, ...legacy } = old;
    window.localStorage.setItem("nurkh.progress.v1", JSON.stringify(legacy));
    const { progress, recovered } = loadProgress();
    expect(recovered).toBe(false);
    expect(progress).toMatchObject({ ...legacy, totalPoints: 0, currentStreak: 0, bestStreak: 0, rewardQuestion: null });
  });

  it.each([-1, 1.5, "10", null, Number.MAX_SAFE_INTEGER + 1])("defaults invalid reward values (%s) without losing mastery", (invalid) => {
    const progress = recordAttempt(createDefaultProgress(), answer(1));
    window.localStorage.setItem("nurkh.progress.v1", JSON.stringify({
      ...progress, totalPoints: invalid, currentStreak: invalid, bestStreak: invalid,
      rewardQuestion: { questionId: 123, status: "made up" }
    }));
    const loaded = loadProgress();
    expect(loaded.recovered).toBe(false);
    expect(loaded.progress).toMatchObject({
      mastery: progress.mastery, recentAttempts: progress.recentAttempts,
      totalPoints: 0, currentStreak: 0, bestStreak: 0, rewardQuestion: null
    });
  });

  it("keeps best streak at least as high as the current streak", () => {
    saveProgress({ ...createDefaultProgress(), currentStreak: 6, bestStreak: 2 });
    expect(loadProgress().progress).toMatchObject({ currentStreak: 6, bestStreak: 6 });
  });

  it("clears rewards with the existing progress reset", () => {
    saveProgress(recordAttempt(createDefaultProgress(), answer(1)));
    const reset = clearProgress();
    expect(reset).toMatchObject({ totalPoints: 0, currentStreak: 0, bestStreak: 0, rewardQuestion: null });
    expect(reset.resetId).not.toBe(createDefaultProgress().resetId);
    expect(loadProgress().progress).toEqual(reset);
  });
});
