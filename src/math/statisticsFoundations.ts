import { fraction, signedTerm } from "./format";
import { SeededRandom } from "./rng";
import { validateAnswer } from "./validator";
import type { AnswerSpec, Difficulty, Question, QuestionGenerator } from "../types";

export const statisticsFoundationFormIds = {
  counting: ["permutations", "combinations"],
  conditional_probability: ["conditional_draw", "bayes"],
  discrete_variables: ["finite_moments", "binomial_probability"],
  continuous_variables: ["normalize_density", "density_probability"],
  transformations: ["transformed_cdf", "transformed_density"]
} as const;

type Topic = keyof typeof statisticsFoundationFormIds;
type Problem = Pick<Question, "instruction" | "promptLatex" | "promptDescription" | "hints" | "workedSolution"> & {
  givens: (number | string)[];
  answer: string;
  kind?: AnswerSpec["kind"];
  equivalentLatex?: string[];
};

function generator(topic: Topic, make: (rng: SeededRandom, difficulty: Difficulty, even: boolean) => Problem): QuestionGenerator {
  return {
    skillId: topic,
    validate: validateAnswer,
    generate(seed, difficulty) {
      const even = seed % 2 === 0;
      const formId = statisticsFoundationFormIds[topic][even ? 0 : 1];
      const { givens, answer, kind = "number", equivalentLatex, workedSolution, ...prompt } = make(new SeededRandom(seed), difficulty, even);
      return {
        ...prompt, seed, difficulty, formId, skillId: topic, generatorVersion: 1,
        id: `${topic}:${difficulty}:${seed}`,
        problemKey: `${topic}:${formId}:${givens.join(",")}`,
        answer: { kind, latex: answer, ...(equivalentLatex && { equivalentLatex }) },
        workedSolution: [...workedSolution, `\\boxed{${answer}}`]
      };
    }
  };
}

function arrangements(n: number, k: number): number {
  let value = 1;
  for (let i = 0; i < k; i++) value *= n - i;
  return value;
}

function choose(n: number, k: number): number {
  return arrangements(n, k) / arrangements(k, k);
}

function power(base: string, exponent: number): string {
  if (exponent === 0) return "1";
  return exponent === 1 ? base : `${base}^{${exponent}}`;
}

const counting = generator("counting", (rng, difficulty, ordered) => {
  const restricted = difficulty !== "easy";
  const named = difficulty === "hard" ? 2 : Number(restricted);
  const n = rng.int(5 + named, 9 + named);
  const k = rng.int(2 + named, Math.min(n - 2, 4 + named));
  const target = ordered ? "fill the first k places in a race, with no ties" : "form a committee of k people with no distinct offices";
  const condition = ["", " One specified person must be included.", " Exactly one of two specified people must be included."][named];
  const remaining = n - named;
  const free = k - Number(restricted);
  const multiplier = restricted ? named * (ordered ? k : 1) : 1;
  const count = ordered ? arrangements(remaining, free) : choose(remaining, free);
  const factor = multiplier === 1 ? "" : `${multiplier}\\cdot `;
  const formula = ordered ? `\\frac{${remaining}!}{${remaining - free}!}` : `\\binom{${remaining}}{${free}}`;
  const setup: string[] = [];
  if (restricted && ordered) setup.push(`\\text{Choices for the required runner and place}=${named}\\cdot ${k}=${multiplier}`);
  if (named === 2 && !ordered) setup.push("\\binom{2}{1}=2");
  return {
    instruction: `From n different people, how many ways are there to ${target}?${condition}`,
    promptLatex: `n=${n},\\quad k=${k}`, givens: [n, k, named], answer: String(multiplier * count),
    hints: [restricted ? "Choose the required person first and set aside anyone excluded." : "Decide whether exchanging two chosen people changes the outcome.",
      ordered ? "Fill the distinct places without using anyone twice." : "Each group counts once, regardless of the order in which it was chosen."],
    workedSolution: [...setup, `N=${factor}${formula}=${factor}${count}`]
  };
});

const conditionalProbability = generator("conditional_probability", (rng, difficulty, conditional) => {
  if (conditional) {
    const red = rng.int(3, 9);
    const blue = rng.int(2, 8);
    const total = red + blue - 1;
    const r = red - 1;
    const easy = difficulty === "easy";
    const mixed = difficulty === "hard";
    const event = easy ? "the next bead is red" : mixed ? "the next two beads have different colors" : "the next two beads are both red";
    const product = mixed ? `2\\cdot${r}\\cdot${blue}` : `${r}\\cdot${r - 1}`;
    return {
      instruction: `A bag holds R red and B blue beads. Draw uniformly without replacement. Given that the first bead was red, find the probability that ${event}.`,
      promptLatex: `R=${red},\\quad B=${blue}`, givens: [red, blue, difficulty],
      answer: easy ? fraction(r, total) : fraction(mixed ? 2 * r * blue : r * (r - 1), total * (total - 1)),
      hints: ["Remove the known red bead before counting.", mixed ? "Red then blue and blue then red are disjoint possibilities." : "Use the remaining counts for each draw."],
      workedSolution: [`R'=${r},\\quad B'=${blue},\\quad N'=${total}`,
        easy ? `P=\\frac{${r}}{${total}}` : `P=\\frac{${product}}{${total}\\cdot${total - 1}}`]
    };
  }
  const a = difficulty === "easy" ? 1 : rng.int(2, 4);
  const b = difficulty === "easy" ? 1 : rng.int(1, a - 1);
  const sizeA = rng.int(5, 8);
  const sizeB = difficulty === "hard" ? sizeA + rng.int(1, 4) : sizeA;
  const redA = rng.int(1, sizeA - 1);
  const prior = fraction(a, a + b);
  const rateA = fraction(redA, sizeA);
  const redMassA = a * redA * sizeB;
  const posterior = (red: number) => fraction(redMassA, redMassA + b * red * sizeA);
  // As redB grows, the posterior falls and B's red rate rises. Each given can exclude at most one of four or more counts.
  const redCountsB = Array.from({ length: sizeB - 1 }, (_, i) => i + 1).filter(red =>
    ![prior, rateA, fraction(red, sizeB)].includes(posterior(red)));
  const redB = rng.pick(redCountsB);
  const rateB = fraction(redB, sizeB);
  const jointA = fraction(a * redA, (a + b) * sizeA);
  const jointB = fraction(b * redB, (a + b) * sizeB);
  const redProbability = fraction(redMassA + b * redB * sizeA, (a + b) * sizeA * sizeB);
  return {
    instruction: "Choose box A or B, then draw one bead uniformly from that box. R denotes a red draw. Given a red bead, find the probability it came from A.",
    promptLatex: `\\begin{gathered}P(A)=${prior}\\\\P(R\\mid A)=${rateA}\\\\P(R\\mid B)=${rateB}\\end{gathered}`,
    givens: [prior, rateA, rateB], answer: posterior(redB),
    hints: ["Multiply each box's selection probability by its conditional red probability.", "Divide the probability of a red draw from A by the total probability of a red draw."],
    workedSolution: [`P(A\\cap R)=${prior}\\cdot${rateA}=${jointA}`, `P(B\\cap R)=${fraction(b, a + b)}\\cdot${rateB}=${jointB}`,
      `P(R)=${jointA}+${jointB}=${redProbability}`, `P(A\\mid R)=\\frac{P(A\\cap R)}{P(R)}=\\frac{${jointA}}{${redProbability}}`]
  };
});

const discreteVariables = generator("discrete_variables", (rng, difficulty, moments) => {
  if (moments) {
    const xs = [rng.int(-3, 0), rng.int(1, 3), rng.int(4, 7)];
    const weights = xs.map(() => rng.int(1, 4));
    const total = weights.reduce((sum, w) => sum + w, 0);
    const mass = weights.map(w => fraction(w, total));
    const first = xs.reduce((sum, x, i) => sum + weights[i] * x, 0);
    const second = xs.reduce((sum, x, i) => sum + weights[i] * x * x, 0);
    const mean = fraction(first, total);
    const variance = fraction(second * total - first ** 2, total ** 2);
    const scale = difficulty === "hard" ? rng.int(2, 4) : 1;
    const offset = difficulty === "hard" ? rng.int(1, 5) : 0;
    const moment = difficulty === "easy" ? "E[X]" : difficulty === "medium" ? "\\operatorname{Var}(X)" : `\\operatorname{Var}(${scale}X+${offset})`;
    const steps = [`E[X]=\\sum_x xp(x)=\\frac{${first}}{${total}}=${mean}`];
    if (difficulty !== "easy") steps.push(`E[X^2]=\\sum_x x^2p(x)=${fraction(second, total)}`, `\\operatorname{Var}(X)=${fraction(second, total)}-\\left(${mean}\\right)^2=${variance}`);
    if (difficulty === "hard") steps.push(`${moment}=${scale}^2\\operatorname{Var}(X)`);
    return {
      instruction: "The table gives the entire probability mass function of X. Find the indicated moment.",
      promptDescription: xs.map((x, i) => `X equals ${x} with probability ${weights[i]} over ${total}.`).join(" ") +
        (difficulty === "easy" ? " Find the expected value of X." : difficulty === "medium" ? " Find the variance of X." : ` Find the variance of ${scale} times X plus ${offset}.`),
      promptLatex: `\\begin{gathered}\\begin{array}{c|ccc}x&${xs.join("&")}\\\\p(x)&${mass.join("&")}\\end{array}\\\\${moment}\\end{gathered}`,
      givens: [...xs, ...mass, moment], answer: difficulty === "easy" ? mean : fraction(scale ** 2 * (second * total - first ** 2), total ** 2),
      hints: ["Weight each value by its probability when taking a mean.", difficulty === "easy" ? "Sum the weighted values." : "Use the second moment minus the square of the first moment."], workedSolution: steps
    };
  }
  const n = difficulty === "easy" ? rng.int(3, 5) : difficulty === "medium" ? rng.int(4, 7) : rng.int(5, 8);
  const d = difficulty === "easy" ? 2 : rng.int(3, 5);
  const p = difficulty === "easy" ? 1 : rng.int(1, d - 1);
  const k = difficulty === "medium" ? 1 : rng.int(1, difficulty === "easy" ? n - 1 : 2);
  const probability = fraction(p, d);
  const term = (j: number) => choose(n, j) * p ** j * (d - p) ** (n - j);
  const denominator = d ** n;
  const easy = difficulty === "easy";
  const tail = difficulty === "medium";
  const numerator = easy ? term(k) : tail ? denominator - term(0) : Array.from({ length: k + 1 }, (_, j) => term(j)).reduce((a, b) => a + b);
  const event = easy ? `X=${k}` : tail ? "X\\ge 1" : `X\\le ${k}`;
  return {
    instruction: "Each of n independent trials succeeds with probability p. X counts the successes. Find the indicated probability.",
    promptLatex: `n=${n},\\quad p=${probability},\\quad P(${event})`, givens: [n, probability, event], answer: fraction(numerator, denominator),
    hints: ["Use the binomial model for a count of independent successes.", tail ? "The complement of at least one success is no successes." : "For j successes, count the possible positions of those successes."],
    workedSolution: [`P(X=j)=\\binom{${n}}{j}\\left(${probability}\\right)^j\\left(${fraction(d - p, d)}\\right)^{${n}-j}`,
      easy ? `P(${event})=\\binom{${n}}{${k}}\\frac{${p}^{${k}}\\cdot ${d - p}^{${n - k}}}{${denominator}}` :
        tail ? `P(${event})=1-P(X=0)=1-${fraction(term(0), denominator)}` :
        `P(${event})=\\sum_{j=0}^{${k}} P(X=j)=\\frac{${Array.from({ length: k + 1 }, (_, j) => term(j)).join("+")}}{${denominator}}`]
  };
});

const continuousVariables = generator("continuous_variables", (rng, difficulty, normalize) => {
  const degree = difficulty === "easy" ? 1 : rng.int(2, difficulty === "hard" ? 4 : 3);
  const offset = difficulty === "easy" ? 0 : rng.int(1, 4);
  const lo = difficulty === "hard" ? rng.int(1, 3) : 0;
  const hi = lo + rng.int(3, 6);
  const a = difficulty === "easy" ? lo : rng.int(lo, hi - 2);
  const b = rng.int(a + 1, hi - 1);
  const m = degree + 1;
  const integralNumerator = (l: number, u: number) => u ** m - l ** m + m * offset * (u - l);
  const area = integralNumerator(lo, hi);
  const coefficient = fraction(m, area);
  const polynomial = power("x", degree) + signedTerm(offset);
  const base = offset ? `\\left(${polynomial}\\right)` : polynomial;
  const antiderivative = `\\frac{${power("x", m)}}{${m}}${signedTerm(offset, "x")}`;
  const event = `P(${a}<X<${b})`;
  return {
    instruction: normalize ? "This density is zero outside the stated interval. Find its normalizing constant c." : "This density is zero outside the stated interval. Find the indicated probability.",
    promptLatex: `\\begin{gathered}f(x)=${normalize ? "c" : coefficient}${base},\\quad ${lo}<x<${hi}${normalize ? "" : `\\\\${event}`}\\end{gathered}`,
    givens: normalize ? [degree, offset, lo, hi] : [degree, offset, lo, hi, a, b],
    answer: normalize ? coefficient : fraction(integralNumerator(a, b), area),
    hints: [normalize ? "The total area under the density equals one." : "Integrate the density between the two event bounds.", "Integrate each power and evaluate the antiderivative at both endpoints."],
    workedSolution: normalize ? [`1=c\\int_{${lo}}^{${hi}}${base}\\,dx`, `1=c\\left[${antiderivative}\\right]_{${lo}}^{${hi}}=c\\cdot${fraction(area, m)}`, `c=\\frac{${m}}{${area}}`] :
      [`${event}=${coefficient}\\int_{${a}}^{${b}}${base}\\,dx`, `=${coefficient}\\left[${antiderivative}\\right]_{${a}}^{${b}}=${coefficient}\\cdot${fraction(integralNumerator(a, b), m)}`]
  };
});

const transformations = generator("transformations", (rng, difficulty, cdf) => {
  const hard = difficulty === "hard";
  const degree = hard ? 2 : 1;
  const exponent = difficulty === "easy" ? 1 : rng.int(2, 3);
  const shape = degree * exponent;
  const scale = rng.int(2, 6);
  const shift = hard ? scale + rng.int(1, 5) : rng.int(1, 6);
  const lower = hard ? shift - scale : shift;
  const upper = hard ? shift : shift + scale;
  const transform = `${shift}${signedTerm(hard ? -scale : scale, power("X", degree))}`;
  const u = `\\frac{${hard ? `${shift}-y` : `y-${shift}`}}{${scale}}`;
  const unit = `\\left(${u}\\right)`;
  const cdfAnswer = `${hard ? "1-" : ""}${power(unit, exponent)}`;
  const derivativeScale = fraction(exponent, scale);
  const densityPower = power(unit, exponent - 1);
  let densityAnswer = derivativeScale;
  if (exponent > 1) densityAnswer = derivativeScale === "1" ? densityPower : `${derivativeScale}\\cdot ${densityPower}`;
  const inverse = hard ? `\\sqrt{${u}}` : u;
  const fx = shape === 1 ? "1" : `${shape}${power("x", shape - 1)}`;
  const steps = [`F_X(x)=${power("x", shape)},\\quad 0<x<1`, `x=g^{-1}(y)=${inverse}`];
  const equivalentLatex: string[] = [];
  if (cdf) {
    steps.push(`F_Y(y)=${hard ? "1-" : ""}F_X\\left(${inverse}\\right)`);
  } else {
    const jacobian = hard ? `\\frac{1}{${2 * scale}${inverse}}` : fraction(1, scale);
    steps.push(`f_Y(y)=f_X\\left(g^{-1}(y)\\right)\\left|\\frac{d}{dy}g^{-1}(y)\\right|`,
      `\\left|\\frac{dx}{dy}\\right|=${jacobian}`);
    if (hard) {
      equivalentLatex.push(`${shape}${power(`\\left(${inverse}\\right)`, shape - 1)}\\left|-${jacobian}\\right|`);
    }
    if (exponent > 1) {
      // Both orientations have magnitude u on the interior support, where 0 < u < 1.
      for (const difference of [`y-${shift}`, `${shift}-y`]) {
        const magnitude = `\\left|\\frac{${difference}}{${scale}}\\right|`;
        equivalentLatex.push(`${derivativeScale}\\cdot${power(magnitude, exponent - 1)}`);
      }
    }
  }
  return {
    instruction: `X has the density shown on (0, 1) and zero density elsewhere. For the stated interior range of y, enter the ${cdf ? "CDF" : "density"} of Y as an expression in y.`,
    promptLatex: `\\begin{gathered}f_X(x)=${fx},\\quad Y=${transform}\\\\${lower}<y<${upper}\\end{gathered}`,
    givens: [shape, hard ? -scale : scale, degree, shift], answer: cdf ? cdfAnswer : densityAnswer, kind: "expression",
    ...(equivalentLatex.length > 0 && { equivalentLatex }),
    hints: ["Solve the transformation for x on the support of X.", cdf ? "Translate the event Y ≤ y into an inequality for X, accounting for the direction of the transformation." : "Multiply the original density at the inverse by the absolute derivative of the inverse."],
    workedSolution: steps
  };
});

export const statisticsFoundationGenerators = {
  counting, conditional_probability: conditionalProbability, discrete_variables: discreteVariables,
  continuous_variables: continuousVariables, transformations
};
