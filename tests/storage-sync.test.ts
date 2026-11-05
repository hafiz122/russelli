import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordAttempt } from "../src/state/adaptive";
import { commitProgress, createDefaultProgress, loadProgress, resetStoredProgress, saveProgress } from "../src/state/storage";
import type { Attempt } from "../src/types";

function answer(seed: number): Attempt {
  return {
    questionId: `expressions:easy:${seed}`, seed, skillId: "expressions", difficulty: "easy",
    rawLatex: "2x", normalizedAnswer: "2x", correct: true, attemptCount: 1,
    solutionRevealed: false, timestamp: "2026-11-05T00:00:00.000Z"
  };
}

beforeEach(() => {
  let pending: Promise<unknown> = Promise.resolve();
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name: string, action: () => unknown) => {
        const next = pending.then(action);
        pending = next.catch(() => undefined);
        return next;
      }
    }
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("shared progress transactions", () => {
  it("serializes simultaneous changes against the latest saved record", async () => {
    const initial = createDefaultProgress();
    saveProgress(initial);
    const [first, second] = await Promise.all([
      commitProgress(initial.resetId, (current) => recordAttempt(current, answer(1))),
      commitProgress(initial.resetId, (current) => recordAttempt(current, answer(2)))
    ]);
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(true);
    expect(second.previous.totalPoints).toBe(10);
    expect(loadProgress().progress).toMatchObject({ totalPoints: 20, currentStreak: 2, bestStreak: 2 });
    expect(loadProgress().progress.recentAttempts).toHaveLength(2);
  });

  it("keeps reset tombstones and rejects queued mutations from the old record", async () => {
    const initial = recordAttempt(createDefaultProgress(), answer(1));
    saveProgress(initial);
    const [reset, stale] = await Promise.all([
      resetStoredProgress(),
      commitProgress(initial.resetId, (current) => recordAttempt(current, answer(2)))
    ]);
    expect(reset.resetId).not.toBe(initial.resetId);
    expect(stale.applied).toBe(false);
    expect(loadProgress().progress).toEqual(reset);
    expect(reset).toMatchObject({ totalPoints: 0, currentStreak: 0, bestStreak: 0, recentAttempts: [] });
    const resumed = await commitProgress(reset.resetId, (current) => recordAttempt(current, answer(3)));
    expect(resumed.progress).toMatchObject({ totalPoints: 10, currentStreak: 1 });
    expect(resumed.progress.recentAttempts.map((attempt) => attempt.seed)).toEqual([3]);
  });

  it("orders a reset after earlier queued awards", async () => {
    const initial = createDefaultProgress();
    saveProgress(initial);
    await Promise.all([
      commitProgress(initial.resetId, (current) => recordAttempt(current, answer(1))),
      resetStoredProgress()
    ]);
    expect(loadProgress().progress).toMatchObject({ totalPoints: 0, currentStreak: 0, recentAttempts: [] });
  });

  it("retains legacy records without a reset identifier", () => {
    const { resetId, ...legacy } = recordAttempt(createDefaultProgress(), answer(1));
    window.localStorage.setItem("nurkh.progress.v1", JSON.stringify(legacy));
    expect(loadProgress().progress).toMatchObject({ ...legacy, resetId: createDefaultProgress().resetId });
  });

  it("does not perform unsafe writes when cross-tab locking is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const initial = recordAttempt(createDefaultProgress(), answer(1));
    saveProgress(initial);
    await expect(commitProgress(initial.resetId, (current) => recordAttempt(current, answer(2)))).rejects.toThrow();
    expect(loadProgress().progress).toEqual(initial);
  });
});
