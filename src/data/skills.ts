import type { SkillDefinition, SkillId } from "../types";

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
  }
];

export const skillIds = skills.map((skill) => skill.id);
export const algebraSkillIds = skills.filter((skill) => skill.track === "algebra").map((skill) => skill.id);
export const linearAlgebraSkillIds = skills.filter((skill) => skill.track === "linear_algebra").map((skill) => skill.id);

export function getSkill(id: SkillId): SkillDefinition {
  const skill = skills.find((item) => item.id === id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
}

