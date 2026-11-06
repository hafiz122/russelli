import { describe, expect, it } from "vitest";
import { reservePresentation } from "../src/state/reservation";
import { createDefaultProgress } from "../src/state/storage";

const zeroRandom = () => 0;

describe("question reservations", () => {
  it("records an initial display once and returns it on a repeated reservation", () => {
    const initial = createDefaultProgress();
    const options = {
      presentationId: "first-display",
      topicOverride: null,
      lastForms: {},
      randomUint32: zeroRandom
    };
    const first = reservePresentation(initial, options);
    const repeated = reservePresentation({
      ...first.progress,
      mastery: { ...first.progress.mastery, expressions: 0.9 }
    }, options);

    expect(first.progress.recentPresentations).toHaveLength(1);
    expect(first.progress.recentPresentations[0]).toMatchObject({
      presentationId: "first-display",
      questionId: first.question.id,
      calibrationIndex: 0
    });
    expect(repeated.question).toEqual(first.question);
    expect(repeated.calibrationIndex).toBe(0);
    expect(repeated.progress.recentPresentations).toEqual(first.progress.recentPresentations);
  });

  it("keeps a tab's next form distinct when another tab reserves between its questions", () => {
    const initial = createDefaultProgress();
    const tabAFirst = reservePresentation(initial, {
      presentationId: "tab-a-first",
      topicOverride: "linear",
      lastForms: {},
      randomUint32: zeroRandom
    });
    const tabB = reservePresentation(tabAFirst.progress, {
      presentationId: "tab-b",
      topicOverride: "linear",
      lastForms: {},
      randomUint32: zeroRandom
    });
    const tabANext = reservePresentation(tabB.progress, {
      presentationId: "tab-a-next",
      topicOverride: "linear",
      lastForms: { linear: tabAFirst.question.formId },
      randomUint32: zeroRandom
    });

    expect(tabB.question.formId).not.toBe(tabAFirst.question.formId);
    expect(tabANext.question.formId).not.toBe(tabAFirst.question.formId);
    expect(tabANext.progress.recentPresentations).toHaveLength(3);
    expect(new Set(tabANext.progress.recentPresentations.map((item) => item.problemKey)).size).toBe(3);
  });
});
