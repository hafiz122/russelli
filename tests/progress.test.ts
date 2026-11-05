import { describe, expect, it } from "vitest";
import { chooseSkill, difficultyFor, recordAttempt, setPreferredSkill } from "../src/state/adaptive";
import { clearProgress, createDefaultProgress, loadProgress, saveProgress } from "../src/state/storage";
import type { Attempt } from "../src/types";

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    questionId: "expressions:easy:7",
    seed: 7,
    skillId: "expressions",
    difficulty: "easy",
    rawLatex: "2",
    normalizedAnswer: "2",
    correct: true,
    attemptCount: 1,
    solutionRevealed: false,
    timestamp: "2026-10-24T00:00:00.000Z",
    ...overrides
  };
}

describe("local progress", () => {
  it("runs calibration through all eight skills", () => {
    let progress = createDefaultProgress();
    const expected = [
      "expressions",
      "linear",
      "lines_systems",
      "exponents_radicals",
      "polynomials",
      "factoring_quadratics",
      "rational",
      "functions"
    ];

    for (const skillId of expected) {
      expect(chooseSkill(progress)).toBe(skillId);
      progress = recordAttempt(progress, attempt({ questionId: `${skillId}:easy:7`, skillId: skillId as Attempt["skillId"] }));
    }

    expect(progress.calibrationCompleted).toBe(true);
    expect(progress.calibrationIndex).toBe(8);
  });

  it("updates mastery and honors topic override", () => {
    const progress = createDefaultProgress();
    const correct = recordAttempt(progress, attempt());
    const incorrect = recordAttempt(progress, attempt({ correct: false }));
    expect(correct.mastery.expressions).toBeCloseTo(0.43);
    expect(incorrect.mastery.expressions).toBeCloseTo(0.28);
    expect(chooseSkill(setPreferredSkill({ ...correct, calibrationCompleted: true }, "functions"))).toBe("functions");
  });

  it("selects difficulty from mastery", () => {
    expect(difficultyFor(0.2)).toBe("easy");
    expect(difficultyFor(0.6)).toBe("medium");
    expect(difficultyFor(0.9)).toBe("hard");
  });

  it("counts a revealed calibration question only once across retries", () => {
    let progress = createDefaultProgress();
    progress = recordAttempt(progress, attempt({ correct: false, solutionRevealed: true }));
    progress = recordAttempt(progress, attempt({ correct: false, solutionRevealed: true, attemptCount: 2 }));
    progress = recordAttempt(progress, attempt({ solutionRevealed: true, attemptCount: 3 }));
    expect(progress.calibrationIndex).toBe(1);
    expect(progress.recentAttempts).toHaveLength(3);
  });

  it("discards malformed saved attempts while preserving valid history", () => {
    const progress = createDefaultProgress();
    const valid = attempt();
    window.localStorage.setItem("russelli.progress.v1", JSON.stringify({
      ...progress,
      recentAttempts: [null, {}, { ...valid, skillId: "unknown" }, { ...valid, correct: "yes" }, valid]
    }));
    expect(loadProgress().progress.recentAttempts).toEqual([valid]);
  });

  it("persists valid progress and recovers corrupted state", () => {
    const progress = recordAttempt(createDefaultProgress(), attempt());
    saveProgress(progress);
    expect(loadProgress()).toEqual({ progress, recovered: false });

    window.localStorage.setItem("russelli.progress.v1", "{bad json");
    const recovered = loadProgress();
    expect(recovered.recovered).toBe(true);
    expect(recovered.progress).toEqual(createDefaultProgress());
  });

  it("saves progress under the russelli name", () => {
    const progress = recordAttempt(createDefaultProgress(), attempt());
    saveProgress(progress);
    expect(JSON.parse(window.localStorage.getItem("russelli.progress.v1")!)).toEqual(progress);
  });

  it("preserves progress saved before the rename", () => {
    const progress = recordAttempt(createDefaultProgress(), attempt());
    window.localStorage.setItem("nurkh.progress.v1", JSON.stringify(progress));
    expect(loadProgress()).toEqual({ progress, recovered: false });
  });

  it("prefers current progress over progress saved before the rename", () => {
    window.localStorage.setItem("nurkh.progress.v1", JSON.stringify(createDefaultProgress()));
    const progress = recordAttempt(createDefaultProgress(), attempt());
    window.localStorage.setItem("russelli.progress.v1", JSON.stringify(progress));
    expect(loadProgress()).toEqual({ progress, recovered: false });
  });

  it("clears both progress records so old progress cannot return after a reset", () => {
    const progress = recordAttempt(createDefaultProgress(), attempt());
    window.localStorage.setItem("nurkh.progress.v1", JSON.stringify(progress));
    window.localStorage.setItem("russelli.progress.v1", JSON.stringify(progress));
    const reset = clearProgress();
    expect(reset).toEqual({ ...createDefaultProgress(), resetId: reset.resetId });
    expect(reset.resetId).not.toBe(progress.resetId);
    expect(window.localStorage.getItem("nurkh.progress.v1")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("russelli.progress.v1")!)).toEqual(reset);
    expect(loadProgress()).toEqual({ progress: reset, recovered: false });
  });
});
