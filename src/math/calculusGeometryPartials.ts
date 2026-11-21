import type { AnswerSpec, Difficulty } from "../types";
import { topic, type CalculusProblem } from "./calculusTopic";
import { fraction, signedTerm } from "./format";
import type { SeededRandom } from "./rng";

type Triple = [number, number, number];
const scales: Record<Difficulty, number> = { easy: 3, medium: 5, hard: 8 };
const xyz = ["x", "y", "z"] as const;

function position(rng: SeededRandom, limit: number): Triple {
  return [rng.int(-limit, limit), rng.int(-limit, limit), rng.int(-limit, limit)];
}

function direction(rng: SeededRandom, limit: number): Triple {
  return [rng.nonZero(-limit, limit), rng.int(-limit, limit), rng.nonZero(-limit, limit)];
}

function tuple(values: (number | string)[]): string {
  return `(${values.join(",")})`;
}

function dot(u: Triple, v: Triple): number {
  return u.reduce((total, value, i) => total + value * v[i], 0);
}

function products(u: Triple, v: Triple): string {
  return u.map((value, i) => `(${value})(${v[i]})`).join("+");
}

function terms(values: number[], variables: readonly string[]): string {
  return values.map((n, i) => signedTerm(n, variables[i])).join("").replace(/^\+/, "") || "0";
}

function offset(variable: string, center: number): string {
  return center === 0 ? variable : `(${variable}${signedTerm(-center)})`;
}

function problem(instruction: string, promptLatex: string, answer: AnswerSpec, hints: string[], steps: string[], workedConclusion?: string): CalculusProblem {
  return { instruction, promptLatex, answer, hints, workedSolution: steps, workedConclusion };
}

function number(value: string | number): AnswerSpec {
  return { kind: "number", latex: String(value) };
}

function triple(value: (number | string)[]): AnswerSpec {
  return { kind: "ordered_triple", latex: tuple(value) };
}

function choice(correct: string, entries: [string, string][]): AnswerSpec {
  return { kind: "choice", latex: correct, choices: entries.map(([value, label]) => ({ value, label })) };
}

export const geometryPartialsTopics = {
  calc_space_coordinates: topic(3, "Three-dimensional coordinates", ["distance_in_space", "coordinate_projection"], ["CLO3", "CLO1"], (form, rng, difficulty) => {
    const limit = scales[difficulty];
    const p = position(rng, limit);
    if (form === 0) {
      const d = direction(rng, limit);
      const q = p.map((v, i) => v + d[i]);
      const distance = `\\sqrt{${dot(d, d)}}`;
      return problem("Find the exact distance between the two points.", `P=${tuple(p)},\\quad Q=${tuple(q)}`, number(distance),
        ["Subtract the coordinates to get the displacement.", "Apply the three-dimensional distance formula."],
        [`Q-P=${tuple(d)}`, `PQ=\\sqrt{${d.map(v => `(${v})^2`).join("+")}}=${distance}`]);
    }
    const axis = rng.int(0, 2);
    p[axis] = rng.nonZero(-limit, limit);
    const plane = xyz.filter((_, i) => i !== axis).join("");
    const projected = p.map((v, i) => i === axis ? 0 : v);
    return problem(`Project P perpendicularly onto the ${plane}-plane. Enter the point as (x, y, z).`, `P=${tuple(p)}`, triple(projected),
      ["Which coordinate is zero everywhere in this plane?", "A perpendicular projection leaves the other two coordinates unchanged."],
      [`${xyz[axis]}_{\\mathrm{projected}}=0`, `P_{\\mathrm{projected}}=${tuple(projected)}`]);
  }),

  calc_vectors: topic(3, "Vectors", ["directed_displacement", "resultant_displacement"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const limit = scales[difficulty];
    const u = position(rng, limit);
    const v = direction(rng, limit);
    if (form === 0) {
      const b = u.map((value, i) => value + v[i]);
      return problem("Find the displacement from A to B. Enter its three components in order.", `A=${tuple(u)},\\quad B=${tuple(b)}`, triple(v),
        ["Read the endpoints in the stated order.", "Subtract the starting coordinates from the ending coordinates."],
        [`\\overrightarrow{AB}=B-A=${tuple(b)}-${tuple(u)}`, `\\overrightarrow{AB}=${tuple(v)}`]);
    }
    const s = rng.int(2, limit + 1);
    const total = u.map((value, i) => value + s * v[i]);
    return problem(`An object moves by u once, then by v ${s} times. Give its net displacement in metres as (x, y, z).`,
      `\\mathbf{u}=${tuple(u)}\\,\\mathrm{m},\\quad\\mathbf{v}=${tuple(v)}\\,\\mathrm{m}`, triple(total),
      ["Multiply every component of v by the number of repetitions.", "Add corresponding components of the two displacements."],
      [`\\Delta\\mathbf{r}=\\mathbf{u}+${s}\\mathbf{v}`, `\\Delta\\mathbf{r}=${tuple(u)}+${tuple(v.map(value => s * value))}=${tuple(total)}\\,\\mathrm{m}`]);
  }),

  calc_dot_product: topic(3, "The dot product", ["angle_classification", "signed_work"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const limit = scales[difficulty];
    const u = direction(rng, limit);
    const v: Triple = form === 0 && rng.int(0, 2) === 0 ? [-u[1], u[0], 0] : direction(rng, limit);
    const value = dot(u, v);
    if (form === 0) {
      const angle = value > 0 ? "below_right" : value < 0 ? "above_right" : "right";
      return problem("Which statement describes the angle θ between these nonzero vectors?",
        `\\mathbf{u}=${tuple(u)},\\quad\\mathbf{v}=${tuple(v)}`,
        choice(angle, [["below_right", "Less than 90°"], ["right", "Exactly 90°"], ["above_right", "Greater than 90°"]]),
        ["Take the dot product.", "The sign of the dot product is the sign of the cosine of the angle."],
        [`\\mathbf{u}\\cdot\\mathbf{v}=${products(u, v)}=${value}`, `\\cos\\theta=\\frac{${value}}{\\lVert\\mathbf{u}\\rVert\\lVert\\mathbf{v}\\rVert}`],
        value > 0 ? "The cosine is positive, so the angle is less than 90°." : value < 0 ? "The cosine is negative, so the angle is greater than 90°." : "The vectors are perpendicular, so the angle is 90°.");
    }
    return problem("Find the signed work in joules done by the constant force F during the displacement d.",
      `\\mathbf{F}=${tuple(u)}\\,\\mathrm{N},\\quad\\mathbf{d}=${tuple(v)}\\,\\mathrm{m}`, number(value),
      ["Work is the dot product of force and displacement.", "Keep the signs of the components."],
      [`W=\\mathbf{F}\\cdot\\mathbf{d}=${products(u, v)}`, `W=${value}\\,\\mathrm{J}`],
      value < 0 ? "The force opposes the displacement overall and takes energy from the object." : value > 0 ? "The force contributes energy in the direction of the displacement." : "The force acts perpendicular to the displacement and does zero work.");
  }),

  calc_cross_product: topic(3, "The cross product", ["oriented_cross_product", "right_hand_orientation"], ["CLO3", "CLO1"], (form, rng, difficulty) => {
    const limit = scales[difficulty];
    const u = direction(rng, limit);
    const v = position(rng, limit);
    if (form === 0) {
      const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      return problem("Compute u × v in the stated order. Enter the three components.",
        `\\mathbf{u}=${tuple(u)},\\quad\\mathbf{v}=${tuple(v)}`, triple(cross),
        ["Use the right-handed coordinate order x, y, z.", "The middle component is u₃v₁ − u₁v₃."],
        [`\\mathbf{u}\\times\\mathbf{v}=(u_2v_3-u_3v_2,u_3v_1-u_1v_3,u_1v_2-u_2v_1)`, `\\mathbf{u}\\times\\mathbf{v}=${tuple(cross)}`]);
    }
    const i = rng.int(0, 2);
    const j = (i + rng.int(1, 2)) % 3;
    const k = 3 - i - j;
    const a = u[0], b = u[2];
    const sign = Math.sign(a * b) * (j === (i + 1) % 3 ? 1 : -1);
    const axis = `${sign > 0 ? "positive" : "negative"}_${xyz[k]}`;
    const axes: [string, string][] = xyz.flatMap(name => [[`positive_${name}`, `Positive ${name}-axis`], [`negative_${name}`, `Negative ${name}-axis`]] as [string, string][]);
    return problem("In right-handed coordinates, which direction does u × v point?",
      `\\mathbf{u}=${terms([a], [`\\mathbf{e}_{${xyz[i]}}`])},\\quad\\mathbf{v}=${terms([b], [`\\mathbf{e}_{${xyz[j]}}`])}`,
      choice(axis, axes), ["Use the cyclic order x, y, z to find the cross product of the two unit vectors.", "A negative scalar reverses direction."],
      [`\\mathbf{e}_{${xyz[i]}}\\times\\mathbf{e}_{${xyz[j]}}=${j === (i + 1) % 3 ? "" : "-"}\\mathbf{e}_{${xyz[k]}}`,
        `\\mathbf{u}\\times\\mathbf{v}=${terms([sign * Math.abs(a * b)], [`\\mathbf{e}_{${xyz[k]}}`])}`], `The product points along the ${sign > 0 ? "positive" : "negative"} ${xyz[k]}-axis.`);
  }),

  calc_lines_planes: topic(3, "Equations of lines and planes", ["parametric_line", "plane_through_point"], ["CLO3", "CLO3"], (form, rng, difficulty) => {
    const limit = scales[difficulty];
    const p = position(rng, limit);
    const v = direction(rng, limit);
    if (form === 0) {
      const components = p.map((value, i) => terms([v[i], value], ["t", ""]));
      return problem("Write the line as (x(t), y(t), z(t)) with this initial point and constant velocity.",
        `\\mathbf{r}(0)=${tuple(p)},\\quad\\mathbf{r}'(t)=${tuple(v)}`, triple(components),
        ["The vector equation is r(t) = r(0) + tv.", "Write each coordinate using the same parameter t."],
        [`\\mathbf{r}(t)=${tuple(p)}+t${tuple(v)}`, `\\mathbf{r}(t)=${tuple(components)}`]);
    }
    const equation = `${terms(v, xyz)}=${dot(p, v)}`;
    return problem("Write a Cartesian equation of the plane through P with normal n.",
      `P=${tuple(p)},\\quad\\mathbf{n}=${tuple(v)}`, { kind: "equation", latex: equation },
      ["Subtract P from a general point (x, y, z) of the plane.", "Its displacement from P is perpendicular to the normal."],
      [`\\mathbf{n}\\cdot((x,y,z)-P)=0`, `${terms(v, xyz)}=${products(v, p)}`, equation]);
  }),

  calc_multivariable_functions: topic(4, "Functions of several variables", ["domain_slice", "field_evaluation"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const limit = scales[difficulty];
    if (form === 0) {
      const y = rng.nonZero(-limit, limit);
      const bound = rng.int(1, limit);
      const total = y * y + bound * bound;
      const strict = rng.int(0, 1) === 1;
      const root = `\\sqrt{${total}-x^2-y^2}`;
      const interval = strict ? `(-${bound},${bound})` : `[-${bound},${bound}]`;
      const relation = strict ? ">" : "\\ge";
      return problem("At the specified y, give all real x in the domain as one interval.",
        `f(x,y)=${strict ? `\\frac{1}{${root}}` : root},\\quad y=${y}`, { kind: "interval", latex: interval },
        ["Substitute the given y into the radicand.", strict ? "A square root in the denominator must be strictly positive." : "A real square root permits a zero radicand."],
        [`${total}-x^2-(${y})^2${relation}0`, `x^2${strict ? "<" : "\\le"}${bound * bound}`, `x\\in${interval}`]);
    }
    const a = rng.int(1, limit), b = rng.nonZero(-limit, limit), c = rng.int(8, 25);
    const [x, y] = position(rng, limit);
    const field = terms([a, b, c], ["x^2", "y", ""]);
    const value = a * x * x + b * y + c;
    return problem("A lab models plate temperature T in degrees Celsius. Find the model temperature at P.",
      `T(x,y)=${field},\\quad P=${tuple([x, y])}`, number(value),
      ["Insert the first coordinate for x and the second for y.", "Square x before multiplying it by its coefficient."],
      [`T(${x},${y})=(${a})(${x})^2+(${b})(${y})+${c}`, `T(${x},${y})=${value}\\,^\\circ\\mathrm{C}`]);
  }),

  calc_limits_continuity: topic(4, "Limits and continuity", ["continuous_extension", "two_path_limit"], ["CLO3", "CLO1"], (form, rng, difficulty) => {
    const limit = scales[difficulty];
    const a = rng.nonZero(-limit, limit);
    if (form === 0) {
      const c = rng.nonZero(-limit, limit);
      return problem("The displayed rule holds away from the origin. Find the value f(0,0) that makes f continuous there.",
        `f(x,y)=${c}${a < 0 ? "-" : "+"}\\frac{${terms([Math.abs(a)], ["x^2y"])}}{x^2+y^2}`, number(c),
        ["Bound x²/(x²+y²) between 0 and 1.", "Use the resulting bound on the absolute difference from the constant term."],
        [`0\\le\\frac{x^2}{x^2+y^2}\\le1`, `|f(x,y)-(${c})|\\le${terms([Math.abs(a)], ["|y|"])}\\to0`, `f(0,0)=${c}`]);
    }
    const b = rng.pick([a, -a]);
    const same = a === b;
    return problem("Decide whether the two-variable limit exists.",
      `\\lim_{(x,y)\\to(0,0)}\\frac{${terms([a, b], ["x^2", "y^2"])}}{x^2+y^2}`,
      choice(same ? "exists" : "dne", [["exists", "The limit exists"], ["dne", "The limit does not exist"]]),
      ["Compare approaches along the coordinate axes.", "If the axis limits agree, seek an argument valid in every direction."],
      same ? [`f(x,y)=\\frac{(${a})(x^2+y^2)}{x^2+y^2}=${a}\\quad((x,y)\\ne(0,0))`, `\\lim_{(x,y)\\to(0,0)}f(x,y)=${a}`] :
        [`f(x,0)=${a}\\quad(x\\ne0)`, `f(0,y)=${b}\\quad(y\\ne0)`],
      same ? "The expression is constant away from the origin, so every approach has the same limit." : "The axis limits differ, so the two-variable limit does not exist.");
  }),

  calc_partial_derivatives: topic(4, "Partial derivatives", ["first_partial", "mixed_partial"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const limit = scales[difficulty];
    const a = rng.nonZero(-limit, limit), b = rng.nonZero(-limit, limit), c = rng.nonZero(-limit, limit);
    const field = terms([a, b, c], ["x^2y", "xy^2", "y"]);
    if (form === 0) {
      const wrtX = rng.int(0, 1) === 0;
      const derivative = wrtX ? terms([2 * a, b], ["xy", "y^2"]) : terms([a, 2 * b, c], ["x^2", "xy", ""]);
      const variable = wrtX ? "x" : "y";
      return problem(`Find the partial derivative with respect to ${variable} as an expression in x and y.`,
        `f(x,y)=${field}`, { kind: "expression", latex: derivative },
        [`Hold ${wrtX ? "y" : "x"} fixed.`, "Use the power rule on each term."],
        [`f_{${variable}}=\\frac{\\partial}{\\partial ${variable}}\\left(${field}\\right)`, `f_{${variable}}=${derivative}`]);
    }
    const [x, y] = position(rng, limit);
    const result = 2 * a * x + 2 * b * y;
    return problem("First differentiate f with respect to x, then y. Evaluate the mixed derivative at P.",
      `f(x,y)=${field},\\quad P=${tuple([x, y])}`, number(result),
      ["Take both derivatives before substituting the point.", "The first derivative still depends on both coordinates."],
      [`f_x=${terms([2 * a, b], ["xy", "y^2"])}`, `f_{xy}=${terms([2 * a, 2 * b], ["x", "y"])}`, `f_{xy}(${x},${y})=${result}`]);
  }),

  calc_tangent_planes: topic(4, "Tangent planes and linear approximation", ["tangent_plane", "linear_approximation"], ["CLO3", "CLO3"], (form, rng, difficulty) => {
    const limit = scales[difficulty];
    const a = rng.int(1, limit), b = rng.nonZero(-limit, limit);
    const x = rng.nonZero(-limit, limit), y = rng.nonZero(-limit, limit);
    const z = a * x * x + b * y * y;
    const dx = 2 * a * x, dy = 2 * b * y;
    const data = `f(x,y)=${terms([a, b], ["x^2", "y^2"])},\\quad P=${tuple([x, y])}`;
    const steps = [`f(P)=${z},\\quad f_x(P)=${dx},\\quad f_y(P)=${dy}`,
      `L(x,y)=${terms([z, dx, dy], ["", offset("x", x), offset("y", y)])}`];
    if (form === 0) {
      const equation = `z=${terms([dx, dy, z - dx * x - dy * y], ["x", "y", ""])}`;
      return problem("Give an equation of the plane tangent to z = f(x,y) above P.", data, { kind: "equation", latex: equation },
        ["Evaluate both first partial derivatives at P.", "Use the value and the two slopes in the tangent plane formula."], [...steps, equation]);
    }
    const stepX = rng.nonZero(-3, 3), stepY = rng.nonZero(-3, 3);
    const q = [((10 * x + stepX) / 10).toFixed(1), ((10 * y + stepY) / 10).toFixed(1)];
    const approximation = fraction(10 * z + dx * stepX + dy * stepY, 10);
    return problem("Use the linear approximation at P to estimate f(Q). Enter the value of that approximation.",
      `${data},\\quad Q=${tuple(q)}`, number(approximation),
      ["Find the value and slopes at P.", "Multiply each slope by the corresponding change from P to Q."],
      [...steps, `L(Q)=${z}+(${dx})(${fraction(stepX, 10)})+(${dy})(${fraction(stepY, 10)})=${approximation}`]);
  }),

  calc_chain_rule: topic(4, "The chain rule", ["curve_derivative", "temperature_rate"], ["CLO3", "CLO3"], (form, rng, difficulty) => {
    const limit = scales[difficulty];
    const a = rng.nonZero(-limit, limit), b = rng.nonZero(-limit, limit);
    const u = rng.nonZero(-limit, limit), v = rng.nonZero(-limit, limit);
    if (form === 0) {
      const t = rng.nonZero(-limit, limit);
      const value = 2 * a * u * u * t + 2 * b * v * t;
      return problem("Along the given curve, find dz/dt at the specified t.",
        `z=${terms([a, b], ["x^2", "y"])},\\quad x=${terms([u], ["t"])},\\quad y=${terms([v], ["t^2"])},\\quad t=${t}`,
        number(value), ["Differentiate each coordinate with respect to t.", "Add the two products of a partial derivative and its coordinate rate."],
        [`\\frac{dz}{dt}=z_x\\frac{dx}{dt}+z_y\\frac{dy}{dt}`,
          `\\frac{dz}{dt}=(${terms([2 * a], ["x"])})(${u})+(${b})(${terms([2 * v], ["t"])})`, `\\left.\\frac{dz}{dt}\\right|_{t=${t}}=${value}`]);
    }
    const value = a * u + b * v;
    return problem("A sensor moves across a time-independent temperature field. At this instant, find its signed temperature rate in °C/s.",
      `(T_x,T_y)=${tuple([a, b])}\\,{}^\\circ\\mathrm{C}/\\mathrm{m},\\quad(x',y')=${tuple([u, v])}\\,\\mathrm{m}/\\mathrm{s}`, number(value),
      ["The field changes along the sensor's path in both coordinate directions.", "Multiply each spatial rate by the corresponding velocity component."],
      [`\\frac{dT}{dt}=T_xx'+T_yy'`, `\\frac{dT}{dt}=(${a})(${u})+(${b})(${v})=${value}\\,{}^\\circ\\mathrm{C}/\\mathrm{s}`],
      value > 0 ? "The positive rate means the sensor is warming at this instant." : value < 0 ? "The negative rate means the sensor is cooling at this instant." : "The two contributions cancel at this instant.");
  }),

  calc_extrema: topic(4, "Maximum and minimum values", ["critical_point_classification", "rectangle_extreme"], ["CLO1", "CLO3"], (form, rng, difficulty) => {
    const limit = scales[difficulty];
    const a = rng.nonZero(-limit, limit), b = rng.nonZero(-limit, limit), c = rng.int(-limit, limit);
    if (form === 0) {
      const field = terms([a, b, c], ["x^2", "y^2", ""]);
      const type = a * b < 0 ? "saddle" : a > 0 ? "minimum" : "maximum";
      return problem("Classify the critical point of f at the origin.", `f(x,y)=${field}`,
        choice(type, [["minimum", "A strict local minimum"], ["maximum", "A strict local maximum"], ["saddle", "A saddle point"]]),
        ["Find the second partial derivatives.", "Use the Hessian determinant and the sign of the second x derivative."],
        [`\\nabla f(0,0)=(0,0)`, `D=(${2 * a})(${2 * b})-0^2=${4 * a * b},\\quad f_{xx}=${2 * a}`],
        type === "saddle" ? "The Hessian determinant is negative, which gives a saddle point." : type === "minimum" ? "The determinant and the second x derivative are positive, which gives a strict local minimum." : "The determinant is positive and the second x derivative is negative, which gives a strict local maximum.");
    }
    const x = rng.int(1, limit), y = rng.int(1, limit);
    const w = x + rng.int(1, limit), h = y + rng.int(1, limit);
    const by = Math.sign(a) * Math.abs(b);
    const field = terms([a, by, c], [`${offset("x", x)}^2`, `${offset("y", y)}^2`, ""]);
    const farX = Math.max(x, w - x), farY = Math.max(y, h - y);
    const value = a * farX * farX + by * farY * farY + c;
    return problem(`Find the absolute ${a > 0 ? "maximum" : "minimum"} value of f on the closed rectangle, including its boundary.`,
      `f(x,y)=${field},\\quad 0\\le x\\le ${w},\\quad 0\\le y\\le ${h}`, number(value),
      ["Consider how far each coordinate can be from the center of its square.", "The two largest squared distances can occur together at a corner."],
      [`\\max|x-${x}|=\\max(${x},${w - x})=${farX}`, `\\max|y-${y}|=\\max(${y},${h - y})=${farY}`,
        `f_{\\mathrm{${a > 0 ? "max" : "min"}}}=(${a})(${farX})^2+(${by})(${farY})^2+(${c})=${value}`]);
  })
} as const;
