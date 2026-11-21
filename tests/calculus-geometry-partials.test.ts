import { describe, expect, it } from "vitest";
import { geometryPartialsTopics } from "../src/math/calculusGeometryPartials";
import type { CalculusProblem } from "../src/math/calculusTopic";
import { SeededRandom } from "../src/math/rng";

function tuples(text: string): number[][] {
  return [...text.matchAll(/\((-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)+)\)/g)]
    .map(match => match[1].split(",").map(Number));
}

function scalar(latex: string): number {
  const root = latex.match(/^\\sqrt\{(\d+)\}$/);
  if (root) return Math.sqrt(Number(root[1]));
  const rational = latex.match(/^\\frac\{(-?\d+)\}\{(\d+)\}$/);
  return rational ? Number(rational[1]) / Number(rational[2]) : Number(latex);
}

// Read the small polynomial grammar used in the displayed problems, including shifted squares.
function at(expression: string, variables: Record<string, number>): number {
  let index = 0;
  function sum(): number {
    let total = 0;
    while (index < expression.length && expression[index] !== ")") {
      let sign = 1;
      if (expression[index] === "+") index++;
      else if (expression[index] === "-") { sign = -1; index++; }
      let product = 1;
      let factors = 0;
      while (index < expression.length && !"+-)".includes(expression[index])) {
        let value: number;
        if (expression[index] === "(") {
          index++;
          value = sum();
          if (expression[index++] !== ")") throw new Error(`Missing ) in ${expression}`);
        } else if (/[0-9]/.test(expression[index])) {
          const match = expression.slice(index).match(/^\d+/)!;
          value = Number(match[0]);
          index += match[0].length;
        } else if (expression[index] in variables) {
          value = variables[expression[index++]];
        } else {
          throw new Error(`Unexpected factor at ${index} in ${expression}`);
        }
        if (expression.slice(index, index + 2) === "^2") { value *= value; index += 2; }
        product *= value;
        factors++;
      }
      if (!factors) throw new Error(`Missing term in ${expression}`);
      total += sign * product;
    }
    return total;
  }
  const result = sum();
  if (index !== expression.length) throw new Error(`Unconsumed terms in ${expression}`);
  return result;
}

function field(q: CalculusProblem): (x: number, y: number) => number {
  const rule = q.promptLatex.split(",\\quad ")[0].split("=")[1];
  return (x, y) => at(rule, { x, y });
}

// Centered differences are exact for these polynomials of degree at most two in each variable.
function slopes(f: (x: number, y: number) => number, x: number, y: number) {
  return [(f(x + 1, y) - f(x - 1, y)) / 2, (f(x, y + 1) - f(x, y - 1)) / 2];
}

type Check = (problem: CalculusProblem) => void;
const checks: Record<string, Check> = {
  distance_in_space(q) {
    const [a, b] = tuples(q.promptLatex);
    expect(scalar(q.answer.latex)).toBeCloseTo(Math.hypot(...a.map((n, i) => b[i] - n)), 10);
  },
  coordinate_projection(q) {
    const [p] = tuples(q.promptLatex);
    const plane = q.instruction.match(/the ([xyz]{2})-plane/)![1];
    expect(tuples(q.answer.latex)[0]).toEqual(p.map((n, i) => plane.includes("xyz"[i]) ? n : 0));
  },
  directed_displacement(q) {
    const [a, b] = tuples(q.promptLatex);
    const d = tuples(q.answer.latex)[0];
    expect(a.map((n, i) => n + d[i])).toEqual(b);
  },
  resultant_displacement(q) {
    const [u, v] = tuples(q.promptLatex);
    const repetitions = Number(q.instruction.match(/v (\d+) times/)![1]);
    expect(tuples(q.answer.latex)[0]).toEqual(u.map((value, i) => value + repetitions * v[i]));
  },
  angle_classification(q) {
    const [u, v] = tuples(q.promptLatex);
    const d = u.reduce((sum, n, i) => sum + n * v[i], 0);
    expect(Math.hypot(...u) * Math.hypot(...v)).toBeGreaterThan(0);
    expect(q.answer.latex).toBe(d > 0 ? "below_right" : d < 0 ? "above_right" : "right");
  },
  signed_work(q) {
    const [u, v] = tuples(q.promptLatex);
    expect(scalar(q.answer.latex)).toBe(u.reduce((sum, n, i) => sum + n * v[i], 0));
  },
  oriented_cross_product(q) {
    const [u, v] = tuples(q.promptLatex);
    const components = u.map((_, i) => u[(i + 1) % 3] * v[(i + 2) % 3] - v[(i + 1) % 3] * u[(i + 2) % 3]);
    expect(tuples(q.answer.latex)[0]).toEqual(components.map(n => n || 0));
  },
  right_hand_orientation(q) {
    const [u, v] = [...q.promptLatex.matchAll(/=(-?\d*)\\mathbf\{e\}_\{([xyz])\}/g)].map(match => ({
      sign: match[1].startsWith("-") ? -1 : 1, axis: "xyz".indexOf(match[2])
    }));
    const axes = ["x", "y", "z"];
    const productAxis = axes.find((_, i) => i !== u.axis && i !== v.axis);
    const sign = u.sign * v.sign * ([[0, 1], [1, 2], [2, 0]].some(([a, b]) => a === u.axis && b === v.axis) ? 1 : -1);
    expect(q.answer.latex).toBe(`${sign === 1 ? "positive" : "negative"}_${productAxis}`);
  },
  parametric_line(q) {
    const [p, d] = tuples(q.promptLatex);
    const components = q.answer.latex.slice(1, -1).split(",");
    for (const t of [0, 1, -2]) {
      expect(components.map(s => at(s, { t }))).toEqual(p.map((n, i) => n + t * d[i]));
    }
  },
  plane_through_point(q) {
    const [p, n] = tuples(q.promptLatex);
    const [left, right] = q.answer.latex.split("=");
    const residual = (v: number[]) => at(left, { x: v[0], y: v[1], z: v[2] }) - at(right, { x: v[0], y: v[1], z: v[2] });
    expect(residual(p)).toBe(0);
    expect(residual([p[0] - n[1], p[1] + n[0], p[2]])).toBe(0);
    expect(residual([p[0] - n[2], p[1], p[2] + n[0]])).toBe(0);
    expect(residual(p.map((v, i) => v + n[i]))).not.toBe(0);
  },
  domain_slice(q) {
    const y = Number(q.promptLatex.match(/y=(-?\d+)$/)![1]);
    const squaredRadius = Number(q.promptLatex.match(/\\sqrt\{(\d+)-x\^2-y\^2\}/)![1]);
    const bound = Math.sqrt(squaredRadius - y ** 2);
    expect(Number.isInteger(bound) && bound > 0).toBe(true);
    expect(q.answer.latex).toBe(q.promptLatex.includes("\\frac") ? `(-${bound},${bound})` : `[-${bound},${bound}]`);
  },
  field_evaluation(q) {
    const [[x, y]] = tuples(q.promptLatex);
    expect(scalar(q.answer.latex)).toBe(field(q)(x, y));
  },
  continuous_extension(q) {
    const terms = q.promptLatex.match(/^f\(x,y\)=(-?\d+)([+-])\\frac\{(\d*)x\^2y\}\{x\^2\+y\^2\}$/)!;
    const constant = Number(terms[1]);
    const k = (terms[2] === "-" ? -1 : 1) * Number(terms[3] || 1);
    expect(scalar(q.answer.latex)).toBe(constant);
    for (const [x, y] of [[0.01, 0.02], [-0.02, 0.01], [0.01, 0]]) {
      const value = constant + k * x * x * y / (x * x + y * y);
      expect(Math.abs(value - scalar(q.answer.latex))).toBeLessThanOrEqual(Math.abs(k * y) + 1e-12);
    }
  },
  two_path_limit(q) {
    const numerator = q.promptLatex.match(/\\frac\{([^}]+)\}\{x\^2\+y\^2\}/)![1];
    const axisX = at(numerator, { x: 1, y: 0 }), axisY = at(numerator, { x: 0, y: 1 });
    expect(q.answer.latex).toBe(axisX === axisY ? "exists" : "dne");
    if (axisX === axisY) expect(at(numerator, { x: 3, y: 4 }) / 25).toBe(axisX);
  },
  first_partial(q) {
    const f = field(q);
    const target = q.promptLatex.match(/\\frac\{\\partial f\}\{\\partial ([xy])\}=\?/)!;
    const index = target[1] === "x" ? 0 : 1;
    expect(q.instruction).toContain(`respect to ${target[1]}`);
    for (const [x, y] of [[1, 0], [0, 1], [2, -3], [-1, -1]]) {
      expect(at(q.answer.latex, { x, y })).toBe(slopes(f, x, y)[index]);
    }
  },
  mixed_partial(q) {
    const f = field(q);
    const [[x, y]] = tuples(q.promptLatex);
    const mixed = (f(x+1, y+1) - f(x+1, y-1) - f(x-1, y+1) + f(x-1, y-1)) / 4;
    expect(q.promptLatex).toContain("\\left.\\frac{\\partial^2 f}{\\partial y\\,\\partial x}\\right|_{P}=?");
    expect(q.workedSolution[0]).toContain("\\frac{\\partial f}{\\partial x}=");
    expect(q.workedSolution[1]).toContain("\\frac{\\partial}{\\partial y}\\!\\left(\\frac{\\partial f}{\\partial x}\\right)");
    expect(q.workedSolution[2]).toContain(`\\right|_{(${x},${y})}=${mixed}`);
    expect(scalar(q.answer.latex)).toBe(mixed);
  },
  tangent_plane(q) {
    const f = field(q);
    const [[x, y]] = tuples(q.promptLatex);
    const [left, right] = q.answer.latex.split("=");
    expect(left).toBe("z");
    expect(at(right, { x, y })).toBe(f(x, y));
    const g = (u: number, v: number) => at(right, { x: u, y: v });
    expect(slopes(g, x, y)).toEqual(slopes(f, x, y));
  },
  linear_approximation(q) {
    const f = field(q);
    const [[x, y], [u, v]] = tuples(q.promptLatex);
    const [fx, fy] = slopes(f, x, y);
    expect(scalar(q.answer.latex)).toBeCloseTo(f(x, y) + fx * (u-x) + fy * (v-y), 9);
  },
  curve_derivative(q) {
    const [z, x, y] = q.promptLatex.split(",\\quad ").map(s => s.split("=")[1]);
    const t = Number(q.promptLatex.match(/\\frac\{dz\}\{dt\}\\right\|_\{t=(-?\d+)\}=\?/)![1]);
    const composite = (time: number) => at(z, { x: at(x, { t: time }), y: at(y, { t: time }) });
    expect(scalar(q.answer.latex)).toBe((composite(t+1) - composite(t-1)) / 2);
  },
  temperature_rate(q) {
    const [[tx, ty], [vx, vy]] = tuples(q.promptLatex);
    expect(scalar(q.answer.latex)).toBe(tx * vx + ty * vy);
    expect(q.instruction).toContain("°C/s");
  },
  critical_point_classification(q) {
    const f = field(q);
    const changeX = f(1, 0) - f(0, 0), changeY = f(0, 1) - f(0, 0);
    expect(q.answer.latex).toBe(changeX * changeY < 0 ? "saddle" : changeX > 0 ? "minimum" : "maximum");
  },
  rectangle_extreme(q) {
    const f = field(q);
    const limits = [...q.promptLatex.matchAll(/\\le ([xy])\\le (\d+)/g)].map(m => Number(m[2]));
    const candidates: number[] = [];
    for (let x = 0; x <= limits[0]; x++) for (let y = 0; y <= limits[1]; y++) candidates.push(f(x, y));
    expect(scalar(q.answer.latex)).toBe(q.instruction.includes("maximum") ? Math.max(...candidates) : Math.min(...candidates));
  }
};

describe("calculus in space and several variables", () => {
  it.each([[4, "x"], [1, "y"]] as const)("shows the first derivative for seed %i with respect to %s", (seed, axis) => {
    const q = geometryPartialsTopics.calc_partial_derivatives.generate(0, new SeededRandom(seed), "easy");
    const derivative = `\\frac{\\partial f}{\\partial ${axis}}`;
    expect(q.promptLatex).toContain(`${derivative}=?`);
    expect(q.workedSolution.at(-1)).toBe(`${derivative}=${q.answer.latex}`);
  });

  for (const difficulty of ["easy", "medium", "hard"] as const) {
    it(`independently solves 1,000 seeded problems per topic at ${difficulty}`, () => {
      for (const t of Object.values(geometryPartialsTopics)) {
        for (let seed = 1; seed <= 1000; seed++) {
          const form = seed % 2 === 0 ? 0 : 1;
          const q = t.generate(form, new SeededRandom(seed), difficulty);
          try {
            checks[t.forms[form]](q);
            if (q.answer.choices) {
              expect(q.answer.choices.filter(entry => entry.value === q.answer.latex)).toHaveLength(1);
              expect(q.workedConclusion).toBeTruthy();
            }
            if (seed <= 10) expect(t.generate(form, new SeededRandom(seed), difficulty)).toEqual(q);
          } catch (cause) {
            throw new Error(`${t.forms[form]}, seed ${seed}, ${q.promptLatex}`, { cause });
          }
        }
      }
    }, 30_000);
  }
});
