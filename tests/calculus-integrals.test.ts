import { describe, expect, it } from "vitest";
import { generateQuestion } from "../src/math/generators";
import { validateAnswer } from "../src/math/validator";
import { integralTopics } from "../src/math/calculusIntegrals";
import { SeededRandom } from "../src/math/rng";
import type { CalculusProblem } from "../src/math/calculusTopic";

function parameters(text: string, pattern: RegExp): number[] {
  const match = pattern.exec(text);
  if (!match) throw new Error(`Cannot read ${pattern} from ${text}`);
  return match.slice(1).map(Number);
}

function numericalAnswer(latex: string): number {
  if (latex === "\\pi") return Math.PI;
  if (latex.endsWith("\\pi")) return numericalAnswer(latex.slice(0, -3)) * Math.PI;
  if (/^\d+$/.test(latex)) return Number(latex);
  let match = /^\\frac\{(\d+)\}\{(\d+)\}$/.exec(latex);
  if (match) return Number(match[1]) / Number(match[2]);
  match = /^(\d+)\\sqrt\{(\d+)\}$/.exec(latex);
  if (match) return Number(match[1]) * Math.sqrt(Number(match[2]));
  const [coefficient, radicand, denominator] = parameters(latex, /^\\frac\{\((\d+)\\sqrt\{(\d+)\}-1\)\\pi\}\{(\d+)\}$/);
  return Math.PI * (coefficient * Math.sqrt(radicand) - 1) / denominator;
}

// Five-point Gaussian quadrature integrates every polynomial used in these checks exactly.
const nodes = [0, -0.5384693101056831, 0.5384693101056831, -0.9061798459386640, 0.9061798459386640];
const weights = [0.5688888888888889, 0.4786286704993665, 0.4786286704993665, 0.2369268850561891, 0.2369268850561891];
function integrate(a: number, b: number, f: (x: number) => number): number {
  const mid = (a + b) / 2, half = (b - a) / 2;
  return half * nodes.reduce((sum, node, i) => sum + weights[i] * f(mid + half * node), 0);
}

function expectedValue(form: string, problem: CalculusProblem): number {
  const prompt = problem.promptLatex;
  switch (form) {
    case "rectangle_polynomial": {
      const [a, b, n, k] = parameters(prompt, /\[0,(\d+)\].*\[0,(\d+)\].*x\^\{(\d+)\}\+(\d+)y/);
      return integrate(0, a, x => integrate(0, b, y => x ** n + k * y));
    }
    case "taylor_integral": {
      const [a, b, scale] = parameters(prompt, /\[0,(\d+)\].*\[0,(\d+)\].*e\^\{xy\/(\d+)\}/);
      const [n] = parameters(problem.instruction, /degree-(\d+)/);
      if (a * b / scale >= 1) throw new Error("Expected the full Taylor argument to stay below one");
      return integrate(0, b, y => integrate(0, a, x => {
        const t = x * y / scale;
        return 1 + t + (n >= 2 ? t ** 2 / 2 : 0) + (n === 3 ? t ** 3 / 6 : 0);
      }));
    }
    case "inside_out": {
      const [a, b, k, n] = parameters(prompt, /int_0\^\{(\d+)\}\\int_0\^\{(\d+)x\}(\d+)y\^\{(\d+)\}/);
      return integrate(0, a * b, y => integrate(y / b, a, () => k * y ** n));
    }
    case "reverse_order": {
      const [a, top, k, b] = parameters(prompt, /int_0\^\{(\d+)\}\\int_x\^\{(\d+)\}\\frac\{(\d+)\}\{\((\d+)\+y\^2\)\^2\}/);
      if (a !== top) throw new Error("Expected equal outer and inner endpoints");
      // Integrate in the original order, using a primitive for (b + y²)^−2.
      const primitive = (y: number) => k / (2 * b) * (y / (b + y ** 2) + Math.atan(y / Math.sqrt(b)) / Math.sqrt(b));
      let value = 0;
      for (let i = 0; i < 20; i++) value += integrate(i * a / 20, (i + 1) * a / 20, x => primitive(a) - primitive(x));
      return value;
    }
    case "parabola_line": {
      const [a, k, n] = parameters(prompt, /y=x\^2.*y=(\d+)x.*iint_D (\d+)x\^\{(\d+)\}/);
      return integrate(0, a, x => integrate(x * x, a * x, () => k * x ** n));
    }
    case "absolute_boundary": {
      const [a, k, n] = parameters(prompt, /\|x\|\+y\\le (\d+).*iint_D (\d+)y\^\{(\d+)\}/);
      return 2 * integrate(0, a, x => integrate(0, a - x, y => k * y ** n));
    }
    case "annular_sector": {
      const [a, b, divisor, k, n] = parameters(prompt, /^(\d+)\\le r\\le (\d+).*\\theta\\le\\pi\/(\d+).*iint_D (\d+)\(x\^2\+y\^2\)\^\{(\d+)\}/);
      if (a >= b || divisor <= 0) throw new Error("Invalid annular sector");
      return integrate(0, Math.PI / divisor, () => integrate(a, b, r => k * r ** (2 * n + 1)));
    }
    case "offset_disk": {
      const [diameter, k] = parameters(prompt, /x\^2\+y\^2\\le (\d+)x.*iint_D (\d+)x/);
      const radius = diameter / 2;
      return k * radius * Math.PI * radius ** 2;
    }
    case "triangular_lamina": {
      const [a, b, c] = parameters(prompt, /\(([1-9]\d*),0\).*\(0,(\d+)\).*sigma\(x,y\)=(\d+)\+x/);
      // The mean of an affine density on a triangle equals the density at its centroid.
      return (c + a / 3) * a * b / 2;
    }
    case "mass_estimate": {
      const [a, b, c, n] = parameters(prompt, /\[0,(\d+)\].*\[0,(\d+)\].*sigma\(x,y\)=(\d+)\+x\^\{(\d+)\}/);
      return integrate(0, b, () => integrate(0, a, x => (c + a ** n) - (c + x ** n)));
    }
    case "plane_patch": {
      const [a, b, w, h] = parameters(prompt, /z=(\d+)x\+(\d+)y.*\[0,(\d+)\].*\[0,(\d+)\]/);
      // Cross product of the lifted edge vectors (w,0,aw) and (0,h,bh).
      return Math.hypot(a * w * h, b * w * h, w * h);
    }
    case "paraboloid_patch": {
      const [k, radiusSquared] = parameters(prompt, /z=(\d+)\(x\^2\+y\^2\).*y\^2\\le (\d+)/);
      // Change variables to t = sqrt(1 + 4k²r²); the area density becomes polynomial.
      return integrate(1, Math.hypot(1, 2 * k * Math.sqrt(radiusSquared)), t => Math.PI * t * t / (2 * k * k));
    }
    case "bounding_planes": {
      const [a, b, c, k] = parameters(prompt, /x=([1-9]\d*),.*y=([1-9]\d*),.*z=(\d+)\+(\d+)x\+y/);
      return integrate(0, b, y => integrate(0, a, x => c + k * x + y));
    }
    case "tetrahedral_density": {
      const [a, b, c, n] = parameters(prompt, /x\/(\d+)\+y\/(\d+)\+z\/(\d+)\\le 1.*rho\(x,y,z\)=z\^\{(\d+)\}/);
      return integrate(0, a, x => integrate(0, b * (1 - x / a), y => integrate(0, c * (1 - x / a - y / b), z => z ** n)));
    }
    case "cylinder_mass": {
      const [radiusSquared, height, k, n] = parameters(prompt, /y\^2\\le (\d+).*z\\le (\d+).*rho\(x,y,z\)=(\d+)\(x\^2\+y\^2\)z\^\{(\d+)\}/);
      return integrate(0, height, z => integrate(0, Math.sqrt(radiusSquared), r => 2 * Math.PI * r * k * r ** 2 * z ** n));
    }
    case "paraboloid_volume": {
      const [k, height] = parameters(prompt, /z=(\d+)\(x\^2\+y\^2\).*z=(\d+)/);
      return integrate(0, height, z => Math.PI * z / k);
    }
    case "spherical_shell": {
      const [inner, outer, k, n] = parameters(prompt, /^(\d+)\\le x\^2\+y\^2\+z\^2\\le (\d+).*iiint_E (\d+)\(x\^2\+y\^2\+z\^2\)\^\{(\d+)\}/);
      if (inner >= outer) throw new Error("Invalid shell radii");
      return integrate(Math.sqrt(inner), Math.sqrt(outer), r => k * r ** (2 * n) * 4 * Math.PI * r ** 2);
    }
    case "cone_in_ball": {
      const [radiusSquared, vertical, horizontal] = parameters(prompt, /z\^2\\le (\d+).*z\\ge \\frac\{(\d+)\}\{(\d+)\}/);
      // Horizontal slices are disks bounded first by the cone, then by the sphere.
      const r = Math.sqrt(radiusSquared), zCross = r * vertical / Math.hypot(vertical, horizontal);
      return integrate(0, zCross, z => Math.PI * (z * horizontal / vertical) ** 2) + integrate(zCross, r, z => Math.PI * (r ** 2 - z ** 2));
    }
    case "area_jacobian": {
      const [a, b] = parameters(prompt, /x=(\d+)u\+v.*y=u-(\d+)v/);
      const corners = [[0, 0], [a, 1], [a + 1, 1 - b], [1, -b]];
      return Math.abs(corners.reduce((twiceArea, [x, y], i) => {
        const [nextX, nextY] = corners[(i + 1) % 4];
        return twiceArea + x * nextY - y * nextX;
      }, 0)) / 2;
    }
    case "transformed_integral": {
      const [k, minusK, a, b, firstK, n, secondK] = parameters(prompt, /u=x\+(\d+)y.*v=x-(\d+)y.*u\\le (\d+).*v\\le (\d+).*iint_D \(x\+(\d+)y\)\^\{(\d+)\}\(x-(\d+)y\)/);
      if (!(k === minusK && k === firstK && k === secondK)) throw new Error("Substitution does not match integrand");
      // Integrate in x,y over vertical slices of the original parallelogram.
      const breaks = [...new Set([0, a / 2, b / 2, (a + b) / 2])].sort((x, y) => x - y);
      let result = 0;
      for (let i = 1; i < breaks.length; i++) result += integrate(breaks[i - 1], breaks[i], x =>
        integrate(Math.max(-x, x - b) / k, Math.min(a - x, x) / k, y => (x + k * y) ** n * (x - k * y)));
      return result;
    }
    default: throw new Error(`Unexpected integral form ${form}`);
  }
}

describe("multiple integral problems", () => {
  it("accepts equivalent mass bounds and requires both attainable endpoints", () => {
    const q = generateQuestion("calc_double_applications", 11, "hard");
    const bounds = /^\[([^,]+),([^,]+)\]$/.exec(q.answer.latex)!;
    const equivalent = `[2(${bounds[1]})/2,2(${bounds[2]})/2]`;
    expect(validateAnswer(q, equivalent).correct).toBe(true);
    expect(validateAnswer(q, `(${bounds[1]},${bounds[2]}]`).correct).toBe(false);
    expect(validateAnswer(q, `[${bounds[1]},${bounds[2]}+1]`).correct).toBe(false);
  });

  for (const difficulty of ["easy", "medium", "hard"] as const) {
    it(`independently evaluates the displayed problems across 1,000 ${difficulty} seeds per topic`, () => {
      for (const entry of Object.values(integralTopics)) {
        const seen = new Set<string>();
        for (let seed = 1; seed <= 1000; seed++) {
          const form = seed % 2 === 0 ? 0 : 1;
          const problem = entry.generate(form, new SeededRandom(seed), difficulty);
          if (problem.answer.kind === "interval") {
            expect(entry.forms[form]).toBe("mass_estimate");
            const [a, b, c, divisor] = parameters(problem.promptLatex, /\[0,(\d+)\].*\[0,(\d+)\].*sigma=(\d+)\+x\^2.*\\le 1\/(\d+)/);
            const bounds = /^\[([^,]+),([^,]+)\]$/.exec(problem.answer.latex);
            if (!bounds) throw new Error("The guaranteed interval must include both attainable extrema");
            for (const [index, sign] of [[1, -1], [2, 1]]) {
              const exactMass = integrate(0, b, () => integrate(0, a, x => c + x ** 2 + sign / divisor));
              expect(numericalAnswer(bounds[index])).toBeCloseTo(exactMass, 8);
            }
            seen.add(problem.promptLatex);
            continue;
          }
          const expected = expectedValue(entry.forms[form], problem);
          const actual = numericalAnswer(problem.answer.latex);
          if (!Number.isFinite(expected) || !Number.isFinite(actual) || Math.abs(actual - expected) > 1e-8 * Math.max(1, Math.abs(expected))) {
            throw new Error(`${entry.forms[form]} at seed ${seed}: ${problem.promptLatex}, expected ${expected}, received ${problem.answer.latex}`);
          }
          seen.add(problem.promptLatex);
          if (seed <= 2) {
            expect(problem).toEqual(entry.generate(form, new SeededRandom(seed), difficulty));
            expect(problem.hints.length).toBeGreaterThanOrEqual(2);
            expect(problem.workedSolution.length).toBeGreaterThanOrEqual(3);
            expect(problem.workedSolution.at(-1)).toContain(problem.answer.latex);
          }
        }
        expect(seen.size).toBeGreaterThan(15);
      }
    });
  }
});
