import type { SkillDefinition, SkillId, TrackId } from "../types";

export const skills: SkillDefinition[] = [
  {
    id: "expressions",
    title: "Expressions",
    shortTitle: "Expressions",
    description: "Collect like terms, distribute factors, and evaluate expressions.",
    prerequisites: [],
    track: "algebra"
  },
  {
    id: "linear",
    title: "Equations & inequalities",
    shortTitle: "Linear",
    description: "Solve one-variable equations and write inequality solution intervals.",
    prerequisites: ["expressions"],
    track: "algebra"
  },
  {
    id: "lines_systems",
    title: "Lines & systems",
    shortTitle: "Lines",
    description: "Find line equations and solve two-variable systems.",
    prerequisites: ["linear"],
    track: "algebra"
  },
  {
    id: "exponents_radicals",
    title: "Exponents & radicals",
    shortTitle: "Powers",
    description: "Apply exponent laws and simplify exact radicals.",
    prerequisites: ["expressions"],
    track: "algebra"
  },
  {
    id: "polynomials",
    title: "Polynomials",
    shortTitle: "Polynomials",
    description: "Add, multiply, and simplify polynomial expressions.",
    prerequisites: ["expressions", "exponents_radicals"],
    track: "algebra"
  },
  {
    id: "factoring_quadratics",
    title: "Factoring & quadratics",
    shortTitle: "Quadratics",
    description: "Factor quadratics and solve for their real roots.",
    prerequisites: ["polynomials"],
    track: "algebra"
  },
  {
    id: "rational",
    title: "Rational expressions",
    shortTitle: "Rational",
    description: "Simplify rational expressions and solve rational equations.",
    prerequisites: ["factoring_quadratics"],
    track: "algebra"
  },
  {
    id: "functions",
    title: "Functions",
    shortTitle: "Functions",
    description: "Evaluate, compose, and interpret function rules.",
    prerequisites: ["linear", "polynomials"],
    track: "algebra"
  },
  {
    id: "vectors",
    title: "Vectors & dot products",
    shortTitle: "Vectors",
    description: "Combine vectors and calculate dot products.",
    prerequisites: [],
    track: "linear_algebra"
  },
  {
    id: "matrices",
    title: "Matrix arithmetic",
    shortTitle: "Matrices",
    description: "Add and multiply small matrices.",
    prerequisites: ["vectors"],
    track: "linear_algebra"
  },
  {
    id: "linear_systems",
    title: "Systems & row reduction",
    shortTitle: "Systems",
    description: "Solve three-variable systems and reduce augmented matrices.",
    prerequisites: ["matrices"],
    track: "linear_algebra"
  },
  {
    id: "determinants_inverses",
    title: "Determinants & inverses",
    shortTitle: "Determinants",
    description: "Find determinants and invert nonsingular two-by-two matrices.",
    prerequisites: ["linear_systems"],
    track: "linear_algebra"
  },
  {
    id: "eigen",
    title: "Eigenvalues & eigenvectors",
    shortTitle: "Eigen",
    description: "Find eigenvalues and an eigenvector for a given eigenvalue.",
    prerequisites: ["determinants_inverses"],
    track: "linear_algebra"
  },
  {
    id: "counting",
    title: "Permutations & combinations",
    shortTitle: "Counting",
    description: "Count the ways to fill distinct roles or choose a group.",
    prerequisites: [],
    track: "statistics_probability"
  },
  {
    id: "conditional_probability",
    title: "Conditional probability",
    shortTitle: "Conditioning",
    description: "Use what you know about one event to find the probability of another.",
    prerequisites: ["counting"],
    track: "statistics_probability"
  },
  {
    id: "discrete_variables",
    title: "Discrete random variables",
    shortTitle: "Discrete variables",
    description: "Find a mean or variance from probability masses and calculate binomial probabilities.",
    prerequisites: ["conditional_probability"],
    track: "statistics_probability"
  },
  {
    id: "continuous_variables",
    title: "Continuous random variables",
    shortTitle: "Densities",
    description: "Normalize a density and integrate it to find the probability of an interval.",
    prerequisites: ["discrete_variables"],
    track: "statistics_probability"
  },
  {
    id: "transformations",
    title: "Transformations of random variables",
    shortTitle: "Transformations",
    description: "Find a cumulative distribution or density after a change of variable.",
    prerequisites: ["continuous_variables"],
    track: "statistics_probability"
  },
  {
    id: "sampling_distributions",
    title: "Sample means & the central limit theorem",
    shortTitle: "Sample means",
    description: "Find the distribution of a sample mean and use the central limit theorem to approximate a sampling distribution.",
    prerequisites: ["discrete_variables", "continuous_variables"],
    track: "statistics_probability"
  },
  {
    id: "one_sample_laws",
    title: "One-sample sampling laws",
    shortTitle: "One sample",
    description: "Identify the sampling laws for statistics based on a normal sample’s mean and variance.",
    prerequisites: ["sampling_distributions"],
    track: "statistics_probability"
  },
  {
    id: "two_sample_laws",
    title: "Two-sample sampling laws",
    shortTitle: "Two samples",
    description: "Work with differences of sample means and ratios of sample variances from independent normal samples.",
    prerequisites: ["one_sample_laws"],
    track: "statistics_probability"
  }
];

export const skillIds = skills.map((skill) => skill.id);
export const algebraSkillIds = skills.filter((skill) => skill.track === "algebra").map((skill) => skill.id);
export const linearAlgebraSkillIds = skills.filter((skill) => skill.track === "linear_algebra").map((skill) => skill.id);
export const statisticsSkillIds = skills.filter((skill) => skill.track === "statistics_probability").map((skill) => skill.id);

export const trackIds = ["algebra", "linear_algebra", "statistics_probability"] as const;
export const tracks = {
  algebra: {
    title: "Algebra", path: "/practice/", skillIds: algebraSkillIds,
    preference: "preferredSkill", guidedLabel: "Adaptive queue"
  },
  linear_algebra: {
    title: "Linear algebra", path: "/linear-algebra/", skillIds: linearAlgebraSkillIds,
    preference: "preferredLinearSkill", guidedLabel: "Guided queue"
  },
  statistics_probability: {
    title: "Statistics & probability", path: "/statistics-probability/", skillIds: statisticsSkillIds,
    preference: "preferredStatisticsSkill", guidedLabel: "Guided queue"
  }
} as const satisfies Record<TrackId, {
  title: string; path: string; skillIds: SkillId[];
  preference: "preferredSkill" | "preferredLinearSkill" | "preferredStatisticsSkill"; guidedLabel: string;
}>;

export function getSkill(id: SkillId): SkillDefinition {
  const skill = skills.find((item) => item.id === id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
}

