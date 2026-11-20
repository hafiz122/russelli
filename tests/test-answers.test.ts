import { describe, expect, it } from "vitest";
import { statisticsFoundationGenerators } from "../src/math/statisticsFoundations";
import { formatPValue, readTestAnswer, testAnswerLatex, testResult } from "../src/math/testAnswers";
import { isParseableAnswer, validateAnswer } from "../src/math/validator";

function question(pValue: number, alpha = 0.05) {
  return { ...statisticsFoundationGenerators.counting.generate(2, "easy"), answer: testResult(pValue, alpha) };
}

describe("a p-value and hypothesis decision", () => {
  it.each([0, 0.00005, 0.02935, 0.04997, 0.05, 0.05003, 1])("accepts its displayed answer for p=%s", (p) => {
    const q = question(p);
    expect(validateAnswer(q, q.answer.latex)).toMatchObject({ parseable: true, correct: true });
    expect(readTestAnswer(q.answer.latex)?.decision).toBe(p <= 0.05 ? "reject" : "fail_to_reject");
  });

  it("compares the decision at full precision even when the printed value equals alpha", () => {
    expect(formatPValue(0.04997)).toBe("0.0500");
    expect(formatPValue(0.05003)).toBe("0.0500");
    expect(validateAnswer(question(0.05003), testAnswerLatex("0.0500", "reject")).correct).toBe(false);
    expect(validateAnswer(question(0.04997), testAnswerLatex("0.0500", "fail_to_reject")).correct).toBe(false);
    expect(validateAnswer(question(0.05), testAnswerLatex("0.05", "reject")).correct).toBe(true);
  });

  it("accepts equivalent fractions and higher precision in the same rounding interval", () => {
    const q = question(0.12346);
    for (const p of ["0.1235", "\\frac{1235}{10000}", "0.123451", "0.12345", "0.1235499999999999999999999"]) {
      expect(validateAnswer(q, testAnswerLatex(p, "fail_to_reject")).correct, p).toBe(true);
    }
    for (const p of ["0.1234", "0.1234499999999999999999999", "0.12355", "0.1236"]) {
      expect(validateAnswer(q, testAnswerLatex(p, "fail_to_reject"))).toMatchObject({ parseable: true, correct: false });
    }
    expect(validateAnswer(q, testAnswerLatex("0.1235", "reject")).correct).toBe(false);
  });

  it("requires a finite probability and a decision before submitting", () => {
    const q = question(0.5);
    for (const p of ["", "\\placeholder{}", "1/0", "0/0", "i", "x", "-10^{-30}", "1+10^{-30}", "a=b", "2,3"]) {
      expect(isParseableAnswer(q, testAnswerLatex(p, "fail_to_reject")), p).toBe(false);
    }
    expect(isParseableAnswer(q, testAnswerLatex("0.5", null))).toBe(false);
    expect(isParseableAnswer(q, "0.5")).toBe(false);
    expect(isParseableAnswer(q, "p={0.5},\\quad\\text{Accept }H_0")).toBe(false);
  });

  it("retains incomplete math while editing the final answer", () => {
    const partial = "\\frac{1}{\\placeholder{}}";
    expect(readTestAnswer(testAnswerLatex(partial, null))).toEqual({ pValue: partial, decision: null });
    expect(readTestAnswer(testAnswerLatex("", "reject"))).toEqual({ pValue: "", decision: "reject" });
    expect(testAnswerLatex("", null)).toBe("");
  });
});
