import { fraction, signedTerm } from "./format";
import { SeededRandom } from "./rng";
import { validateAnswer } from "./validator";
import type { Difficulty, Question, QuestionGenerator, SkillId } from "../types";

type Matrix = number[][];
const limits: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 4 };
const validate: QuestionGenerator["validate"] = validateAnswer;

function latexMatrix(rows: (number | string)[][]): string {
  return `\\begin{bmatrix}${rows.map((row) => row.join("&")).join("\\\\")}\\end{bmatrix}`;
}

function matrix(rng: SeededRandom, rows: number, cols: number, limit: number): Matrix {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng.int(-limit, limit)));
}

function multiply(left: Matrix, right: Matrix): Matrix {
  return left.map((row) => right[0].map((_, col) => row.reduce((sum, value, index) => sum + value * right[index][col], 0)));
}

function question(
  skillId: SkillId, seed: number, difficulty: Difficulty, formId: string,
  values: (number | string)[], details: Omit<Question, "id" | "seed" | "generatorVersion" | "skillId" | "difficulty" | "formId" | "problemKey">
): Question {
  return {
    id: `${skillId}:${difficulty}:${seed}`, seed, generatorVersion: 1, skillId, difficulty, formId,
    problemKey: `${skillId}:${formId}:${values.join(",")}`,
    ...details
  };
}

export const linearAlgebraFormIds = {
  vectors: ["linear_combination", "dot_product"],
  matrices: ["addition", "multiplication"],
  linear_systems: ["solve_3x3", "rref_2x3"],
  determinants_inverses: ["determinant", "inverse_2x2"],
  eigen: ["eigenvalues", "eigenvector"]
} as const;

const vectors: QuestionGenerator = {
  skillId: "vectors", validate,
  generate(seed, difficulty) {
    const rng = new SeededRandom(seed);
    const limit = limits[difficulty];
    const first = matrix(rng, 2, 1, limit).map((row) => row[0]);
    const second = matrix(rng, seed % 2 === 0 ? 2 : 3, 1, limit).map((row) => row[0]);
    if (seed % 2 === 0) {
      const scale = rng.nonZero(-limit, limit);
      const result = first.map((value, index) => value + scale * second[index]);
      return question("vectors", seed, difficulty, "linear_combination", [...first, ...second, scale], {
        promptLatex: `\\mathbf{u}=${latexMatrix(first.map((value) => [value]))},\\quad \\mathbf{v}=${latexMatrix(second.map((value) => [value]))},\\quad \\mathbf{u}${signedTerm(scale, "\\mathbf{v}")}`,
        instruction: "Find the vector. Enter its components as (x, y).",
        answer: { latex: `(${result.join(",")})`, kind: "ordered_pair" },
        hints: ["Multiply each component of v by the given scalar.", "Add corresponding components."],
        workedSolution: [
          `(${first[0]},${first[1]})+(${scale})(${second[0]},${second[1]})`,
          `=(${first[0]}${signedTerm(scale * second[0])},${first[1]}${signedTerm(scale * second[1])})`,
          `\\boxed{(${result.join(",")})}`
        ]
      });
    }
    const third = rng.int(-limit, limit);
    const left = [...first, third];
    const result = left.reduce((sum, value, index) => sum + value * second[index], 0);
    return question("vectors", seed, difficulty, "dot_product", [left.join(","), second.join(",")].sort(), {
      promptLatex: `\\mathbf{u}=${latexMatrix(left.map((value) => [value]))},\\quad \\mathbf{v}=${latexMatrix(second.map((value) => [value]))},\\quad \\mathbf{u}\\cdot\\mathbf{v}`,
      instruction: "Find the dot product.",
      answer: { latex: `${result}`, kind: "number" },
      hints: ["Multiply corresponding components.", "Add the three products."],
      workedSolution: [
        `\\mathbf{u}\\cdot\\mathbf{v}=(${left[0]})(${second[0]})+(${left[1]})(${second[1]})+(${left[2]})(${second[2]})`,
        `\\boxed{${result}}`
      ]
    });
  }
};

const matrices: QuestionGenerator = {
  skillId: "matrices", validate,
  generate(seed, difficulty) {
    const rng = new SeededRandom(seed);
    const limit = limits[difficulty];
    const a = matrix(rng, 2, 2, limit);
    const b = matrix(rng, 2, 2, limit);
    if (seed % 2 === 0) {
      const result = a.map((row, i) => row.map((value, j) => value + b[i][j]));
      return question("matrices", seed, difficulty, "addition", [a.flat().join(","), b.flat().join(",")].sort(), {
        promptLatex: `${latexMatrix(a)}+${latexMatrix(b)}`,
        instruction: "Add the matrices. Enter a two-by-two matrix.",
        answer: { latex: latexMatrix(result), kind: "matrix", matrixShape: { rows: 2, cols: 2 } },
        hints: ["The matrices have the same dimensions.", "Add entries in corresponding positions."],
        workedSolution: [
          latexMatrix(a.map((row, i) => row.map((value, j) => `(${value})+(${b[i][j]})`))),
          `\\boxed{${latexMatrix(result)}}`
        ]
      });
    }
    const result = multiply(a, b);
    return question("matrices", seed, difficulty, "multiplication", [...a.flat(), ...b.flat()], {
      promptLatex: `${latexMatrix(a)}${latexMatrix(b)}`,
      instruction: "Multiply the matrices in the shown order. Enter a two-by-two matrix.",
      answer: { latex: latexMatrix(result), kind: "matrix", matrixShape: { rows: 2, cols: 2 } },
      hints: ["Each output entry is a row–column dot product.", "Keep the order of the two matrices."],
      workedSolution: [
        `c_{11}=(${a[0][0]})(${b[0][0]})+(${a[0][1]})(${b[1][0]})=${result[0][0]}`,
        `c_{12}=(${a[0][0]})(${b[0][1]})+(${a[0][1]})(${b[1][1]})=${result[0][1]}`,
        `c_{21}=(${a[1][0]})(${b[0][0]})+(${a[1][1]})(${b[1][0]})=${result[1][0]}`,
        `c_{22}=(${a[1][0]})(${b[0][1]})+(${a[1][1]})(${b[1][1]})=${result[1][1]}`,
        `\\boxed{${latexMatrix(result)}}`
      ]
    });
  }
};

function equationRow(row: number[], right: number): string {
  return `${row.map((value, index) => signedTerm(value, ["x", "y", "z"][index])).join("").replace(/^\+/, "")}=${right}`;
}

const linearSystems: QuestionGenerator = {
  skillId: "linear_systems", validate,
  generate(seed, difficulty) {
    const rng = new SeededRandom(seed);
    const limit = limits[difficulty];
    if (seed % 2 === 0) {
      const a = rng.nonZero(-limit, limit), d = rng.nonZero(-limit, limit), f = rng.nonZero(-limit, limit);
      const b = rng.int(-limit, limit), c = rng.int(-limit, limit), e = rng.int(-limit, limit);
      const coefficients = [[a, b, c], [0, d, e], [0, 0, f]];
      const solution = Array.from({ length: 3 }, () => rng.int(-limit, limit));
      const right = multiply(coefficients, solution.map((value) => [value])).map((row) => row[0]);
      return question("linear_systems", seed, difficulty, "solve_3x3", [...coefficients.flat(), ...solution], {
        promptLatex: `\\begin{cases}${coefficients.map((row, index) => equationRow(row, right[index])).join("\\\\")}\\end{cases}`,
        instruction: "Solve the system. Enter (x, y, z).",
        answer: { latex: `(${solution.join(",")})`, kind: "ordered_triple" },
        hints: ["Start with the equation containing only z.", "Substitute upward to find y, then x."],
        workedSolution: [
          `${f}z=${right[2]}\\Rightarrow z=${solution[2]}`,
          `${d}y${signedTerm(e, "z")}=${right[1]}\\Rightarrow y=${solution[1]}`,
          `${a}x${signedTerm(b, "y")}${signedTerm(c, "z")}=${right[0]}\\Rightarrow x=${solution[0]}`,
          `\\boxed{(${solution.join(",")})}`
        ]
      });
    }
    let a = 0, b = 0, c = 0, d = 0, determinant = 0;
    do {
      a = rng.nonZero(-limit, limit); b = rng.int(-limit, limit);
      c = rng.int(-limit, limit); d = rng.int(-limit, limit);
      determinant = a * d - b * c;
    } while (determinant === 0);
    const x = rng.int(-limit, limit), y = rng.int(-limit, limit);
    const augmented = [[a, b, a * x + b * y], [c, d, c * x + d * y]];
    const result = [[1, 0, x], [0, 1, y]];
    return question("linear_systems", seed, difficulty, "rref_2x3", [...augmented.flat()], {
      promptLatex: latexMatrix(augmented),
      instruction: "Find the reduced row echelon form. Enter the full two-by-three matrix.",
      answer: { latex: latexMatrix(result), kind: "matrix", matrixShape: { rows: 2, cols: 3 } },
      hints: ["Use row operations to make a leading 1 in each row.", "Clear the other entry in each pivot column."],
      workedSolution: [
        `R_2\\leftarrow (${a})R_2-(${c})R_1\\quad\\Rightarrow\\quad ${latexMatrix([[a, b, augmented[0][2]], [0, determinant, determinant * y]])}`,
        `R_2\\leftarrow\\frac{1}{${determinant}}R_2,\\quad R_1\\leftarrow\\frac{1}{${a}}(R_1-(${b})R_2)`,
        `\\boxed{${latexMatrix(result)}}`
      ]
    });
  }
};

function determinant3(m: Matrix): number {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

const determinantsInverses: QuestionGenerator = {
  skillId: "determinants_inverses", validate,
  generate(seed, difficulty) {
    const rng = new SeededRandom(seed);
    const limit = limits[difficulty];
    if (seed % 2 === 0) {
      const size = difficulty === "easy" ? 2 : 3;
      const a = matrix(rng, size, size, limit);
      const result = size === 2 ? a[0][0] * a[1][1] - a[0][1] * a[1][0] : determinant3(a);
      const expansion = size === 2
        ? `(${a[0][0]})(${a[1][1]})-(${a[0][1]})(${a[1][0]})`
        : `(${a[0][0]})(${a[1][1] * a[2][2] - a[1][2] * a[2][1]})-(${a[0][1]})(${a[1][0] * a[2][2] - a[1][2] * a[2][0]})+(${a[0][2]})(${a[1][0] * a[2][1] - a[1][1] * a[2][0]})`;
      return question("determinants_inverses", seed, difficulty, "determinant", [...a.flat()], {
        promptLatex: `\\det${latexMatrix(a)}`,
        instruction: "Find the determinant.",
        answer: { latex: `${result}`, kind: "number" },
        hints: ["For a two-by-two matrix, use ad − bc; for a three-by-three matrix, expand along a row.", "Keep the alternating signs in the expansion."],
        workedSolution: [`\\det A=${expansion}`, `\\boxed{${result}}`]
      });
    }
    let a: Matrix, determinant: number;
    do {
      a = matrix(rng, 2, 2, limit);
      determinant = a[0][0] * a[1][1] - a[0][1] * a[1][0];
    } while (determinant === 0 || Math.abs(determinant) > 8);
    const adjugate = [[a[1][1], -a[0][1]], [-a[1][0], a[0][0]]];
    const result = adjugate.map((row) => row.map((value) => fraction(value, determinant)));
    return question("determinants_inverses", seed, difficulty, "inverse_2x2", [...a.flat()], {
      promptLatex: `A=${latexMatrix(a)},\\quad A^{-1}`,
      instruction: "Find the inverse. Enter a two-by-two matrix.",
      answer: { latex: latexMatrix(result), kind: "matrix", matrixShape: { rows: 2, cols: 2 } },
      hints: ["First check that ad − bc is nonzero.", "Swap the diagonal entries, negate the off-diagonal entries, then divide by the determinant."],
      workedSolution: [
        `\\det A=(${a[0][0]})(${a[1][1]})-(${a[0][1]})(${a[1][0]})=${determinant}`,
        `A^{-1}=\\frac{1}{${determinant}}${latexMatrix(adjugate)}`,
        `\\boxed{${latexMatrix(result)}}`
      ]
    });
  }
};

const eigen: QuestionGenerator = {
  skillId: "eigen", validate,
  generate(seed, difficulty) {
    const rng = new SeededRandom(seed);
    const limit = limits[difficulty];
    const first = rng.int(-limit, limit);
    let second = rng.int(-limit, limit);
    while (second === first) second = rng.int(-limit, limit);
    const s = rng.pick([-1, 1] as const), t = rng.pick([-1, 1] as const);
    const a = [
      [first * (1 + s * t) - second * s * t, t * (second - first)],
      [s * (1 + s * t) * (first - second), second * (1 + s * t) - first * s * t]
    ];
    if (seed % 2 === 0) {
      const sorted = [first, second].sort((x, y) => x - y);
      return question("eigen", seed, difficulty, "eigenvalues", [...a.flat()], {
        promptLatex: `A=${latexMatrix(a)}`,
        instruction: "Find both eigenvalues. Enter them in ascending order as (smaller, larger).",
        answer: { latex: `(${sorted.join(",")})`, kind: "ordered_pair" },
        hints: ["Set det(A − λI) equal to zero.", "Factor the characteristic polynomial."],
        workedSolution: [
          `\\det(A-\\lambda I)=(\\lambda${signedTerm(-first)})(\\lambda${signedTerm(-second)})=0`,
          `\\lambda=${first}\\quad\\text{or}\\quad\\lambda=${second}`,
          `\\boxed{(${sorted.join(",")})}`
        ]
      });
    }
    const useFirst = rng.pick([true, false] as const);
    const lambda = useFirst ? first : second;
    const direction = useFirst ? [1, s] : [t, 1 + s * t];
    const row = [a[0][0] - lambda, a[0][1]];
    const nonzeroRow = row[0] === 0 && row[1] === 0 ? [a[1][0], a[1][1] - lambda] : row;
    return question("eigen", seed, difficulty, "eigenvector", [...a.flat(), lambda], {
      promptLatex: `A=${latexMatrix(a)},\\quad \\lambda=${lambda}`,
      instruction: "Find any nonzero eigenvector for the given eigenvalue. Enter (x, y).",
      answer: { latex: `(${direction.join(",")})`, kind: "vector_direction" },
      hints: ["Solve (A − λI)v = 0.", "One coordinate can be chosen freely; the zero vector is not an eigenvector."],
      workedSolution: [
        `(A-${lambda}I)\\mathbf{v}=\\mathbf{0}`,
        `${nonzeroRow[0]}x${signedTerm(nonzeroRow[1], "y")}=0`,
        `\\boxed{(${direction.join(",")})}`
      ]
    });
  }
};

export const linearAlgebraGenerators = { vectors, matrices, linear_systems: linearSystems, determinants_inverses: determinantsInverses, eigen };
