import type { Difficulty } from "../types";
import { fraction } from "./format";
import { SeededRandom } from "./rng";
import { formatPValue, testResult } from "./testAnswers";
import { referenceFor, type ReferenceLaw } from "./testReference";
import { binomialMass, massTable, testingGenerator, type TestingForm } from "./testingTheory";

const tex = String.raw;
export const proportionVarianceFormIds = {
  proportion_tests: ["exact_binomial", "pooled_proportions"],
  variance_tests: ["one_variance", "two_variances"]
} as const;

type Tail = "left" | "right" | "two";
const comparisonWords = { left: "is below", right: "is above", two: "differs from" };
const alternative = { left: "<", right: ">", two: "\\ne " };
const instructions = "Report the p-value to four decimal places and the decision at the stated significance level.";

function direction(rng: SeededRandom, difficulty: Difficulty): Tail {
  return difficulty === "hard" ? "two" : difficulty === "easy" ? "right" : rng.pick(["left", "right"]);
}

function continuousTail(tail: Tail, lower: number, total = 1): number {
  const upper = total - lower;
  return tail === "left" ? lower : tail === "right" ? upper : 2 * Math.min(lower, upper);
}

function lookup(law: ReferenceLaw, observed: number, tail: Tail) {
  const { lower, table } = referenceFor(law, observed);
  const answerUnits = Number(formatPValue(continuousTail(tail, lower)).replace(".", ""));
  const digits = [9, 12].find(places => {
    // At both candidate precisions, integer decimal units preserve a printed half-tie exactly.
    const scale = 10 ** places;
    const lowerUnits = Number(lower.toFixed(places).replace(".", ""));
    const tailUnits = continuousTail(tail, lowerUnits, scale);
    return Math.round(tailUnits / (scale / 10_000)) === answerUnits;
  }) ?? 24;
  return { lower, table: digits === 9 ? table : referenceFor(law, observed, digits).table, area: lower.toFixed(digits) };
}

function pValueSteps(tail: Tail, area: string): string {
  if (tail === "left") return tex`p_{\mathrm{val}}\approx ${area}`;
  if (tail === "right") return tex`p_{\mathrm{val}}\approx 1-${area}`;
  return tex`p_{\mathrm{val}}\approx 2\min\left(${area},1-${area}\right)`;
}

function interpretation(pValue: number, alpha: number, claim: string): string {
  return pValue <= alpha
    ? `The data support the claim that ${claim}.`
    : `There is insufficient evidence that ${claim}.`;
}

function significance(rng: SeededRandom, pValue: number, difficulty: Difficulty): number {
  const levels = difficulty === "easy" ? [0.05, 0.10] : [0.01, 0.05, 0.10];
  return rng.pick(levels.filter(alpha => Math.abs(pValue - alpha) > 0.0001));
}

const binomialTest: TestingForm = (rng, difficulty) => {
  const n = difficulty === "easy" ? rng.int(4, 7) : difficulty === "medium" ? rng.int(6, 9) : rng.int(8, 12);
  const d = difficulty === "easy" ? 2 : difficulty === "medium" ? 3 : 4;
  const a = rng.pick([1, d - 1]);
  const right = difficulty === "easy" || rng.pick([true, false]);
  const { weights, denominator } = binomialMass(n, a, d);
  const candidates = Array.from({ length: n + 1 }, (_, x) => {
    const tail = right ? weights.slice(x) : weights.slice(0, x + 1);
    return { x, numerator: tail.reduce((sum, w) => sum + w, 0) };
  }).filter(({ numerator }) => numerator / denominator >= 0.0001 && numerator / denominator <= 0.70);
  const { x, numerator } = rng.pick(candidates);
  const pValue = numerator / denominator;
  const alpha = significance(rng, pValue, difficulty);
  const answer = testResult(pValue, alpha);
  const comparison = right ? ">" : "<";
  return {
    instruction: `X counts successes in n independent trials with success probability p. Use the exact one-sided binomial test. ${instructions}`,
    promptLatex: tex`n=${n},\quad x=${x},\quad H_0:p=${fraction(a, d)},\quad H_1:p${comparison}${fraction(a, d)},\quad \alpha=${alpha}`,
    answer, referenceTable: massTable(weights, denominator, a, d, right ? Math.max(0, x - 1) : 0, right ? n : Math.min(n, x + 1)),
    hints: ["Under the null, use the binomial model with the stated null success probability.", "Sum the masses at the observed count and beyond it in the direction of the alternative."],
    workedConclusion: interpretation(pValue, alpha, `the success probability ${comparisonWords[right ? "right" : "left"]} ${a}/${d}`),
    workedSolution: [
      tex`X\mid H_0\sim\operatorname{Bin}(${n},${fraction(a, d)})`,
      tex`p_{\mathrm{val}}=P_0(X${right ? "\\ge" : "\\le"} ${x})=\sum_{k=${right ? x : 0}}^{${right ? n : x}}P_0(X=k)`,
      tex`p_{\mathrm{val}}=\frac{${numerator}}{${denominator}}=${fraction(numerator, denominator)}`,
      tex`\boxed{${answer.latex}}`
    ]
  };
};

const pooledProportions: TestingForm = (rng, difficulty) => {
  const n1 = rng.pick([60, 72, 80, 90, 100]);
  const n2 = difficulty === "easy" ? n1 : rng.pick([64, 75, 84, 96, 108]);
  const base = rng.int(35, 65) / 100;
  const sign = difficulty === "easy" ? 1 : rng.pick([-1, 1]);
  const x1 = Math.round(n1 * (base + sign * rng.int(6, 21) / 100));
  const x2 = Math.round(n2 * base);
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const z = (x1 / n1 - x2 / n2) / se;
  const tail = direction(rng, difficulty);
  const { lower, table, area } = lookup({ family: "normal" }, z, tail);
  const pValue = continuousTail(tail, lower);
  const alpha = significance(rng, pValue, difficulty);
  const answer = testResult(pValue, alpha);
  return {
    instruction: `Two independent binomial samples have the success counts shown. Use the pooled two-proportion z test without a continuity correction. ${instructions}`,
    promptLatex: tex`(x_1,n_1)=(${x1},${n1}),\quad (x_2,n_2)=(${x2},${n2}),\quad H_0:p_1=p_2,\quad H_1:p_1${alternative[tail]}p_2,\quad \alpha=${alpha}`,
    answer, referenceTable: table,
    hints: ["Pool the successes and trials to estimate the common probability under the null.", "Standardize the difference in the displayed order, then use the tail indicated by the alternative."],
    workedConclusion: interpretation(pValue, alpha, `the success probability in the first population ${comparisonWords[tail]} the probability in the second`),
    workedSolution: [
      tex`\hat p=\frac{${x1}+${x2}}{${n1}+${n2}}=${fraction(x1 + x2, n1 + n2)}`,
      tex`\operatorname{SE}_0=\sqrt{\hat p(1-\hat p)(1/${n1}+1/${n2})}`,
      tex`z=\frac{${fraction(x1, n1)}-${fraction(x2, n2)}}{\operatorname{SE}_0}\approx${z.toFixed(6)}`,
      pValueSteps(tail, area),
      tex`\boxed{${answer.latex}}`
    ]
  };
};

const oneVariance: TestingForm = (rng, difficulty) => {
  const n = rng.int(7, difficulty === "easy" ? 15 : 25);
  const unit = rng.int(2, 7);
  const nullVariance = 10 * unit;
  const observed = unit * rng.pick(difficulty === "easy" ? [12, 15, 17, 20, 24] : [4, 6, 8, 12, 15, 18, 22]);
  const residual = (n - 1) * observed;
  const chi = residual / nullVariance;
  const tail = direction(rng, difficulty);
  const { lower, table, area } = lookup({ family: "chi_square", df: n - 1 }, chi, tail);
  const pValue = continuousTail(tail, lower);
  const alpha = significance(rng, pValue, difficulty);
  const answer = testResult(pValue, alpha);
  const hard = difficulty === "hard";
  const given = hard ? tex`Q=${residual}` : tex`s^2=${observed}`;
  return {
    instruction: `The sample contains independent draws from one normal population. ${hard ? "Q is the sum of squared deviations from the sample mean. Use twice the smaller tail for the two-sided p-value." : "The sample variance uses divisor n − 1."} ${instructions}`,
    promptLatex: tex`n=${n},\quad ${given},\quad H_0:\sigma^2=${nullVariance},\quad H_1:\sigma^2${alternative[tail]}${nullVariance},\quad \alpha=${alpha}`,
    answer, referenceTable: table,
    hints: ["Divide the sum of squared deviations from the sample mean by the hypothesized variance.", "Estimating the sample mean leaves n − 1 degrees of freedom."],
    workedConclusion: interpretation(pValue, alpha, `the population variance ${comparisonWords[tail]} ${nullVariance}`),
    workedSolution: [
      tex`V=\frac{(n-1)S^2}{\sigma_0^2}\sim\chi^2_{${n - 1}}\quad(H_0)`,
      tex`v=\frac{${residual}}{${nullVariance}}=${fraction(residual, nullVariance)}`,
      pValueSteps(tail, area),
      tex`\boxed{${answer.latex}}`
    ]
  };
};

const twoVariances: TestingForm = (rng, difficulty) => {
  const n1 = rng.int(8, 25);
  const otherSize = rng.int(8, 24);
  const n2 = otherSize < n1 ? otherSize : otherSize + 1;
  const nullRatio = difficulty === "hard" ? rng.int(2, 4) : 1;
  const den = rng.int(3, 8);
  const num = difficulty === "easy" ? rng.int(den + 1, 3 * den) : rng.int(2, 3 * den);
  const scale = rng.int(2, 5);
  const v1 = nullRatio * scale * num;
  const v2 = scale * den;
  const f = v1 / (v2 * nullRatio);
  const tail = direction(rng, difficulty);
  const { lower, table, area } = lookup({ family: "f", df1: n1 - 1, df2: n2 - 1 }, f, tail);
  const pValue = continuousTail(tail, lower);
  const alpha = significance(rng, pValue, difficulty);
  const answer = testResult(pValue, alpha);
  return {
    instruction: `Two independent random samples come from normal populations. Each sample variance uses its sample size minus one as divisor. Test the population variance ratio in the displayed order. ${tail === "two" ? "Use twice the smaller tail. " : ""}${instructions}`,
    promptLatex: tex`(n_1,s_1^2)=(${n1},${v1}),\quad (n_2,s_2^2)=(${n2},${v2}),\quad \rho=\sigma_1^2/\sigma_2^2,\quad H_0:\rho=${nullRatio},\quad H_1:\rho${alternative[tail]}${nullRatio},\quad \alpha=${alpha}`,
    answer, referenceTable: table,
    hints: ["Divide the first sample variance by the second, then divide by the hypothesized ratio.", "The first sample supplies the numerator degrees of freedom. The alternative determines the tail."],
    workedConclusion: interpretation(pValue, alpha, `the ratio of the first population variance to the second ${comparisonWords[tail]} ${nullRatio}`),
    workedSolution: [
      tex`F=\frac{S_1^2/S_2^2}{\rho_0}\sim F_{${n1 - 1},${n2 - 1}}\quad(H_0)`,
      tex`f=\frac{${v1}/${v2}}{${nullRatio}}=${fraction(v1, v2 * nullRatio)}`,
      pValueSteps(tail, area),
      tex`\boxed{${answer.latex}}`
    ]
  };
};

export const proportionVarianceGenerators = {
  proportion_tests: testingGenerator("proportion_tests", proportionVarianceFormIds.proportion_tests, binomialTest, pooledProportions),
  variance_tests: testingGenerator("variance_tests", proportionVarianceFormIds.variance_tests, oneVariance, twoVariances)
};
