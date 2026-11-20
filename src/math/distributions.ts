import type { AnswerSpec, DistributionFamily } from "../types";

export const distributions = {
  normal: { name: "Normal", parameters: ["Mean", "Variance"], prefix: "\\mathcal{N}\\left(", suffix: "\\right)" },
  t: { name: "Student’s t", parameters: ["Degrees of freedom"], prefix: "t_{", suffix: "}" },
  chi_square: { name: "Chi-square", parameters: ["Degrees of freedom"], prefix: "\\chi^{2}_{", suffix: "}" },
  f: { name: "F", parameters: ["Numerator degrees of freedom", "Denominator degrees of freedom"], prefix: "F_{", suffix: "}" }
} satisfies Record<DistributionFamily, { name: string; parameters: string[]; prefix: string; suffix: string }>;

export const distributionFamilies = Object.keys(distributions) as DistributionFamily[];

export function distributionLatex(family: DistributionFamily, parameters: string[]): string {
  const { prefix, suffix } = distributions[family];
  return prefix + parameters.map((parameter) => `{${parameter}}`).join(",") + suffix;
}

export function distributionAnswer(family: DistributionFamily, ...parameters: string[]): AnswerSpec {
  if (parameters.length !== distributions[family].parameters.length) {
    throw new Error(`Wrong number of parameters for ${family}`);
  }
  return { kind: "distribution", latex: distributionLatex(family, parameters), distribution: { family, parameters } };
}

// The outer braces keep commas inside a parameter separate from the commas between fields.
export function readDistribution(latex: string): { family: DistributionFamily; parameters: string[] } | null {
  const family = distributionFamilies.find((id) => latex.startsWith(distributions[id].prefix));
  if (!family) return null;
  const { prefix, suffix, parameters: labels } = distributions[family];
  if (!latex.endsWith(suffix)) return null;
  const body = latex.slice(prefix.length, -suffix.length);
  const parameters: string[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    if (body[cursor] !== "{") return null;
    const start = ++cursor;
    let depth = 1;
    while (depth > 0 && cursor < body.length) {
      const token = body[cursor++];
      if (token === "\\" && /[{}\\]/.test(body.charAt(cursor))) cursor++;
      else if (token === "{") depth++;
      else if (token === "}") depth--;
    }
    if (depth !== 0) return null;
    parameters.push(body.slice(start, cursor - 1));
    if (cursor < body.length && (body[cursor++] !== "," || cursor === body.length)) return null;
  }
  return parameters.length === labels.length ? { family, parameters } : null;
}
