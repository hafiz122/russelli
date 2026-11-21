import { describe, expect, it } from "vitest";
import { curvesSeriesTopics } from "../src/math/calculusCurvesSeries";
import { SeededRandom } from "../src/math/rng";
import type { CalculusProblem } from "../src/math/calculusTopic";

function captures(source: string, pattern: RegExp): number[] {
  const match = source.match(pattern);
  if (!match) throw new Error(`Unexpected exercise notation in ${source}`);
  return match.slice(1).map(Number);
}

function scalar(latex: string): number {
  const coefficient = latex.replace(/\\pi|\\sqrt\{[23]\}/g, "");
  const rational = coefficient.match(/^\\frac\{(-?\d+)\}\{(\d+)\}$/);
  const value = rational ? Number(rational[1]) / Number(rational[2]) : coefficient === "" ? 1 : Number(coefficient);
  if (!Number.isFinite(value)) throw new Error(`Unexpected scalar ${latex}`);
  return value * (latex.includes("\\pi") ? Math.PI : 1) * (latex.includes("\\sqrt{2}") ? Math.SQRT2 : latex.includes("\\sqrt{3}") ? Math.sqrt(3) : 1);
}

// Simpson quadrature independently checks the polar integrals from sampled radius and speed.
function integrate(f: (x: number) => number, end: number): number {
  const n = 64, h = end/n;
  let sum = f(0) + f(end);
  for (let i = 1; i < n; i++) sum += (i % 2 === 0 ? 2 : 4) * f(i*h);
  return sum*h/3;
}

function check(form: string, question: CalculusProblem): void {
  const prompt = question.promptLatex, answer = question.answer.latex;
  switch (form) {
    case "trace":
    case "eliminate": {
      const [b,a,p] = captures(prompt, /x=t\+(\d+),\\quad y=(\d+)t\^\{(\d+)\}/);
      if (form === "trace") {
        const [t] = captures(prompt, /,\\quad t=(-?\d+)$/);
        expect(answer).toBe(`(${t+b},${a*t**p})`);
      } else {
        const [coefficient, shift, exponent] = captures(answer, /^y=(\d+)\(x-(\d+)\)\^\{(\d+)\}$/);
        for (const t of [-2, 1, 3]) expect(coefficient*(t+b-shift)**exponent).toBe(a*t**p);
      }
      return;
    }
    case "parametric_slope":
    case "parametric_curvature_derivative": {
      const [a,b,t] = captures(prompt, /y=(\d+)t\^3\+(\d+)t,.*\\right\|_\{t=(-?\d+)\}/);
      const h = 0.0001, x = (u: number) => u*u, y = (u: number) => a*u**3+b*u;
      const slope = (u: number) => (y(u+h)-y(u-h))/(x(u+h)-x(u-h));
      expect(t).not.toBe(0);
      const reference = form === "parametric_slope" ? slope(t) : (slope(t+h)-slope(t-h))/(x(t+h)-x(t-h));
      expect(scalar(answer)).toBeCloseTo(reference, 5);
      return;
    }
    case "polar_to_cartesian":
    case "polar_from_cartesian": {
      const [first,second] = prompt.split("=(")[1].slice(0,-1).split(",");
      const [a,b] = answer.slice(1,-1).split(",").map(scalar);
      if (form === "polar_to_cartesian") {
        const radians = second.replace(/\\frac\{(\d*)\\pi\}\{(\d+)\}/, (_match, n, d) => String(Number(n || 1)*Math.PI/Number(d)));
        expect(a).toBeCloseTo(scalar(first)*Math.cos(scalar(radians)),10);
        expect(b).toBeCloseTo(scalar(first)*Math.sin(scalar(radians)),10);
      } else {
        expect(a).toBeGreaterThan(0);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(2*Math.PI);
        expect(a*Math.cos(b)).toBeCloseTo(Number(first),10);
        expect(a*Math.sin(b)).toBeCloseTo(Number(second),10);
      }
      return;
    }
    case "polar_petal_area":
    case "polar_arc_length": {
      const [a] = captures(prompt,/r=(\d+)/);
      const endText = prompt.split("\\theta\\leq")[1];
      if (form === "polar_petal_area") {
        const [k] = captures(prompt,/sin\((\d+)\\theta\)/);
        const end = endText ? scalar(endText) : Math.PI/k;
        expect(k*end).toBeCloseTo(Math.PI,12);
        // Opposite signed radii can give duplicate petals. Count distinct tip directions geometrically.
        const directions = new Set(Array.from({length: 2*k}, (_,i) => {
          const t = (i+0.5)*Math.PI/k, r = a*Math.sin(k*t);
          return [r*Math.cos(t),r*Math.sin(t)].map(v=>Math.round(v*1e6)).join(",");
        }));
        const count = question.instruction.includes("all distinct") ? directions.size : 1;
        expect(scalar(answer)).toBeCloseTo(count*integrate(t=>0.5*(a*Math.sin(k*t))**2,end),9);
      } else {
        const offset = prompt.includes("1+\\cos") ? a : 0;
        const end = scalar(endText);
        const speed = (t: number) => Math.hypot(offset+a*Math.cos(t),a*Math.sin(t));
        const length = integrate(speed,end/2)+integrate(t=>speed(t+end/2),end/2);
        expect(scalar(answer)).toBeCloseTo(length,6);
      }
      return;
    }
    case "polar_conic_type":
    case "focus_directrix": {
      const [n,a,b] = captures(prompt,/^r=\\frac\{(\d+)\}\{(\d+)\+(\d+)\\(?:sin|cos)\\theta\}$/);
      if (form === "polar_conic_type") {
        // Squaring ar = n - b x (or n - b y) gives this Cartesian discriminant.
        const discriminant = -4*a*a*(a*a-b*b);
        expect(answer).toBe(discriminant < 0 ? "ellipse" : discriminant > 0 ? "hyperbola" : "parabola");
      } else {
        const trig = prompt.includes("cos") ? Math.cos : Math.sin;
        const angle = 0.5, r = n/(a+b*trig(angle));
        expect(r / Math.abs(scalar(answer)-r*trig(angle))).toBeCloseTo(b/a,11);
      }
      return;
    }
    case "sequence_limit": {
      if (prompt.includes("sqrt")) {
        const [a,c] = captures(prompt,/n\^2\+(\d+)n\+(\d+)/);
        const n = 1e6;
        expect(scalar(answer)).toBeCloseTo(Math.sqrt(n*n+a*n+c)-n,4);
        return;
      }
      const [a,p,c,b,q] = captures(prompt,/frac\{(\d+)n\^\{(\d+)\}\+(\d+)\}\{(\d+)n\^\{(\d+)\}\+1\}/);
      const n = 1e11;
      expect(scalar(answer)).toBeCloseTo((a*n**p+c)/(b*n**q+1),8);
      return;
    }
    case "recursive_sequence": {
      const [first,b,c] = captures(prompt,/a_1=(\d+).*\\frac\{a_n\}\{(\d+)\}\+(\d+),/);
      let term = first;
      for (let n = 1; n < 100; n++) term = term/b+c;
      expect(scalar(answer)).toBeCloseTo(term,12);
      return;
    }
    case "geometric_sum": {
      const [a] = captures(prompt, /infty\}(\d+)\\left/);
      const r = scalar(prompt.split("\\left(")[1].split("\\right)")[0]);
      expect(Math.abs(r)).toBeLessThan(1);
      let term = a, sum = 0;
      for (let i = 0; i < 300; i++) { sum += term; term *= r; }
      expect(scalar(answer)).toBeCloseTo(sum,10);
      return;
    }
    case "telescoping_sum": {
      const [start,a,d] = captures(prompt,/sum_\{n=(\d+)\}.*frac\{(\d+)\}\{n\(n\+(\d+)\)\}/);
      let partial = 0;
      for (let n = start; n <= 25; n++) partial += a/(n*(n+d));
      const uncancelled = Array.from({length: d}, (_,i)=>a/(d*(26+i))).reduce((u,v)=>u+v,0);
      expect(scalar(answer)-partial).toBeCloseTo(uncancelled,11);
      return;
    }
    case "integral_convergence": {
      const [n,a,p] = captures(prompt,/n=(\d+).*frac\{(\d+)\}\{n\(\\ln n\)\^\{(\d+)\}/);
      expect(n).toBeGreaterThan(1);
      expect(a).toBeGreaterThan(0);
      expect(answer).toBe(p > 1 ? "converges" : "diverges");
      return;
    }
    case "integral_remainder": {
      const [a,p] = captures(prompt,/frac\{(\d+)\}\{j\^\{(\d+)\}\}/);
      // Substituting u = N/x turns the improper integral into a polynomial on [0,1].
      const bound = (n: number) => integrate(u => a*n**(1-p)*u**(p-2),1);
      if (prompt.includes("\\varepsilon")) {
        const eps = scalar(prompt.split("\\varepsilon=")[1]), n = scalar(answer);
        expect(n).toBeGreaterThan(0);
        expect(bound(n)).toBeCloseTo(eps,11);
        expect(bound(n-1)).toBeGreaterThan(eps);
      } else {
        const [n] = captures(prompt,/N=(\d+)$/);
        const bounds = question.answer.kind === "ordered_pair" ? answer.slice(1,-1).split(",").map(scalar) : [0,scalar(answer)];
        expect(bounds[1]).toBeCloseTo(bound(n),11);
        if (bounds[0]) expect(bounds[0]).toBeCloseTo(bound(n+1),11);
        let tail = 0;
        for (let j=n+1; j<n+151; j++) tail += a/j**p;
        expect(tail).toBeLessThan(bounds[1]);
        expect(tail+bound(n+150)).toBeGreaterThan(bounds[0]);
      }
      return;
    }
    case "direct_comparison": {
      const [a,p,b] = captures(prompt,/frac\{(\d+)\}\{n\^\{(\d+)\}\+(\d+)\}/);
      for (const n of [1,10,100]) {
        const term = a/(n**p+b);
        expect(term).toBeLessThanOrEqual(a/n**p);
        expect(term).toBeGreaterThanOrEqual(a/((b+1)*n**p));
      }
      expect(answer).toBe(p === 1 ? "diverges" : "converges");
      return;
    }
    case "limit_comparison": {
      const [a,b,p,q] = captures(prompt,/frac\{(\d+)n\+1\}\{(\d+)n\^\{(\d+)\}\+1\}.*frac\{1\}\{n\^\{(\d+)\}/);
      const n = 1e10;
      expect(scalar(answer)).toBeCloseTo(((a*n+1)/(b*n**p+1))*n**q,7);
      return;
    }
    case "ratio_test":
    case "root_test": {
      let limit: number;
      if (form === "ratio_test") {
        const [p,a,b] = captures(prompt,/n\^\{(\d+)\}\\left\(\\frac\{(\d+)\}\{(\d+)\}/);
        const n = 1e9;
        limit = ((n+1)**p/n**p)*(a/b);
      } else {
        const [a,p,b] = captures(prompt,/frac\{(\d+)n\+(\d+)\}\{(\d+)n\+1\}/);
        limit = (a*1e9+p)/(b*1e9+1);
      }
      expect(answer).toBe(Math.abs(limit-1)<1e-6 ? "inconclusive" : limit<1 ? "absolute" : "diverges");
      if (answer === "inconclusive") {
        expect(question.workedConclusion).toContain("1/n diverges");
        expect(question.workedConclusion).toContain("1/n² converges");
      }
      return;
    }
    case "alternating_classification": {
      const [a,p] = captures(prompt,/frac\{(\d+)\}\{n\^\{(\d+)\}/);
      expect(a).toBeGreaterThan(0);
      expect(answer).toBe(p===0 ? "divergent" : p===1 ? "conditional" : "absolute");
      return;
    }
    case "choose_series_argument": {
      const [a,p] = captures(prompt,/frac\{(\d+)n\}\{n\^\{(\d+)\}\+1\}/);
      expect(a).toBeGreaterThan(0);
      expect(answer).toBe(p===1 ? "term" : p-1>1 ? "compare" : "harmonic");
      return;
    }
    case "radius":
    case "interval_of_convergence": {
      const [a,p] = captures(prompt,/\^n\}\{(\d+)\^n n\^\{(\d+)\}/);
      const reflected = /\(\d+-x\)/.test(prompt);
      const [c] = captures(prompt, reflected ? /\((\d+)-x\)/ : /\(x-(\d+)\)/);
      if (form === "radius") {
        const radius = scalar(answer);
        expect(Math.abs((c+radius-c)/a)).toBe(1);
      } else {
        const [lo,hi] = captures(answer,/^[[(](-?\d+),(-?\d+)[)\]]$/);
        const endpointSign = (x: number) => (reflected ? c-x : x-c)/a;
        expect(Math.abs(endpointSign(lo))).toBe(1);
        expect(Math.abs(endpointSign(hi))).toBe(1);
        expect(answer.startsWith("[")).toBe(p>1 || p===1 && endpointSign(lo)===-1);
        expect(answer.endsWith("]")).toBe(p>1 || p===1 && endpointSign(hi)===-1);
      }
      return;
    }
    case "maclaurin_coefficient": {
      const [a,k] = captures(prompt,/e\^\{(\d+)x\}.*k=(\d+)/);
      let coefficient = 1;
      for (let n=1; n<=k; n++) coefficient *= a/n;
      expect(scalar(answer)).toBeCloseTo(coefficient,12);
      return;
    }
    case "taylor_polynomial": {
      const [a,c] = captures(prompt,/f\(x\)=(\d+)x\^3,\\quad x_0=(\d+)/);
      const [constant,linear,h,quadratic,j] = captures(answer,/^(\d+)\+(\d+)\(x-(\d+)\)\+(\d+)\(x-(\d+)\)\^2$/);
      for(const x of [c-2,c,c+1]) {
        const polynomial = constant+linear*(x-h)+quadratic*(x-j)**2;
        expect(a*x**3-polynomial).toBe(a*(x-c)**3);
      }
      return;
    }
    default: throw new Error(`Missing independent check for ${form}`);
  }
}

describe("parametric, polar and series exercise answers", () => {
  for (const [id,definition] of Object.entries(curvesSeriesTopics)) {
    for (const difficulty of ["easy","medium","hard"] as const) {
      it(`independently checks ${id} at ${difficulty} over 1,000 seeds`, () => {
        for (let seed=1; seed<=1000; seed++) {
          const form = (seed%2) as 0|1;
          check(definition.forms[form], definition.generate(form,new SeededRandom(seed),difficulty));
        }
      });
    }
  }
});
