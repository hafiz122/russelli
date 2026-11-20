import type { Difficulty, Question, QuestionGenerator } from "../types";
import { distributionAnswer } from "./distributions";
import { fraction } from "./format";
import { SeededRandom } from "./rng";
import { validateAnswer } from "./validator";

const tex = String.raw;
export const samplingFormIds = {
  sampling_distributions: ["normal_mean", "central_limit"],
  one_sample_laws: ["studentized_mean", "sample_variance"],
  two_sample_laws: ["difference_of_means", "variance_ratio"]
} as const;

type SamplingSkill = keyof typeof samplingFormIds;
type Form = (rng: SeededRandom, difficulty: Difficulty) =>
  Pick<Question, "promptLatex" | "instruction" | "answer" | "hints" | "workedSolution">;

function generator(skillId: SamplingSkill, even: Form, odd: Form): QuestionGenerator {
  return {
    skillId,
    validate: validateAnswer,
    generate(seed, difficulty) {
      const parity = seed % 2 === 0 ? 0 : 1;
      const formId = samplingFormIds[skillId][parity];
      const details = (parity === 0 ? even : odd)(new SeededRandom(seed), difficulty);
      return {
        id: `${skillId}:${difficulty}:${seed}`,
        seed, generatorVersion: 1, skillId, difficulty, formId,
        problemKey: `${skillId}:${formId}:${details.promptLatex}`,
        ...details
      };
    }
  };
}

const normalMean: Form = (rng, difficulty) => {
  const n = difficulty === "easy" ? rng.pick([4, 9, 16]) : rng.int(5, 24);
  const mu = difficulty === "hard" ? rng.int(-8, 8) : rng.int(1, 12);
  const sigma = rng.int(2, 10);
  const variance = difficulty === "easy" ? n * rng.int(1, 5) : sigma ** 2;
  const secondMoment = mu ** 2 + variance;
  let given = tex`\sigma^2=${variance}`;
  const steps: string[] = [];
  if (difficulty === "medium") {
    given = tex`\sigma=${sigma}`;
    steps.push(tex`\sigma^2=${sigma}^2=${variance}`);
  } else if (difficulty === "hard") {
    given = tex`E[X_i^2]=${secondMoment}`;
    steps.push(tex`\sigma^2=${secondMoment}-(${mu})^2=${variance}`);
  }
  const meanVariance = fraction(variance, n);
  const answer = distributionAnswer("normal", String(mu), meanVariance);
  return {
    instruction: "The observations are independent draws from the same normal population. Find the exact distribution of their sample mean.",
    promptLatex: tex`n=${n},\quad \mu=${mu},\quad ${given}`,
    hints: ["A mean of independent normal observations is normal.", "The mean keeps the population center. Divide the population variance by the sample size."],
    answer,
    workedSolution: [
      ...steps,
      tex`E[\bar X]=${mu}`,
      tex`\operatorname{Var}(\bar X)=\frac{\sigma^2}{n}=${meanVariance}`,
      tex`\operatorname{SE}(\bar X)=\sqrt{${meanVariance}}`,
      tex`\bar X\sim\boxed{${answer.latex}}`
    ]
  };
};

const centralLimit: Form = (rng, difficulty) => {
  const denominator = difficulty === "easy" ? 2 : rng.int(3, 6);
  const highWeight = rng.int(1, denominator - 1);
  const lowWeight = denominator - highWeight;
  const low = difficulty === "hard" ? rng.int(-5, -1) : 0;
  const high = difficulty === "hard" ? rng.int(2, 8) : 1;
  const n = denominator * rng.int(25, 60);
  const sum = difficulty === "easy" || (difficulty === "hard" && rng.pick([true, false]));
  const meanNumerator = low * lowWeight + high * highWeight;
  const varianceNumerator = lowWeight * highWeight * (high - low) ** 2;
  const mean = fraction(meanNumerator, denominator);
  const variance = fraction(varianceNumerator, denominator ** 2);
  const answer = distributionAnswer("normal",
    sum ? fraction(n * meanNumerator, denominator) : mean,
    sum ? fraction(n * varianceNumerator, denominator ** 2) : fraction(varianceNumerator, n * denominator ** 2)
  );
  return {
    instruction: "Each independent draw has the same two possible values with the probabilities shown. Use the central limit theorem to approximate the distribution of Y.",
    promptLatex: tex`P(X_i=${low})=${fraction(lowWeight, denominator)},\quad P(X_i=${high})=${fraction(highWeight, denominator)},\quad n=${n},\quad Y=${sum ? tex`\sum_{i=1}^n X_i` : tex`\bar X`}`,
    hints: ["First find the mean and variance of one draw from its two possible values.", sum
      ? "For a sum of independent draws, both the mean and the variance grow by a factor of n."
      : "For a sample mean, keep the mean of one draw and divide its variance by n."],
    answer,
    workedSolution: [
      tex`\mu=(${low})\,${fraction(lowWeight, denominator)}+(${high})\,${fraction(highWeight, denominator)}=${mean}`,
      tex`\sigma^2=E[X_i^2]-\mu^2=${variance}`,
      sum ? tex`E[Y]=n\mu,\quad \operatorname{Var}(Y)=n\sigma^2` : tex`E[Y]=\mu,\quad \operatorname{Var}(Y)=\sigma^2/n`,
      tex`\mathcal{L}(Y)\approx\boxed{${answer.latex}}`
    ]
  };
};

const studentizedMean: Form = (rng, difficulty) => {
  const n = rng.int(5, difficulty === "easy" ? 18 : 45);
  const df = n - 1;
  const answer = distributionAnswer("t", String(df));
  const residualForm = difficulty === "hard";
  const statistic = difficulty === "easy" ? tex`\frac{\bar X-\mu}{S/\sqrt n}`
    : residualForm ? tex`\frac{\bar X-\mu}{\sqrt{Q/[n(n-1)]}}` : tex`\frac{\sqrt n(\bar X-\mu)}{S}`;
  return {
    instruction: residualForm
      ? "For independent draws from the same normal population with mean μ, identify the exact distribution of T."
      : "The observations are independent draws from a normal population with mean μ. The sample variance S² uses divisor n − 1. Find the exact distribution of T.",
    promptLatex: tex`n=${n},\quad ${residualForm ? tex`Q=\sum_{i=1}^n(X_i-\bar X)^2,\quad ` : ""}T=${statistic}`,
    hints: ["Check whether the denominator uses the population spread or estimates it from this sample.", "The deviations from the sample mean sum to zero, leaving n − 1 degrees of freedom."],
    answer,
    workedSolution: [
      ...(residualForm ? [tex`S^2=Q/(n-1)`] : []),
      tex`Z=\frac{\bar X-\mu}{\sigma/\sqrt n}\sim N(0,1)`,
      tex`U=\frac{(n-1)S^2}{\sigma^2}\sim\chi^2_{n-1}`,
      tex`Z\perp U,\quad T=\frac{Z}{\sqrt{U/(n-1)}}`,
      tex`T\sim\boxed{${answer.latex}}`
    ]
  };
};

const sampleVariance: Form = (rng, difficulty) => {
  const n = rng.int(5, difficulty === "easy" ? 18 : 45);
  const sigma = rng.int(2, 9);
  const variance = sigma ** 2;
  const answer = distributionAnswer("chi_square", String(n - 1));
  let statistic: string;
  let instruction = "The observations are independent draws from the same normal population. Find the exact distribution of V.";
  if (difficulty === "easy") {
    instruction += " The sample variance S² uses divisor n − 1.";
    statistic = tex`V=\frac{(n-1)S^2}{${variance}}`;
  } else if (difficulty === "medium") {
    statistic = tex`Q=\sum_{i=1}^n(X_i-\bar X)^2,\quad V=Q/${variance}`;
  } else {
    statistic = tex`M_2=\frac{1}{n}\sum_{i=1}^n X_i^2,\quad V=\frac{n(M_2-\bar X^2)}{${variance}}`;
  }
  return {
    instruction,
    promptLatex: tex`n=${n},\quad \sigma^2=${variance},\quad ${statistic}`,
    hints: ["Rewrite the numerator as a sum of squared deviations from the sample mean.", "Estimating the mean uses one degree of freedom."],
    answer,
    workedSolution: [
      ...(difficulty === "hard" ? [tex`n(M_2-\bar X^2)=\sum_{i=1}^n(X_i-\bar X)^2`] : []),
      tex`(n-1)S^2=\sum_{i=1}^n(X_i-\bar X)^2`,
      tex`V=\frac{(n-1)S^2}{\sigma^2},\quad n-1=${n - 1}`,
      tex`V\sim\boxed{${answer.latex}}`
    ]
  };
};

const differenceOfMeans: Form = (rng, difficulty) => {
  const mu1 = rng.int(1, 12);
  const mu2 = rng.int(difficulty === "hard" ? -10 : 1, 12);
  const n1 = difficulty === "easy" ? rng.pick([4, 9, 16]) : rng.int(3, 16);
  const n2 = difficulty === "easy" ? n1 : rng.int(3, 18);
  const sigma1 = rng.int(2, 6);
  const sigma2 = rng.int(2, 6);
  const variance1 = difficulty === "easy" ? n1 * rng.int(1, 4) : sigma1 ** 2;
  const variance2 = difficulty === "easy" ? n2 * rng.int(1, 4) : sigma2 ** 2;
  const differenceVariance = fraction(variance1 * n2 + variance2 * n1, n1 * n2);
  const answer = distributionAnswer("normal", String(mu1 - mu2), differenceVariance);
  const exponent = difficulty === "hard" ? "" : "^2";
  return {
    instruction: "Two independent random samples come from normal populations. Find the exact distribution of the first sample mean minus the second.",
    promptLatex: tex`(\mu_1,\sigma_1${exponent},n_1)=(${mu1},${difficulty === "hard" ? sigma1 : variance1},${n1}),\quad (\mu_2,\sigma_2${exponent},n_2)=(${mu2},${difficulty === "hard" ? sigma2 : variance2},${n2}),\quad D=\bar X_1-\bar X_2`,
    hints: ["A difference of independent normal variables is normal.", "Subtract the centers. Independence makes the two variance contributions add."],
    answer,
    workedSolution: [
      tex`E[D]=${mu1}-(${mu2})=${mu1 - mu2}`,
      tex`\operatorname{Var}(D)=\frac{\sigma_1^2}{n_1}+\frac{\sigma_2^2}{n_2}`,
      tex`=\frac{${variance1}}{${n1}}+\frac{${variance2}}{${n2}}=${differenceVariance}`,
      tex`D\sim\boxed{${answer.latex}}`
    ]
  };
};

const varianceRatio: Form = (rng, difficulty) => {
  const n1 = rng.int(5, 24);
  const otherSize = rng.int(5, 23);
  const n2 = otherSize < n1 ? otherSize : otherSize + 1;
  const i = difficulty === "easy" ? 1 : rng.pick([1, 2]);
  const j = 3 - i;
  const dof = [n1 - 1, n2 - 1];
  const answer = distributionAnswer("f", String(dof[i - 1]), String(dof[j - 1]));
  let ratio: string;
  if (difficulty === "easy") ratio = tex`\frac{S_1^2}{S_2^2}`;
  else if (difficulty === "medium") ratio = tex`\frac{S_${i}^2/\sigma_${i}^2}{S_${j}^2/\sigma_${j}^2}`;
  else ratio = tex`\frac{\sigma_${j}^2 S_${i}^2}{\sigma_${i}^2 S_${j}^2}`;
  return {
    instruction: `Two independent random samples come from normal populations${difficulty === "easy" ? " with equal variances" : ""}. Each sample variance uses its sample size minus one as the divisor. Find the exact distribution of R.`,
    promptLatex: tex`n_1=${n1},\quad n_2=${n2},\quad R=${ratio}`,
    hints: ["Normalize each sample variance by its population variance.", "Keep track of which sample variance is in the numerator. Its degrees of freedom come first."],
    answer,
    workedSolution: [
      tex`U_k=\frac{(n_k-1)S_k^2}{\sigma_k^2}\sim\chi^2_{n_k-1}`,
      tex`U_1\perp U_2,\quad R=\frac{U_${i}/${dof[i - 1]}}{U_${j}/${dof[j - 1]}}`,
      tex`R\sim\boxed{${answer.latex}}`
    ]
  };
};

export const samplingGenerators = {
  sampling_distributions: generator("sampling_distributions", normalMean, centralLimit),
  one_sample_laws: generator("one_sample_laws", studentizedMean, sampleVariance),
  two_sample_laws: generator("two_sample_laws", differenceOfMeans, varianceRatio)
};
