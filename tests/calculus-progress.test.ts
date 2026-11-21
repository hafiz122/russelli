import { describe, expect, it } from "vitest";
import { assessedOutcomes, calculusIds, calculusTopics, chapters, readCalculusFocus, topicsForFocus } from "../src/data/calculus";
import { generateQuestion } from "../src/math/generators";
import { validateAnswer } from "../src/math/validator";
import { chooseSkill, recordAttempt } from "../src/state/adaptive";
import { reservePresentation } from "../src/state/reservation";
import { clearProgress, createDefaultProgress, loadProgress, saveProgress, STORAGE_KEY } from "../src/state/storage";
import type { Attempt } from "../src/types";

const example = generateQuestion("calc_lines_planes", 1, "easy");
const check: Attempt = {
  questionId: example.id, seed: example.seed, skillId: example.skillId, difficulty: example.difficulty,
  outcome: example.outcome, rawLatex: example.answer.latex, normalizedAnswer: example.answer.latex,
  correct: true, attemptCount: 1, solutionRevealed: false, timestamp: "2026-11-21T00:00:00Z"
};

describe("calculus curriculum and practice", () => {
  it("covers every syllabus topic in chapter order and assesses only a listed, defined outcome", () => {
    expect(chapters.map(chapter => topicsForFocus({ chapter: chapter.number }).length)).toEqual([5, 8, 5, 6, 10]);
    expect(calculusIds).toHaveLength(34);
    for (const id of calculusIds) {
      const { chapter, forms, outcomes } = calculusTopics[id];
      expect(forms[0]).not.toBe(forms[1]);
      for (const outcome of outcomes) {
        expect(chapters[chapter - 1].outcomes).toContain(outcome);
        expect(assessedOutcomes).toContain(outcome);
      }
    }
    expect(readCalculusFocus("?clo=CLO4")).toEqual({});
    expect(readCalculusFocus("?chapter=5")).toEqual({ chapter: 5 });
    expect(readCalculusFocus("?chapter=19&topic=vectors")).toEqual({});
    expect(readCalculusFocus("?topic=calc_vectors&clo=CLO2")).toEqual({ clo: "CLO2" });
  });

  it("reserves only eligible forms through repeats, resumption and topic links within each CLO", () => {
    const initial = createDefaultProgress();
    initial.preferredCalculusSkill = "calc_vectors";
    for (const clo of assessedOutcomes) {
      for (const topic of topicsForFocus({ clo })) {
        const focus = readCalculusFocus(`?topic=${topic}&clo=${clo.toLowerCase()}`);
        let progress = initial;
        for (let i = 0; i < 3; i++) {
          const options = { track: "calculus" as const, calculusFocus: focus, topicOverride: null, presentationId: String(i),
            lastForms: {}, randomUint32: () => i };
          const reserved = reservePresentation(progress, options);
          expect(reserved.question).toMatchObject({ skillId: topic, outcome: clo });
          expect(reserved.calibrationIndex).toBeNull();
          expect(reservePresentation(reserved.progress, options).question).toEqual(reserved.question);
          progress = reserved.progress;
        }
      }
    }
    for (const chapter of chapters) {
      const id = chooseSkill(initial, "calculus", { chapter: chapter.number });
      expect(topicsForFocus({ chapter: chapter.number })).toContain(id);
    }
  });

  it("follows the chapter sequence, then reviews all topics even when scores tie", () => {
    let progress = createDefaultProgress();
    for (const id of calculusIds) {
      expect(chooseSkill(progress, "calculus")).toBe(id);
      progress.mastery[id] = 1;
    }
    const cycle = new Set<string>();
    for (let i = 0; i < calculusIds.length; i++) {
      const reservation = reservePresentation(progress, {
        track: "calculus", topicOverride: null, presentationId: String(i), lastForms: {}, randomUint32: () => i
      });
      cycle.add(reservation.question.skillId);
      expect(reservation.question.difficulty).toBe("hard");
      progress = reservation.progress;
    }
    expect(cycle).toEqual(new Set(calculusIds));
    expect(chooseSkill(progress)).toBe("expressions");
  });

  it("rotates between eligible topics during outcome practice", () => {
    const options = { track: "calculus" as const, calculusFocus: { clo: "CLO2" as const }, topicOverride: null,
      lastForms: {}, randomUint32: () => 0 };
    const first = reservePresentation(createDefaultProgress(), { ...options, presentationId: "first" });
    const next = reservePresentation(first.progress, { ...options, presentationId: "next" });
    expect(next.question.outcome).toBe("CLO2");
    expect(next.question.skillId).not.toBe(first.question.skillId);
  });

  it("records independent evidence only for the assessed outcome on a first unaided correct check", () => {
    const empty = createDefaultProgress();
    for (const event of [{ correct: false }, { attemptCount: 2 }, { hintUsed: true }, { solutionRevealed: true }, { skipped: true }]) {
      expect(recordAttempt(empty, { ...check, ...event }).independentCalculusTopics).toEqual(empty.independentCalculusTopics);
    }
    for (const event of [{ skipped: true, correct: false }, { solutionRevealed: true }]) {
      expect(recordAttempt(empty, { ...check, ...event }).mastery[check.skillId]).toBe(empty.mastery[check.skillId]);
    }
    const solved = recordAttempt(recordAttempt(empty, check), check);
    expect(solved.independentCalculusTopics).toEqual({ CLO1: [], CLO2: [], CLO3: [example.skillId] });
    const remaining = topicsForFocus({ clo: "CLO3" }).filter(id => id !== check.skillId);
    expect(remaining).toContain(chooseSkill(solved, "calculus", { clo: "CLO3" }));
  });

  it("keeps evidence beyond the 80-check history, backfills older records, and clears evidence on reset", () => {
    let progress = recordAttempt(createDefaultProgress(), check);
    const algebraCheck: Attempt = { ...check, questionId: "linear:easy:7", skillId: "linear", seed: 7, outcome: undefined };
    for (let i = 0; i < 81; i++) progress = recordAttempt(progress, algebraCheck);
    saveProgress(progress);
    const saved = loadProgress().progress;
    expect(saved.recentAttempts.some(item => item.skillId === check.skillId)).toBe(false);
    expect(saved.independentCalculusTopics.CLO3).toContain(check.skillId);
    const { independentCalculusTopics, preferredCalculusSkill, ...legacy } = saved;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    expect(loadProgress().progress).toMatchObject({ mastery: { linear: saved.mastery.linear },
      independentCalculusTopics: { CLO1: [], CLO2: [], CLO3: [] }, preferredCalculusSkill: null });
    saveProgress(saved);
    expect(clearProgress().independentCalculusTopics).toEqual({ CLO1: [], CLO2: [], CLO3: [] });
  });

  it("grades scaled plane equations and rejects a bare constant or an unrelated plane", () => {
    const plane = { ...example, answer: { kind: "equation" as const, latex: "2x-3y+z=4" } };
    for (const candidate of ["4x-6y+2z=8", "z=4-2x+3y", "4=2x-3y+z"]) {
      expect(validateAnswer(plane, candidate).correct, candidate).toBe(true);
    }
    for (const candidate of ["4", "4x-6y+2z=4", "x(2x-3y+z-4)=0"]) {
      expect(validateAnswer(plane, candidate).correct, candidate).toBe(false);
    }
  });

  it("accepts equivalent exact calculus answers and rejects nearby decimals", () => {
    const exact = { ...example, answer: { kind: "number" as const, latex: "\\frac{3\\pi}{2}" } };
    expect(validateAnswer(exact, "1.5\\pi").correct).toBe(true);
    expect(validateAnswer(exact, "4.71238898038469").correct).toBe(false);
    const interval = { ...example, answer: { kind: "interval" as const, latex: "[0,1]" } };
    expect(validateAnswer(interval, "[0,1.00000000000000000000001]").correct).toBe(false);
  });
});
