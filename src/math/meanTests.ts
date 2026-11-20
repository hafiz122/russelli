import type { Difficulty, Question, QuestionGenerator } from "../types";
import { SeededRandom } from "./rng";
import { testResult } from "./testAnswers";
import { referenceFor, type ReferenceLaw } from "./testReference";
import { validateAnswer } from "./validator";

const tex = String.raw;
export const meanTestFormIds = {
  hypothesis_testing: ["directional_claim", "two_sided_claim"],
  one_sample_tests: ["known_sigma", "one_sample_t"],
  comparing_means: ["paired_t", "pooled_t"]
} as const;

type Topic = keyof typeof meanTestFormIds;
type Tail = "left" | "right" | "two";
type Exercise = {
  instruction: string;
  lines: string[];
  description?: string;
  law: ReferenceLaw;
  statistic: number;
  tail: Tail;
  nullHypothesis: string;
  alternative: string;
  claim: string;
  steps: string[];
  hints: string[];
};
type Form = (rng: SeededRandom, difficulty: Difficulty) => Exercise;

function gather(lines: string[]): string {
  return tex`\begin{gathered}${lines.join("\\\\")}\end{gathered}`;
}

function observed(rng: SeededRandom): number {
  return rng.pick([-1, 1]) * rng.pick([0.5, 1, 1.25, 1.5, 2, 2.5, 3, 3.5]);
}

function sampleTail(rng: SeededRandom, difficulty: Difficulty): Tail {
  return difficulty === "easy" ? rng.pick(["left", "right"]) : rng.pick(["left", "right", "two"]);
}

function comparison(tail: Tail): string {
  return tail === "left" ? "<" : tail === "right" ? ">" : "\\ne ";
}

function exercise(skillId: Topic, first: Form, second: Form): QuestionGenerator {
  return {
    skillId,
    validate: validateAnswer,
    generate(seed, difficulty) {
      const rng = new SeededRandom(seed);
      const index = seed % 2 === 0 ? 0 : 1;
      const formId = meanTestFormIds[skillId][index];
      const e = (index === 0 ? first : second)(rng, difficulty);
      const { lower, table } = referenceFor(e.law, e.statistic);
      const pValue = e.tail === "left" ? lower : e.tail === "right" ? 1 - lower : 2 * Math.min(lower, 1 - lower);
      const alpha = rng.pick([0.01, 0.05, 0.1].filter(level => Math.abs(level - pValue) > 0.001));
      const answer = testResult(pValue, alpha);
      const statisticName = e.law.family === "normal" ? "z" : "t";
      const cdf = tex`F(${e.statistic})`;
      const pFormula = e.tail === "left" ? cdf : e.tail === "right" ? `1-${cdf}` : tex`2\min\{${cdf},1-${cdf}\}`;
      const reject = pValue <= alpha;
      const promptLatex = gather([...e.lines, tex`\alpha=${alpha}`]);
      return {
        id: `${skillId}:${difficulty}:${seed}`, seed, generatorVersion: 1, skillId, difficulty, formId,
        problemKey: `${skillId}:${formId}:${e.tail}:${promptLatex}`,
        instruction: e.instruction,
        promptLatex,
        ...(e.description ? { promptDescription: `${e.description} Significance level ${alpha}.` } : {}),
        referenceTable: table,
        hints: [...e.hints, "The table gives lower-tail areas. Use the tail or tails specified by the claim."],
        answer,
        workedSolution: [
          tex`H_0:\ ${e.nullHypothesis}`, tex`H_a:\ ${e.alternative}`, ...e.steps,
          e.law.family === "t" ? tex`${statisticName}_{\rm obs}=${e.statistic},\quad \nu=${e.law.df}` : tex`${statisticName}_{\rm obs}=${e.statistic}`,
          tex`p=${pFormula}\approx ${pValue.toFixed(4)}`,
          gather([tex`p${reject ? "\\le" : ">"}\alpha`, tex`\text{${reject ? "Reject" : "Fail to reject"} }H_0`])
        ],
        workedConclusion: `${reject ? "Evidence supports" : "Insufficient evidence for"} ${e.claim}.`
      };
    }
  };
}

function readingClaim(rng: SeededRandom, difficulty: Difficulty, twoSided: boolean): Exercise {
  const nullValue = rng.int(18, 60);
  const statistic = observed(rng);
  const tail = twoSided ? "two" : rng.pick(["left", "right"] as const);
  const direction = tail === "left" ? "lower" : tail === "right" ? "higher" : "different";
  const directionWord = tail === "left" ? "below" : tail === "right" ? "above" : "different from";
  if (difficulty === "hard") {
    const df = rng.int(5, 20);
    const claim = tail === "two" ? "a change in mean time" : `a ${tail === "left" ? "longer" : "shorter"} mean time with B`;
    const question = tail === "two" ? "the two methods have different mean times" :
      `method B takes ${tail === "left" ? "longer" : "less time"} on average than A`;
    return {
      instruction: `A team compares two methods. Its signed t statistic uses method A minus method B and has the stated null degrees of freedom. Test the claim that ${question}.`,
      lines: [tex`D=\mu_A-\mu_B,\quad D_0=0`, tex`t_{\rm obs}=${statistic},\quad \nu=${df}`],
      law: { family: "t", df }, statistic, tail, nullHypothesis: "D=0", alternative: `D${comparison(tail)}0`,
      claim, hints: ["Write the claim using the stated order A minus B."], steps: []
    };
  }
  const se = rng.int(1, 4);
  const mean = nullValue + statistic * se;
  return {
    instruction: `A packing line has a reference mean fill of ${nullValue} grams. The inspector suspects the current mean fill is ${directionWord} the reference. ${difficulty === "easy" ? "Use the observed standard normal statistic." : "The sample mean is normal with the known standard error shown."} Test the inspector’s claim.`,
    lines: difficulty === "easy" ? [tex`\mu_0=${nullValue},\quad z_{\rm obs}=${statistic}`] :
      [tex`\mu_0=${nullValue},\quad \bar x=${mean}`, tex`\operatorname{SE}(\bar X)=${se}`],
    law: { family: "normal" }, statistic, tail, nullHypothesis: tex`\mu=${nullValue}`,
    alternative: tex`\mu${comparison(tail)}${nullValue}`, claim: `a ${direction} mean fill`,
    hints: ["Express the inspector’s claim as a comparison with the reference mean."],
    steps: difficulty === "easy" ? [] : [tex`z=\frac{${mean}-${nullValue}}{${se}}=${statistic}`]
  };
}

function oneMean(rng: SeededRandom, difficulty: Difficulty, known: boolean): Exercise {
  const tail = sampleTail(rng, difficulty);
  const statistic = observed(rng);
  const root = rng.int(2, difficulty === "easy" ? 4 : 7);
  const n = root ** 2;
  const se = rng.int(1, 4);
  const sd = se * root;
  const target = rng.int(30, 70);
  const mean = target + se * statistic;
  const symbol = known ? "\\sigma" : "s";
  const claim = tail === "two" ? "a different mean strength" : `a ${tail === "left" ? "lower" : "higher"} mean strength`;
  const lines = [tex`H_0:\mu=${target},\quad H_a:\mu${comparison(tail)}${target}`];
  const steps: string[] = [];
  if (difficulty === "hard") {
    lines.push(tex`n=${n},\quad \sum x_i=${n * mean}`);
    steps.push(tex`\bar x=\frac{${n * mean}}{${n}}=${mean}`);
    if (known) {
      lines.push(tex`\sigma^2=${sd ** 2}`);
      steps.push(tex`\sigma=\sqrt{${sd ** 2}}=${sd}`);
    } else {
      const residual = (n - 1) * sd ** 2;
      lines.push(tex`\sum(x_i-\bar x)^2=${residual}`);
      steps.push(tex`s^2=\frac{${residual}}{${n - 1}}=${sd ** 2}`);
    }
  } else {
    lines.push(tex`n=${n},\quad \bar x=${mean}`);
    lines.push(difficulty === "easy" ? `${symbol}=${sd}` : `${symbol}^2=${sd ** 2}`);
    if (difficulty === "medium") steps.push(tex`${symbol}=\sqrt{${sd ** 2}}=${sd}`);
  }
  steps.push(tex`\operatorname{SE}=\frac{${sd}}{\sqrt{${n}}}=${se}`,
    tex`${known ? "z" : "t"}=\frac{${mean}-${target}}{${se}}=${statistic}`);
  return {
    instruction: `Specimen strengths are independent observations from one normal population. Its standard deviation is ${known ? "known" : "unknown"}. Test the stated hypothesis about the population mean.`,
    lines, law: known ? { family: "normal" } : { family: "t", df: n - 1 }, statistic, tail,
    nullHypothesis: tex`\mu=${target}`, alternative: tex`\mu${comparison(tail)}${target}`, claim, steps,
    hints: [known ? "Standardize the observed mean using the known population standard deviation." : "Estimate the standard error from the sample; a one-sample t statistic has n − 1 null degrees of freedom."]
  };
}

function paired(rng: SeededRandom, difficulty: Difficulty): Exercise {
  const tail = sampleTail(rng, difficulty);
  const statistic = observed(rng);
  const scale = rng.int(1, 3);
  // Both centered patterns have five entries and a standard error exactly equal to one or two.
  const pattern = rng.pick([[-3, -1, 0, 1, 3], [-6, -3, 1, 3, 5]]);
  const se = (pattern[0] === -3 ? 1 : 2) * scale;
  const mean = statistic * se;
  const ds = pattern.map(x => mean + scale * x);
  for (let i = ds.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [ds[i], ds[j]] = [ds[j], ds[i]];
  }
  const n = ds.length;
  const s2 = n * se ** 2;
  const lines = [tex`H_0:\mu_D=0,\quad H_a:\mu_D${comparison(tail)}0`];
  const steps: string[] = [];
  let description: string;
  if (difficulty === "easy") {
    lines.push(tex`n=${n},\quad \bar d=${mean},\quad s_D^2=${s2}`);
    description = `Five paired differences have mean ${mean} and sample variance ${s2}.`;
  } else if (difficulty === "medium") {
    lines.push(tex`d_i:\quad ${ds.join(",\\ ")}`);
    description = `Differences after minus before: ${ds.join(", ")}.`;
  } else {
    const before = ds.map(() => rng.int(60, 85));
    const after = ds.map((d, i) => before[i] + d);
    lines.push(tex`\begin{array}{c|ccccc}\text{Before}&${before.join("&")}\\\text{After}&${after.join("&")}\end{array}`);
    description = before.map((v, i) => `Pair ${i + 1}, before ${v}, after ${after[i]}.`).join(" ");
    steps.push(tex`d_i:\quad ${ds.join(",\\ ")}`);
  }
  if (difficulty !== "easy") steps.push(tex`\bar d=\frac{${n * mean}}{${n}}=${mean}`, tex`s_D^2=\frac{\sum(d_i-\bar d)^2}{${n - 1}}=\frac{${(n - 1) * s2}}{${n - 1}}=${s2}`);
  steps.push(tex`\operatorname{SE}=\sqrt{\frac{${s2}}{${n}}}=${se}`, tex`t=\frac{${mean}}{${se}}=${statistic}`);
  const direction = tail === "left" ? "less than" : tail === "right" ? "greater than" : "different from";
  return {
    instruction: "Compare task times measured before and after training on the same participants. Differences D = after minus before are independent draws from a normal population. Test the stated hypothesis about the mean difference.",
    lines, description: `Null mean difference zero. Alternative mean difference ${direction} zero. ${description}`,
    statistic, law: { family: "t", df: n - 1 }, tail, nullHypothesis: tex`\mu_D=0`, alternative: tex`\mu_D${comparison(tail)}0`,
    claim: tail === "two" ? "a change in mean time" : `a ${tail === "left" ? "decrease" : "rise"} in mean time`, steps,
    hints: ["Analyze the after-minus-before differences as one sample. Use the number of pairs to find the degrees of freedom."]
  };
}

function pooled(rng: SeededRandom, difficulty: Difficulty): Exercise {
  const tail = sampleTail(rng, difficulty);
  const statistic = observed(rng);
  const equalN = difficulty === "easy";
  const root = rng.int(2, 4);
  const n1 = equalN ? 2 * root ** 2 : rng.pick([9, 16]);
  const n2 = equalN ? n1 : 25 - n1;
  const scale = rng.int(1, 3);
  const sd = (equalN ? root : 12) * scale;
  const se = (equalN ? 1 : 5) * scale;
  const v1 = sd ** 2 + (equalN ? 0 : n2 - 1);
  const v2 = sd ** 2 - (equalN ? 0 : n1 - 1);
  const df = n1 + n2 - 2;
  const target = difficulty === "hard" ? rng.int(1, 4) : 0;
  const second = rng.int(80, 110);
  const first = second + target + statistic * se;
  const delta = tex`\mu_A-\mu_B`;
  const lines = [tex`H_0:${delta}=${target}`, tex`H_a:${delta}${comparison(tail)}${target}`];
  const steps: string[] = [];
  if (difficulty === "hard") {
    lines.push(tex`(n_A,\bar x_A,Q_A)=(${n1},${first},${(n1 - 1) * v1})`, tex`(n_B,\bar x_B,Q_B)=(${n2},${second},${(n2 - 1) * v2})`);
  } else {
    lines.push(tex`(n_A,\bar x_A,s_A^2)=(${n1},${first},${v1})`, tex`(n_B,\bar x_B,s_B^2)=(${n2},${second},${v2})`);
  }
  steps.push(equalN ? tex`s_p^2=${v1}` : tex`s_p^2=\frac{${(n1 - 1) * v1}+${(n2 - 1) * v2}}{${df}}=${sd ** 2}`,
    tex`\operatorname{SE}=${sd}\sqrt{\frac{1}{${n1}}+\frac{1}{${n2}}}=${se}`,
    tex`t=\frac{(${first}-${second})-${target}}{${se}}=${statistic}`);
  const difference = tail === "left" ? "below" : tail === "right" ? "above" : "different from";
  return {
    instruction: `Two independent random samples of plant heights come from normal populations A and B with a common unknown variance. ${difficulty === "hard" ? "Each Q is the within-group sum of squared deviations from its sample mean. " : ""}Use a pooled t test for the stated difference in means.`,
    lines, statistic, law: { family: "t", df }, tail, nullHypothesis: `${delta}=${target}`, alternative: `${delta}${comparison(tail)}${target}`,
    claim: `a mean height difference ${difference} ${target}`, steps, hints: ["Pool the within-group sums of squares before taking the standard error. The null degrees of freedom are nA + nB − 2."]
  };
}

export const meanTestGenerators = {
  hypothesis_testing: exercise("hypothesis_testing", (r, d) => readingClaim(r, d, false), (r, d) => readingClaim(r, d, true)),
  one_sample_tests: exercise("one_sample_tests", (r, d) => oneMean(r, d, true), (r, d) => oneMean(r, d, false)),
  comparing_means: exercise("comparing_means", paired, pooled)
};
