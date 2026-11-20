import type { AnswerSpec } from "../types";

export type TestDecision = "reject" | "fail_to_reject";

const decisionLatex: Record<TestDecision, string> = {
  reject: "\\text{Reject }H_0",
  fail_to_reject: "\\text{Fail to reject }H_0"
};

const fourPlaces = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  minimumFractionDigits: 4,
  maximumFractionDigits: 4
});

export function formatPValue(pValue: number): string {
  return fourPlaces.format(pValue);
}

export function testAnswerLatex(pValue: string, decision: TestDecision | null): string {
  if (!pValue && !decision) return "";
  return `p={${pValue}}${decision ? `,\\quad${decisionLatex[decision]}` : ""}`;
}

export function readTestAnswer(latex: string): { pValue: string; decision: TestDecision | null } | null {
  if (!latex.startsWith("p={")) return null;
  for (const decision of ["reject", "fail_to_reject"] as const) {
    const suffix = `},\\quad${decisionLatex[decision]}`;
    if (latex.endsWith(suffix)) return { pValue: latex.slice(3, -suffix.length), decision };
  }
  return latex.endsWith("}") ? { pValue: latex.slice(3, -1), decision: null } : null;
}

export function testResult(pValue: number, alpha: number): AnswerSpec {
  if (!Number.isFinite(pValue) || pValue < 0 || pValue > 1 || !(alpha > 0 && alpha < 1)) {
    throw new RangeError("Expected a probability and a significance level between zero and one");
  }
  return {
    kind: "hypothesis_test",
    latex: testAnswerLatex(formatPValue(pValue), pValue <= alpha ? "reject" : "fail_to_reject"),
    testResult: { pValue, alpha }
  };
}
