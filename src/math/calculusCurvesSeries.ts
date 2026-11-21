import { fraction, signedTerm } from "./format";
import { topic, type CalculusProblem } from "./calculusTopic";
import type { AnswerSpec, Difficulty } from "../types";

const m = String.raw;
const level = { easy: 0, medium: 1, hard: 2 } satisfies Record<Difficulty, number>;

function exercise(promptLatex: string, instruction: string, answer: AnswerSpec, hint: string, steps: string[], workedConclusion?: string): CalculusProblem {
  return { promptLatex, instruction, answer, hints: [hint], workedSolution: steps, workedConclusion };
}

function exact(value: string | number): AnswerSpec {
  return { kind: "number", latex: String(value) };
}

function decision(correct: string, options: Record<string, string>): AnswerSpec {
  return { kind: "choice", latex: correct, choices: Object.entries(options).map(([value, label]) => ({ value, label })) };
}

function multiplePi(numerator: number, denominator: number): string {
  const coefficient = fraction(numerator, denominator);
  return coefficient === "1" ? m`\pi` : m`${coefficient}\pi`;
}

const convergence = { converges: "Converges", diverges: "Diverges" };
const conics = { ellipse: "Ellipse", parabola: "Parabola", hyperbola: "Hyperbola" };
const classification = { absolute: "Absolutely convergent", conditional: "Conditionally convergent", divergent: "Divergent" };
const angles = [
  { label: "0", x: 1, y: 0 }, { label: m`\frac{\pi}{2}`, x: 0, y: 1 },
  { label: m`\pi`, x: -1, y: 0 }, { label: m`\frac{3\pi}{2}`, x: 0, y: -1 }
];

export const curvesSeriesTopics = {
  calc_parametric_curves: topic(1, "Curves defined by parametric equations", ["trace", "eliminate"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(1, 4 + s), b = rng.int(1, 3 + s), t = rng.nonZero(-3 - s, 3 + s), p = s === 2 ? 3 : 2;
    const curve = m`x=t+${b},\quad y=${a}t^{${p}}`;
    if (form === 0) {
      const result = `(${t + b},${a * t ** p})`;
      return exercise(m`${curve},\quad t=${t}`, "Find the point on the curve. Enter (x, y).", { kind: "ordered_pair", latex: result },
        "Substitute the same parameter value into both coordinate functions.",
        [m`x=${t}+${b}=${t + b}`, m`y=${a}(${t})^{${p}}=${a * t ** p}`, m`(x,y)=${result}`]);
    }
    const answer = `y=${a}(x-${b})^{${p}}`;
    return exercise(curve, "A tracer follows this path. Eliminate its parameter and give the Cartesian equation of the trace.", { kind: "equation", latex: answer },
      "Solve the equation for x for the parameter, then substitute into the equation for y.", [m`t=x-${b}`, answer]);
  }),

  calc_parametric_calculus: topic(1, "Calculus with parametric curves", ["parametric_slope", "parametric_curvature_derivative"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(1, 4 + s), b = rng.int(1, 4 + s), t = rng.nonZero(-2 - s, 2 + s);
    const curve = m`x=t^2,\quad y=${a}t^3+${b}t`;
    const slope = m`\frac{dy}{dx}=\frac{${3*a}t^2+${b}}{2t}`;
    if (form === 0) {
      const target = m`\left.\frac{dy}{dx}\right|_{t=${t}}`;
      const value = fraction(3 * a * t * t + b, 2 * t);
      return exercise(m`${curve},\quad ${target}=?`, "Find the slope of the tangent at the given parameter value.", exact(value),
        "Divide the rate of change of y by the rate of change of x at the same t.",
        [m`\frac{dx}{dt}=2t,\quad\frac{dy}{dt}=${3*a}t^2+${b}`, slope, m`${target}=${value}`]);
    }
    const target = m`\left.\frac{d^2y}{dx^2}\right|_{t=${t}}`;
    const value = fraction(3 * a * t * t - b, 4 * t ** 3);
    return exercise(m`${curve},\quad ${target}=?`, "This curve is a modeled path. Find how fast its tangent slope changes per unit of horizontal displacement at the stated parameter value.", exact(value),
      "Differentiate the slope with respect to the parameter, then divide by the horizontal velocity.",
      [slope, m`\frac{d^2y}{dx^2}=\frac{1}{2t}\left(\frac{${3*a}}{2}-\frac{${b}}{2t^2}\right)`, m`${target}=${value}`]);
  }),

  calc_polar_coordinates: topic(1, "Polar coordinates", ["polar_to_cartesian", "polar_from_cartesian"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const s = level[difficulty], k = rng.int(2, 6 + s);
    if (form === 0) {
      if (s === 0) {
        const angle = rng.pick(angles), result = `(${k * angle.x},${k * angle.y})`;
        return exercise(m`(r,\theta)=(${k},${angle.label})`, "Convert to Cartesian coordinates. Enter (x, y).", { kind: "ordered_pair", latex: result },
          "Multiply the radius by the cosine and sine of the angle.",
          [m`x=r\cos\theta=(${k})(${angle.x})`, m`y=r\sin\theta=(${k})(${angle.y})`, m`(x,y)=${result}`]);
      }
      const quadrant = rng.int(0,3), xSign = [1,-1,-1,1][quadrant], ySign = [1,1,-1,-1][quadrant];
      const angle = s === 1 ? multiplePi([1,3,5,7][quadrant],4) : multiplePi([1,5,7,11][quadrant],6);
      const radius = s === 1 ? m`${k}\sqrt{2}` : String(-2*k);
      const x = s === 1 ? String(xSign*k) : m`${-xSign*k}\sqrt{3}`, y = s === 1 ? ySign*k : -ySign*k;
      const result = `(${x},${y})`;
      return exercise(m`(r,\theta)=(${radius},${angle})`, "Convert to Cartesian coordinates. Enter (x, y).", { kind: "ordered_pair", latex: result },
        "Use exact special-angle values. A negative radius places the point opposite the angle's ray.",
        [m`x=(${radius})\cos(${angle})=${x}`, m`y=(${radius})\sin(${angle})=${y}`, m`(x,y)=${result}`]);
    }
    const x = rng.pick([k, -k]), y = rng.pick([k, -k]);
    const angle = multiplePi(x > 0 ? y > 0 ? 1 : 7 : y > 0 ? 3 : 5, 4);
    const radius = m`${k}\sqrt{2}`, result = `(${radius},${angle})`;
    return exercise(`(x,y)=(${x},${y})`, "A survey point is given in Cartesian coordinates. Report its distance and angle (r, θ) with r positive and 0 ≤ θ < 2π.", { kind: "ordered_pair", latex: result },
      "Find the distance to the origin and use the signs of x and y to choose the quadrant.",
      [m`r=\sqrt{(${x})^2+(${y})^2}=${radius}`, m`\left|\frac{y}{x}\right|=1,\quad\theta=${angle}`, m`(r,\theta)=${result}`]);
  }),

  calc_polar_area_length: topic(1, "Areas and lengths in polar coordinates", ["polar_petal_area", "polar_arc_length"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(2, 7 + s), k = rng.int(2, 4 + s);
    if (form === 0) {
      const end = multiplePi(1, k), petalArea = multiplePi(a*a, 4*k);
      const petals = s === 2 ? (k % 2 === 0 ? 2*k : k) : 1;
      const value = multiplePi(a*a*petals, 4*k);
      const prompt = m`r=${a}\sin(${k}\theta)`;
      const integral = m`A_1=\frac{1}{2}\int_0^{${end}}${a*a}\sin^2(${k}\theta)\,d\theta=${petalArea}`;
      if (s === 2) {
        return exercise(prompt, "Find the total area of all distinct petals of the rose.", exact(value),
          "Integrate over two consecutive zeros for one petal. An odd frequency gives k distinct petals and an even frequency gives 2k.",
          [m`0\leq\theta\leq${end}`, integral, m`A=${petals}A_1=${value}`]);
      }
      const interval = s === 0 ? m`,\quad 0\leq\theta\leq${end}` : "";
      return exercise(prompt+interval, s === 0 ? "Find the exact area of the petal traced on this interval." : "Find the exact area of one petal, choosing the integration bounds yourself.", exact(value),
        "Two successive zeros bound one petal. Integrate half the squared radius and use the double-angle identity.",
        [m`\sin(${k}\theta)=0\quad\Longrightarrow\quad\theta=\frac{j\pi}{${k}}`,
          m`\sin^2(${k}\theta)=\frac{1-\cos(${2*k}\theta)}{2}`, integral]);
    }
    const speedSquared = m`r^2+\left(\frac{dr}{d\theta}\right)^2`;
    const radialDerivative = m`\frac{dr}{d\theta}=-${a}\sin\theta`;
    if (s >= 1) {
      const end = s === 2 ? m`2\pi` : m`\pi`, value = (s === 2 ? 8 : 4)*a;
      return exercise(m`r=${a}(1+\cos\theta),\quad 0\leq\theta\leq${end}`, "A cutter traces this curve once over the stated interval. Find the exact distance its tip travels.", exact(value),
        "Use the polar arc-length formula. The square root introduces an absolute value, so check the sign of the half-angle cosine.",
        [radialDerivative, m`${speedSquared}=${4*a*a}\cos^2(\theta/2)`,
          m`L=${2*a}\int_0^{${end}}|\cos(\theta/2)|\,d\theta=${value}`],
        s === 2 ? "Split the integral at π, where the half-angle cosine changes sign. The two halves have equal length." : "The half-angle cosine is nonnegative over the stated interval.");
    }
    const end = multiplePi(1,k), value = multiplePi(a,k);
    return exercise(m`r=${a}\cos\theta,\quad 0\leq\theta\leq${end}`, "A cutter traces this curve over the stated interval. Find the exact distance its tip travels.", exact(value),
      "Use the square root of the sum of the squared radius and squared radial derivative.",
      [radialDerivative, m`${speedSquared}=${a*a}`, m`L=\int_0^{${end}}${a}\,d\theta=${value}`]);
  }),

  calc_polar_conics: topic(1, "Conic sections in polar coordinates", ["polar_conic_type", "focus_directrix"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(2, 5+s), b = rng.int(1, 2*a), d = rng.int(2,6+s), n = b*d;
    const trig = rng.pick([m`\cos`, m`\sin`]), coord = trig === m`\cos` ? "x" : "y";
    const prompt = m`r=\frac{${n}}{${a}+${b}${trig}\theta}`, e = fraction(b,a);
    if (form === 0) {
      const which = b < a ? "ellipse" : b === a ? "parabola" : "hyperbola";
      return exercise(prompt, "Classify the conic from its eccentricity.", decision(which, conics),
        "Divide the numerator and denominator by the constant in the denominator to read off e.",
        [m`r=\frac{${fraction(n,a)}}{1+(${e})${trig}\theta}`, m`e=${e}${b < a ? "<1" : b > a ? ">1" : "=1"}`], `The eccentricity identifies a ${which}.`);
    }
    return exercise(prompt, "A drawing uses this conic with its focus at the pole. Find the perpendicular focus-to-directrix distance in drawing units.", exact(d),
      "In the normalized polar conic equation, the numerator is eccentricity times the focus-to-directrix distance.",
      [m`${a}r=${n}-${b}${coord}`, m`e=${e},\quad ed=${fraction(n,a)}`, m`d=\frac{${n}}{${b}}=${d}`]);
  }),

  calc_sequences: topic(2, "Sequences", ["sequence_limit", "recursive_sequence"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(1,6+s), b = rng.int(2,5+s), c = rng.int(1,7+s);
    const target = m`\lim_{n\to\infty}a_n`;
    if (form === 0) {
      if (s === 2) {
        const answer = fraction(a,2);
        return exercise(m`a_n=\sqrt{n^2+${a}n+${c}}-n,\quad ${target}=?`, "Find the limit of the sequence.", exact(answer),
          "Multiply by the conjugate before taking the limit.",
          [m`a_n=\frac{${a}n+${c}}{\sqrt{n^2+${a}n+${c}}+n}`,
            m`a_n=\frac{${a}+${c}/n}{\sqrt{1+${a}/n+${c}/n^2}+1}\longrightarrow ${answer}`]);
      }
      const p = s+1, answer = fraction(a,b);
      return exercise(m`a_n=\frac{${a}n^{${p}}+${c}}{${b}n^{${p}}+1},\quad ${target}=?`, "Find the limit of the sequence.", exact(answer),
        "Divide every term by the highest power of n in the denominator.",
        [m`a_n=\frac{${a}+${c}/n^{${p}}}{${b}+1/n^{${p}}}`, m`\lim_{n\to\infty}a_n=${answer}`]);
    }
    const start = a + b*c, result = fraction(b*c,b-1);
    return exercise(m`a_1=${start},\quad a_{n+1}=\frac{a_n}{${b}}+${c},\quad ${target}=?`, "A process retains a fixed fraction of its previous amount and adds a fixed amount each cycle. Find its long-run amount.", exact(result),
      "Look for a fixed point. Check that the distance from this point shrinks at each step.",
      [m`L=\frac{L}{${b}}+${c}\quad\Longrightarrow\quad L=${result}`, m`a_n-L=(a_1-L)\left(\frac{1}{${b}}\right)^{n-1}\longrightarrow 0`]);
  }),

  calc_series: topic(2, "Series", ["geometric_sum", "telescoping_sum"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(2,8+s), b = rng.int(2,5+s);
    if (form === 0) {
      const numerator = s === 0 ? 1 : rng.pick([-1,1])*rng.int(1,b-1);
      const ratio = fraction(numerator,b), value = fraction(a*b,b-numerator);
      return exercise(m`\sum_{n=0}^{\infty}${a}\left(${ratio}\right)^n`, "Find the exact sum of this geometric series.", exact(value),
        "Identify the first term and common ratio, and check its magnitude before summing.",
        [m`a_0=${a},\quad r=${ratio},\quad |r|<1`, m`S=\frac{${a}}{1-(${ratio})}=${value}`]);
    }
    const shift = s+1;
    const denominator = Array.from({length:shift}, (_,i)=>b+i).reduce((u,v)=>u*v,1);
    const numerator = Array.from({length:shift}, (_,i)=>denominator/(b+i)).reduce((u,v)=>u+v,0);
    const value = fraction(a*numerator,shift*denominator);
    return exercise(m`\sum_{n=${b}}^{\infty}\frac{${a}}{n(n+${shift})}`, "This series gives the total from successive contributions. Find its exact sum.", exact(value),
      "Split each term into a difference of reciprocals. Look for the offset between terms that cancel.",
      [m`\frac{${a}}{n(n+${shift})}=\frac{${a}}{${shift}}\left(\frac{1}{n}-\frac{1}{n+${shift}}\right)`,
        m`S_N=\frac{${a}}{${shift}}\left(\sum_{j=${b}}^{${b+shift-1}}\frac{1}{j}-\sum_{j=N+1}^{N+${shift}}\frac{1}{j}\right)\quad(N\geq ${b+shift-1})`,
        m`\lim_{N\to\infty}S_N=${value}`]);

  }),

  calc_integral_test: topic(2, "The integral test and estimates of sums", ["integral_convergence", "integral_remainder"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(1,6+s), n = rng.int(3,8+s);
    if (form === 0) {
      const p = rng.int(1,3+s), conv = p > 1;
      const upper = conv ? m`\frac{${a}}{${p-1}(\ln ${n})^{${p-1}}}` : m`\infty`;
      return exercise(m`\sum_{n=${n}}^{\infty}\frac{${a}}{n(\ln n)^{${p}}}`, "Use the integral test to decide whether the series converges.", decision(conv ? "converges" : "diverges", convergence),
        "The summand extends to a positive decreasing function here. Use u = ln x in its improper integral.",
        [m`u=\ln x,\quad du=\frac{dx}{x}`, m`\int_{\ln ${n}}^\infty ${a}u^{-${p}}\,du=${upper}`],
        conv ? "The integral is finite, so the series converges." : "The logarithmic antiderivative grows without bound, so the series diverges.");
    }
    const p = rng.int(2,3+s), value = fraction(a,(p-1)*n**(p-1));
    const series = m`S=\sum_{j=1}^{\infty}\frac{${a}}{j^{${p}}}`;
    if (s === 2) {
      return exercise(m`${series},\quad\varepsilon=${value}`, "Find the smallest positive number of terms N for which the integral-test upper bound guarantees an error at most ε.", exact(n),
        "Set the integral from N to infinity less than or equal to the tolerance. Find the least integer satisfying this inequality.",
        [m`R_N\leq\frac{${a}}{${p-1}N^{${p-1}}}\leq ${value}`, m`N^{${p-1}}\geq ${n**(p-1)}`, m`N_{\min}=${n}`],
        "This count is the smallest certified by this bound. The actual error may be smaller.");
    }
    if (s === 1) {
      const lower = fraction(a,(p-1)*(n+1)**(p-1));
      return exercise(m`${series},\quad N=${n}`, "Use the integral-test estimates to report (lower bound, upper bound) for the error after N terms.", { kind: "ordered_pair", latex: `(${lower},${value})` },
        "For a decreasing summand the lower estimate starts at N + 1 and the upper estimate starts at N.",
        [m`\int_{N+1}^\infty ${a}x^{-${p}}\,dx\leq R_N\leq\int_N^\infty ${a}x^{-${p}}\,dx`,
          m`${lower}\leq R_{${n}}\leq ${value}`], "These bounds describe the uncertainty remaining after truncation.");
    }
    return exercise(m`${series},\quad N=${n}`, "After summing N terms, give the integral-test upper bound on the remaining sum.", exact(value),
      "For a positive decreasing summand, integrate from N to infinity to obtain the upper bound.",
      [m`0<R_N=S-S_N\leq\int_N^\infty ${a}x^{-${p}}\,dx`, m`R_{${n}}\leq\frac{${a}}{${p-1}(${n})^{${p-1}}}=${value}`],
      "This is the bound on the error. The actual remainder is smaller.");
  }),

  calc_comparison_test: topic(2, "The comparison test", ["direct_comparison", "limit_comparison"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(1,5+s), b = rng.int(2,5+s), p = rng.int(1,3+s);
    if (form === 0) {
      const conv = p > 1;
      return exercise(m`\sum_{n=1}^\infty\frac{${a}}{n^{${p}}+${b}}`, "Use direct comparison to determine convergence.", decision(conv ? "converges" : "diverges", convergence),
        conv ? "Bound the positive terms above by dropping the constant from the denominator." : "Use n + b ≤ (1 + b)n for n ≥ 1 to find a divergent lower bound.",
        [conv ? m`0<\frac{${a}}{n^{${p}}+${b}}\leq\frac{${a}}{n^{${p}}}` : m`\frac{${a}}{n+${b}}\geq\frac{${a}}{${b+1}n}`,
          conv ? m`${p}>1,\quad\sum_{n=1}^\infty n^{-${p}}<\infty` : m`\sum_{n=1}^\infty\frac{1}{n}=\infty`],
        conv ? "The p-series upper bound converges, so the given series converges." : "The harmonic lower bound diverges, so the given series diverges.");
    }
    const value = fraction(a,b);
    const target = m`\lim_{n\to\infty}\frac{a_n}{b_n}`;
    return exercise(m`a_n=\frac{${a}n+1}{${b}n^{${p+1}}+1},\quad b_n=\frac{1}{n^{${p}}},\quad ${target}=?`, "A summation estimate uses the comparison sequence as a benchmark. Find the limiting ratio.", exact(value),
      "Multiply by the reciprocal of the comparison term, then divide by the highest power of n.",
      [m`\frac{a_n}{b_n}=\frac{${a}n^{${p+1}}+n^{${p}}}{${b}n^{${p+1}}+1}`, m`${target}=${value}`],
      `This finite positive limit transfers the behavior of the comparison series. Both series ${p === 1 ? "diverge" : "converge"}.`);
  }),

  calc_ratio_root: topic(2, "Absolute convergence and the ratio and root tests", ["ratio_test", "root_test"], ["CLO1", "CLO1"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(2,5+s), b = s === 0 ? a + rng.pick([-1, 1]) : s === 2 && rng.pick([true,false]) ? a : rng.int(2,5+s), p = rng.int(1,3+s);
    const ratio = fraction(a,b), correct = a < b ? "absolute" : a === b ? "inconclusive" : "diverges";
    const answer = decision(correct, {absolute:"The test proves absolute convergence", diverges:"The test proves divergence", inconclusive:"The test is inconclusive"});
    const conclusion = a === b ? "A limit of one gives no verdict. The harmonic series ∑ 1/n diverges and ∑ 1/n² converges, yet both have ratio-test and root-test limits of one." : a < b ? "The limit is below one, which proves absolute convergence." : "The limit exceeds one, which proves divergence.";
    if (form === 0) {
      return exercise(m`\sum_{n=1}^\infty(-1)^n n^{${p}}\left(\frac{${a}}{${b}}\right)^n`, "What conclusion does the ratio test give?", answer,
        "Take the absolute ratio of consecutive terms. The ratio of the polynomial factors approaches one.",
        [m`\left|\frac{a_{n+1}}{a_n}\right|=\left(1+\frac{1}{n}\right)^{${p}}\frac{${a}}{${b}}`, m`L=\lim_{n\to\infty}\left|\frac{a_{n+1}}{a_n}\right|=${ratio}`], conclusion);
    }
    return exercise(m`\sum_{n=1}^\infty(-1)^n\left(\frac{${a}n+${p}}{${b}n+1}\right)^n`, "What conclusion does the root test give?", answer,
      "Take the nth root of the absolute value before passing to the limit.",
      [m`\sqrt[n]{|a_n|}=\frac{${a}n+${p}}{${b}n+1}`, m`L=\lim_{n\to\infty}\frac{${a}+${p}/n}{${b}+1/n}=${ratio}`], conclusion);
  }),

  calc_series_strategy: topic(2, "Strategy for testing series", ["alternating_classification", "choose_series_argument"], ["CLO1", "CLO1"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(1,6+s), p = rng.int(0,2+s);
    if (form === 0) {
      const correct = p === 0 ? "divergent" : p === 1 ? "conditional" : "absolute";
      return exercise(m`\sum_{n=1}^{\infty}(-1)^{n+1}\frac{${a}}{n^{${p}}}`, "Classify this series. Check both its signed and absolute terms.", decision(correct, classification),
        "First check whether the terms tend to zero, then examine the absolute series and the alternating-series conditions.",
        [m`|a_n|=${a}n^{-${p}}`, p === 0 ? m`|a_n|=${a}\not\to 0` : m`|a_n|\downarrow 0,\quad \sum |a_n|=${a}\sum n^{-${p}}`],
        p === 0 ? "Its terms fail to approach zero, so the series diverges." : p === 1 ? "The alternating series converges, while its absolute series is harmonic and diverges." : "The absolute series is a convergent p-series.");
    }
    const vanishes = rng.pick([true,false]), exponent = vanishes ? p+2 : 1;
    const options = { compare: "Converges by comparison with a convergent p-series", term: "Diverges because the terms do not approach zero", harmonic: "Terms approach zero, but a harmonic lower bound proves divergence" };
    const correct = exponent === 1 ? "term" : exponent === 2 ? "harmonic" : "compare";
    return exercise(m`\sum_{n=1}^{\infty}\frac{${a}n}{n^{${exponent}}+1}`, "Choose the argument that establishes the behavior of this series.", decision(correct,options),
      "Inspect the term limit first. When it is zero, compare leading powers to a p-series.",
      [m`b_n=n^{1-${exponent}},\quad \lim_{n\to\infty}\frac{a_n}{b_n}=${a}`,
        exponent === 1 ? m`\lim_{n\to\infty}a_n=${a}` : exponent === 2 ? m`a_n\geq \frac{${a}}{2n}` : m`a_n\leq \frac{${a}}{n^{${exponent-1}}}`],
      exponent === 1 ? "The nonzero term limit proves divergence immediately." : exponent === 2 ? "The harmonic lower bound proves divergence." : "The p-series upper bound converges.");
  }),

  calc_power_series: topic(2, "Power series", ["radius", "interval_of_convergence"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(2,6+s), c = rng.int(1,4+s);
    const p = s === 2 ? rng.int(0,3) : s === 1 ? rng.int(1,2) : 1;
    const reflected = s > 0 && rng.pick([true,false]), base = reflected ? `${c}-x` : `x-${c}`;
    const prompt = m`\sum_{n=1}^\infty \frac{(${base})^n}{${a}^n n^{${p}}}`;
    const condition = m`L=\frac{|x-${c}|}{${a}},\quad |x-${c}|<${a}`;
    if (form === 0) return exercise(prompt, "Find the radius of convergence.", exact(a),
      "Use the ratio test on successive terms. Isolate the allowed distance from the center.", [condition,m`R=${a}`]);
    const left = c-a, right = c+a;
    const leftClosed = reflected ? p>1 : p>0, rightClosed = reflected ? p>0 : p>1;
    const interval = `${leftClosed ? "[" : "("}${left},${right}${rightClosed ? "]" : ")"}`;
    const numeratorLeft = reflected ? "1" : "(-1)^n", numeratorRight = reflected ? "(-1)^n" : "1";
    return exercise(prompt, "This power series is used to approximate a function. Give the full interval where summing it defines a finite value, checking both endpoints.", { kind: "interval", latex: interval },
      "Use the ratio test for the interior and substitute each endpoint into the original series.",
      [condition, m`x=${left}:\quad\sum_{n=1}^\infty\frac{${numeratorLeft}}{n^{${p}}}`, m`x=${right}:\quad\sum_{n=1}^\infty\frac{${numeratorRight}}{n^{${p}}}`, m`I=${interval}`],
      p === 0 ? "Neither endpoint series has terms tending to zero." : p === 1 ? `The ${reflected ? "right" : "left"} endpoint gives an alternating harmonic series. The positive harmonic series excludes the other endpoint.` : "Both endpoint series converge absolutely because the exponent exceeds one.");
  }),

  calc_taylor_series: topic(2, "Maclaurin and Taylor series", ["maclaurin_coefficient", "taylor_polynomial"], ["CLO1","CLO3"], (form, rng, difficulty) => {
    const s = level[difficulty], a = rng.int(2,5+s), c = rng.int(1,5+s), degree = rng.int(2,3+s);
    if (form === 0) {
      const fact = [1,1,2,6,24,120][degree], answer = fraction(a**degree,fact);
      return exercise(m`f(x)=e^{${a}x},\quad k=${degree}`, "Give the coefficient of xᵏ in the Maclaurin series.", exact(answer),
        "Use the kth derivative at zero divided by k factorial.",
        [m`f^{(${degree})}(0)=${a}^{${degree}}`, m`[x^{${degree}}]f(x)=\frac{${a**degree}}{${fact}}=${answer}`]);
    }
    const answer = `${a*c**3}${signedTerm(3*a*c*c, `(x-${c})`)}${signedTerm(3*a*c, `(x-${c})^2`)}`;
    return exercise(m`f(x)=${a}x^3,\quad x_0=${c}`, "A volume model varies as f(x). Give its degree-two local approximation about the operating point x₀.", {kind:"expression",latex:answer},
      "Use the function value, first derivative and half the second derivative, all evaluated at the center.",
      [m`f(${c})=${a*c**3},\quad f'(${c})=${3*a*c*c},\quad f''(${c})=${6*a*c}`, m`T_2(x)=${answer}`]);
  })
} as const;
