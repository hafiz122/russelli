import type { Difficulty, Question, QuestionGenerator, ReferenceTable, SkillId } from "../types";
import { fraction } from "./format";
import { SeededRandom } from "./rng";
import { validateAnswer } from "./validator";

const tex = String.raw;
export const theoryFormIds = {
  errors_power: ["actual_size", "error_or_power"],
  likelihood_ratio: ["neyman_pearson_cutoff", "generalized_likelihood_ratio"]
} as const;

type Details = Pick<Question, "instruction" | "promptLatex" | "answer" | "hints" | "workedSolution" | "workedConclusion" | "referenceTable">;
export type TestingForm = (rng: SeededRandom, difficulty: Difficulty) => Details;

export function testingGenerator(skillId: SkillId, forms: readonly [string, string], even: TestingForm, odd: TestingForm): QuestionGenerator {
  return {
    skillId,
    validate: validateAnswer,
    generate(seed, difficulty) {
      const parity = seed % 2 === 0 ? 0 : 1;
      const formId = forms[parity];
      const details = (parity === 0 ? even : odd)(new SeededRandom(seed), difficulty);
      return {
        id: `${skillId}:${difficulty}:${seed}`, seed, generatorVersion: 1, skillId, difficulty, formId,
        problemKey: `${skillId}:${formId}:${details.instruction}:${details.promptLatex}`, ...details
      };
    }
  };
}

export function binomialMass(n: number, a: number, d: number) {
  let weights = [1];
  for (let trial = 0; trial < n; trial++) {
    weights = Array.from({ length: trial + 2 }, (_, k) => (weights[k] ?? 0) * (d - a) + (weights[k - 1] ?? 0) * a);
  }
  return { weights, denominator: d ** n };
}

export function massTable(weights: number[], denominator: number, a: number, d: number, first = 0, last = weights.length - 1): ReferenceTable {
  return {
    caption: `Binomial masses at p = ${a}/${d}. Divide each weight by ${denominator} for the probability of that count.`,
    headers: ["Successes", "Weight"],
    rows: weights.slice(first, last + 1).map((w, i) => [String(i + first), String(w)])
  };
}

function errorProblem(rng: SeededRandom, difficulty: Difficulty, size: boolean): Details {
  const n = difficulty === "easy" ? rng.int(4, 6) : difficulty === "medium" ? rng.int(6, 8) : rng.int(8, 10);
  const left = difficulty !== "easy" && rng.pick([true, false]);
  const both = difficulty === "hard";
  const d = difficulty === "easy" ? 3 : 4;
  const a0 = both ? d / 2 : left ? d - 1 : 1;
  const a1 = left ? 1 : d - 1;
  const lo = rng.int(0, Math.floor(n / 3) - 1);
  const hi = rng.int(n - Math.floor(n / 3), n);
  const region = both ? tex`X\le ${lo}\;\text{or}\;X\ge ${hi}` : left ? tex`X\le ${lo}` : tex`X\ge ${hi}`;
  const a = size ? a0 : a1;
  const { weights, denominator } = binomialMass(n, a, d);
  const rejected = weights.filter((_, k) => ((both || left) && k <= lo) || ((both || !left) && k >= hi));
  const rejectMass = rejected.reduce((s, w) => s + w, 0);
  const beta = !size && rng.pick([true, false]);
  const probability = fraction(beta ? denominator - rejectMass : rejectMass, denominator);
  const target = size ? "actual size (Type I error probability)" : beta ? "Type II error probability at the specified alternative" : "power at the specified alternative";
  const symbol = size ? tex`\alpha_{\mathrm{actual}}` : beta ? tex`\beta` : tex`1-\beta`;
  const steps = [
    tex`P_p(\text{reject})=\sum_{k\in\mathcal R}P_p(X=k)`,
    tex`P_{p=${fraction(a, d)}}(\text{reject})=\frac{${rejectMass}}{${denominator}}`,
    beta ? tex`\beta=1-${fraction(rejectMass, denominator)}` : tex`${symbol}=P_{p=${fraction(a, d)}}(\text{reject})`,
    tex`\boxed{${probability}}`
  ];
  return {
    instruction: `X counts successes in n independent Bernoulli trials with common probability p. The displayed rule includes its boundary. Find the test's ${target} exactly.`,
    promptLatex: tex`n=${n},\quad H_0:p=${fraction(a0, d)},\quad ${size ? "" : tex`H_1:p=${fraction(a1, d)},\quad `}\text{reject if } ${region}`,
    answer: { kind: "number", latex: probability },
    hints: [size ? "Use the probability model specified by the null hypothesis." : "Use the alternative probability to weight the possible counts.",
      beta ? "A Type II error occurs when the rule fails to reject under the alternative." : "Add the probabilities of the counts in the rejection region."],
    workedSolution: steps,
    referenceTable: massTable(weights, denominator, a, d)
  };
}

const cutoff: TestingForm = (rng, difficulty) => {
  const n = difficulty === "easy" ? rng.int(4, 6) : difficulty === "medium" ? rng.int(6, 8) : rng.int(8, 10);
  const upper = difficulty === "easy" || rng.pick([true, false]);
  const d = difficulty === "easy" ? 2 : difficulty === "medium" ? 3 : 4;
  const a = d === 2 ? 1 : upper ? 1 : d - 1;
  const alt = upper ? fraction(d + a, 2 * d) : fraction(a, 2 * d);
  const { weights, denominator } = binomialMass(n, a, d);
  const c = upper ? rng.int(Math.ceil(n / 2) + 1, n) : rng.int(0, Math.floor(n / 2) - 1);
  const included = weights.filter((_, k) => upper ? k >= c : k <= c);
  const rejectMass = included.reduce((s, w) => s + w, 0);
  const size = fraction(rejectMass, denominator);
  return {
    instruction: "X counts successes in n independent Bernoulli trials. Find the integer boundary c of the most powerful nonrandomized rejection region with exactly the stated size. Include the boundary count.",
    promptLatex: tex`n=${n},\quad H_0:p=${fraction(a, d)},\quad H_1:p=${alt},\quad \alpha=${size}`,
    hints: ["Order counts by their alternative likelihood divided by their null likelihood.", "Accumulate null probabilities from the most favorable end until their sum reaches the stated size."],
    answer: { kind: "number", latex: String(c) },
    workedSolution: [
      tex`\frac{L_1(k+1)/L_0(k+1)}{L_1(k)/L_0(k)}=\frac{p_1(1-p_0)}{p_0(1-p_1)}${upper ? ">" : "<"}1`,
      tex`P_0(X${upper ? "\\ge" : "\\le"} ${c})=\frac{${rejectMass}}{${denominator}}=${size}`,
      tex`\boxed{${c}}`
    ],
    referenceTable: massTable(weights, denominator, a, d)
  };
};

const likelihoodRatio: TestingForm = (rng, difficulty) => {
  const n = difficulty === "easy" ? rng.int(3, 5) : difficulty === "medium" ? rng.int(5, 7) : rng.int(6, 8);
  const d = difficulty === "easy" ? 2 : difficulty === "medium" ? 3 : 4;
  const a = rng.pick([1, d - 1]);
  const interior = Array.from({ length: n - 1 }, (_, i) => i + 1).filter(x => x * d !== n * a);
  const x = rng.pick(interior);
  const ratio = fraction(n ** n * a ** x * (d - a) ** (n - x), d ** n * x ** x * (n - x) ** (n - x));
  return {
    instruction: "A binomial sample gives x successes in n independent trials. Find the generalized likelihood ratio for the displayed null against unrestricted p. Enter its exact value.",
    promptLatex: tex`n=${n},\quad x=${x},\quad H_0:p=${fraction(a, d)},\quad \Lambda=\frac{L(p_0)}{\sup_{0\le p\le1}L(p)}`,
    hints: ["The unrestricted likelihood reaches its maximum at x/n.", "The same binomial coefficient occurs in both likelihoods and cancels."],
    answer: { kind: "number", latex: ratio },
    workedSolution: [
      tex`L(p)\propto p^{${x}}(1-p)^{${n - x}},\quad \hat p=${fraction(x, n)}`,
      tex`\Lambda=\frac{(${fraction(a, d)})^{${x}}(${fraction(d - a, d)})^{${n - x}}}{(${fraction(x, n)})^{${x}}(${fraction(n - x, n)})^{${n - x}}}`,
      tex`\boxed{${ratio}}`
    ]
  };
};

export const theoryGenerators = {
  errors_power: testingGenerator("errors_power", theoryFormIds.errors_power,
    (rng, difficulty) => errorProblem(rng, difficulty, true), (rng, difficulty) => errorProblem(rng, difficulty, false)),
  likelihood_ratio: testingGenerator("likelihood_ratio", theoryFormIds.likelihood_ratio, cutoff, likelihoodRatio)
};
