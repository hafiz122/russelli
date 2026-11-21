import type { Difficulty } from "../types";
import { topic, type CalculusProblem } from "./calculusTopic";
import { fraction } from "./format";

const tex = String.raw;
const power: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

function numberProblem(instruction: string, promptLatex: string, promptDescription: string,
  answer: string, hints: string[], steps: string[], workedConclusion?: string): CalculusProblem {
  return {
    instruction, promptLatex, promptDescription, answer: { kind: "number", latex: answer }, hints,
    workedSolution: [...steps, tex`\boxed{${answer}}`], workedConclusion
  };
}

function piMultiple(numerator: number, denominator = 1): string {
  const coefficient = fraction(numerator, denominator);
  return coefficient === "1" ? tex`\pi` : tex`${coefficient}\pi`;
}

export const integralTopics = {
  calc_double_rectangles: topic(5, "Double integrals over rectangles", ["rectangle_polynomial", "taylor_integral"], ["CLO2", "CLO2"], (form, rng, difficulty) => {
    const n = power[difficulty], a = rng.int(1, 4 + n), b = rng.int(1, 4 + n), k = rng.int(2, 3 + n);
    const region = tex`R=[0,${a}]\times[0,${b}]`;
    if (form === 0) {
      const value = fraction(2 * b * a ** (n + 1) + (n + 1) * a * k * b ** 2, 2 * (n + 1));
      return numberProblem("Evaluate the double integral over the given rectangle.",
        tex`${region},\quad \iint_R (x^{${n}}+${k}y)\,dA`,
        `The rectangle goes from zero to ${a} in x and zero to ${b} in y. Integrate x to the power ${n} plus ${k} y.`, value,
        ["Sketch the rectangle and write its constant bounds.", "When integrating with respect to y, treat x as constant."],
        [tex`I=\int_0^{${a}}\int_0^{${b}}(x^{${n}}+${k}y)\,dy\,dx`,
          tex`I=\int_0^{${a}}\left(${b}x^{${n}}+${fraction(k * b ** 2, 2)}\right)dx`]);
    }
    const scale = k * a * b;
    // Common denominator of the integrated terms through degree three.
    const common = 288 * k ** n;
    const factorial = [1, 1, 2, 6];
    let numerator = 0;
    for (let j = 0; j <= n; j++) numerator += a * b * (common / (factorial[j] * k ** j * (j + 1) ** 2));
    const polynomial = ["1", "t", tex`\frac{t^2}{2}`, tex`\frac{t^3}{6}`].slice(0, n + 1).join("+");
    return numberProblem(`Estimate the integral by replacing the exponential with its degree-${n} Maclaurin polynomial. Enter the exact value of that polynomial integral.`,
      tex`${region},\quad I=\iint_R e^{xy/${scale}}\,dA`,
      `On the rectangle from zero to ${a} in x and zero to ${b} in y, integrate exp of x times y divided by ${scale}.`, fraction(numerator, common),
      ["Expand the exponential in t first, then substitute t = xy divided by the given denominator.", "Each term is a product of a power of x and a power of y."],
      [tex`P_{${n}}(t)=${polynomial},\quad t=\frac{xy}{${scale}}`,
        tex`I\approx\sum_{j=0}^{${n}}\frac{1}{j!\,${scale}^{j}}\int_0^{${a}}x^j\,dx\int_0^{${b}}y^j\,dy`,
        tex`I\approx ${a * b}\sum_{j=0}^{${n}}\frac{1}{j!\,(j+1)^2\,${k}^{j}}`],
      "The polynomial integral is exact. It underestimates the exponential integral because the omitted terms are positive inside the rectangle.");
  }),
  calc_iterated_integrals: topic(5, "Iterated integrals", ["inside_out", "reverse_order"], ["CLO2", "CLO2"], (form, rng, difficulty) => {
    const n = power[difficulty], a = rng.int(2, 4 + n), b = rng.int(1, 3 + n), k = rng.int(2, 4 + n);
    if (form === 0) {
      const value = fraction(k * b ** (n + 1) * a ** (n + 2), (n + 1) * (n + 2));
      return numberProblem("Evaluate the iterated integral in the order shown.",
        tex`\int_0^{${a}}\int_0^{${b}x}${k}y^{${n}}\,dy\,dx`,
        `Integrate ${k} y to the power ${n}, first over y from zero to ${b} x, then over x from zero to ${a}.`, value,
        ["Keep x fixed when evaluating the inner integral.", "Raise the whole upper limit to the new exponent."],
        [tex`\int_0^{${b}x}${k}y^{${n}}\,dy=${fraction(k, n + 1)}(${b}x)^{${n + 1}}`,
          tex`I=${fraction(k * b ** (n + 1), n + 1)}\int_0^{${a}}x^{${n + 1}}\,dx`]);
    }
    return numberProblem("Reverse the order of integration on paper, then evaluate the integral.",
      tex`\int_0^{${a}}\int_x^{${a}}\frac{${k}}{(${b}+y^2)^2}\,dy\,dx`,
      `Integrate ${k} divided by the square of the quantity (${b} plus y squared), with y from x to ${a} and x from zero to ${a}.`, fraction(k * a ** 2, 2 * b * (b + a ** 2)),
      ["Sketch the triangle above the line y = x.", "After reversing the order, substitute u = b + y² in the remaining integral, where b is the given constant."],
      [tex`0\le x\le y\le ${a},\quad I=\int_0^{${a}}\int_0^y\frac{${k}}{(${b}+y^2)^2}\,dx\,dy`,
        tex`I=\int_0^{${a}}\frac{${k}y}{(${b}+y^2)^2}\,dy=${fraction(k, 2)}\left(\frac1{${b}}-\frac1{${b + a ** 2}}\right)`]);
  }),
  calc_general_regions: topic(5, "Double integrals over general regions", ["parabola_line", "absolute_boundary"], ["CLO2", "CLO2"], (form, rng, difficulty) => {
    const n = power[difficulty], a = rng.int(2, 5 + n), k = rng.int(2, 5 + n);
    if (form === 0) {
      return numberProblem("Integrate over the bounded region enclosed by the two curves.",
        tex`y=x^2,\quad y=${a}x,\quad \iint_D ${k}x^{${n}}\,dA`,
        `D is enclosed by y equals x squared and y equals ${a} x. Integrate ${k} x to the power ${n}.`, fraction(k * a ** (n + 3), (n + 2) * (n + 3)),
        ["Solve x² = ax to find the intersection points.", "Use vertical slices with the line as the upper boundary."],
        [tex`x^2=${a}x\ \Rightarrow\ x=0,${a}`, tex`I=\int_0^{${a}}\int_{x^2}^{${a}x}${k}x^{${n}}\,dy\,dx`,
          tex`I=${k}\int_0^{${a}}x^{${n}}(${a}x-x^2)\,dx`]);
    }
    return numberProblem("Choose an order of integration that uses one pair of inner bounds and evaluate.",
      tex`D:\ |x|+y\le ${a},\ y\ge 0,\quad\iint_D ${k}y^{${n}}\,dA`,
      `D satisfies absolute x plus y at most ${a} and y nonnegative. Integrate ${k} y to the power ${n}.`, fraction(2 * k * a ** (n + 2), (n + 1) * (n + 2)),
      ["For fixed y, isolate the absolute value of x.", "The two ends of each horizontal slice are symmetric about the y-axis."],
      [tex`0\le y\le ${a},\quad y-${a}\le x\le ${a}-y`, tex`I=\int_0^{${a}}\int_{y-${a}}^{${a}-y}${k}y^{${n}}\,dx\,dy`,
        tex`I=${2 * k}\int_0^{${a}}y^{${n}}(${a}-y)\,dy`]);
  }),
  calc_polar_integrals: topic(5, "Double integrals in polar coordinates", ["annular_sector", "offset_disk"], ["CLO2", "CLO2"], (form, rng, difficulty) => {
    const n = power[difficulty], a = rng.int(1, 3 + n), k = rng.int(2, 3 + n);
    if (form === 0) {
      const b = a + rng.int(1, 3), divisor = rng.int(2, 6);
      return numberProblem("Evaluate the integral over the annular sector using polar coordinates.",
        tex`${a}\le r\le ${b},\quad 0\le\theta\le\pi/${divisor},\quad\iint_D ${k}(x^2+y^2)^{${n}}\,dA`,
        `Radius runs from ${a} to ${b} and angle from zero to pi over ${divisor}. Integrate ${k} times the quantity (x squared plus y squared) raised to the power ${n}.`,
        piMultiple(k * (b ** (2 * n + 2) - a ** (2 * n + 2)), divisor * (2 * n + 2)),
        ["Replace x² + y² with r².", "The area element contributes an additional factor of r."],
        [tex`I=\int_0^{\pi/${divisor}}\int_{${a}}^{${b}}${k}r^{${2 * n}}r\,dr\,d\theta`,
          tex`I=\frac{\pi}{${divisor}}\frac{${k}}{${2 * n + 2}}\left(${b}^{${2 * n + 2}}-${a}^{${2 * n + 2}}\right)`]);
    }
    return numberProblem("Use polar coordinates to integrate over the disk in the right half-plane.",
      tex`D:\ x^2+y^2\le ${2 * a}x,\quad \iint_D ${k}x\,dA`,
      `The disk satisfies x squared plus y squared at most ${2 * a} x. Integrate ${k} x.`, piMultiple(k * a ** 3),
      ["Replace x with r cos θ and solve for the radial boundary.", "Use the angles for which the radial boundary is nonnegative."],
      [tex`-\pi/2\le\theta\le\pi/2,\quad 0\le r\le ${2 * a}\cos\theta`,
        tex`I=\int_{-\pi/2}^{\pi/2}\int_0^{${2 * a}\cos\theta}${k}r^2\cos\theta\,dr\,d\theta`,
        tex`I=${fraction(k * (2 * a) ** 3, 3)}\int_{-\pi/2}^{\pi/2}\cos^4\theta\,d\theta=${fraction(k * (2 * a) ** 3, 3)}\cdot\frac{3\pi}{8}`]);
  }),
  calc_double_applications: topic(5, "Applications of double integrals", ["triangular_lamina", "mass_estimate"], ["CLO2", "CLO3"], (form, rng, difficulty) => {
    const n = power[difficulty], a = rng.int(2, 4 + n), b = rng.int(2, 4 + n), c = rng.int(2, 4 + n);
    if (form === 0) {
      return numberProblem("A triangular plate has the vertices and surface density shown. Find its mass in grams. Coordinates are in centimetres and density is in grams per square centimetre.",
        tex`(0,0),\ (${a},0),\ (0,${b}),\quad \sigma(x,y)=${c}+x`,
        `The vertices are (0, 0), (${a}, 0) and (0, ${b}). Surface density is ${c} plus x.`, fraction(a * b * (3 * c + a), 6),
        ["Find the line through the two nonzero intercepts.", "Integrate density over the plate's area."],
        [tex`0\le x\le ${a},\quad 0\le y\le ${b}(1-x/${a})`, tex`M=\int_0^{${a}}\int_0^{${b}(1-x/${a})}(${c}+x)\,dy\,dx`,
          tex`M=${b}\int_0^{${a}}(${c}+x)(1-x/${a})\,dx`], "Integrating grams per square centimetre over square centimetres gives grams.");
    }
    if (difficulty === "hard") {
      const divisor = rng.int(3, 8);
      const massNumerator = a * b * (3 * c + a ** 2);
      const errorNumerator = 3 * a * b;
      const lower = fraction(divisor * massNumerator - errorNumerator, 3 * divisor);
      const upper = fraction(divisor * massNumerator + errorNumerator, 3 * divisor);
      const interval = tex`[${lower},${upper}]`;
      return {
        instruction: "A fitted coating density has the stated absolute error bound everywhere on a rectangular sheet. Report the tightest guaranteed closed interval for the total mass, in grams. Lengths are in centimetres and densities in grams per square centimetre.",
        promptLatex: tex`R=[0,${a}]\times[0,${b}],\quad \widehat\sigma=${c}+x^2,\quad |\sigma-\widehat\sigma|\le 1/${divisor}`,
        promptDescription: `The sheet has width ${a} and height ${b}. The fitted surface density is ${c} plus x squared. At every point, the absolute error is at most one over ${divisor}.`,
        answer: { kind: "interval", latex: interval },
        hints: ["Integrate the fitted density over the rectangle.", "The largest possible total mass error equals the pointwise density error bound times the area."],
        workedSolution: [
          tex`\widehat M=\int_0^{${a}}\int_0^{${b}}(${c}+x^2)\,dy\,dx=${fraction(massNumerator, 3)}`,
          tex`|M-\widehat M|\le \iint_R |\sigma-\widehat\sigma|\,dA\le \frac{${a}\cdot${b}}{${divisor}}=${fraction(a * b, divisor)}`,
          tex`\widehat M-${fraction(a * b, divisor)}\le M\le\widehat M+${fraction(a * b, divisor)}`,
          tex`\boxed{${interval}}`
        ],
        workedConclusion: "The endpoints are attainable if the density error is constant at either extreme. Reporting the fitted mass alone would omit this uncertainty."
      };
    }
    return numberProblem("A coating report uses the maximum surface density everywhere on a rectangular sheet. By how many grams does its mass estimate exceed the integrated mass? Lengths are in centimetres and density is in grams per square centimetre.",
      tex`R=[0,${a}]\times[0,${b}],\quad \sigma(x,y)=${c}+x^{${n}}`,
      `The sheet has width ${a} and height ${b}. Its surface density is ${c} plus x to the power ${n}.`, fraction(n * b * a ** (n + 1), n + 1),
      ["The maximum density occurs on the right edge of the sheet.", "Subtract the integral of the density from maximum density times area."],
      [tex`M_{\mathrm{report}}=${a * b}(${c}+${a}^{${n}})`,
        tex`M=\int_0^{${a}}\int_0^{${b}}(${c}+x^{${n}})\,dy\,dx=${a * b * c}+${fraction(b * a ** (n + 1), n + 1)}`,
        tex`\Delta M=M_{\mathrm{report}}-M`], "The maximum-density calculation is an upper bound. Reporting it as the integrated mass would overstate the amount of coating.");
  }),
  calc_surface_area: topic(5, "Surface area", ["plane_patch", "paraboloid_patch"], ["CLO2", "CLO2"], (form, rng, difficulty) => {
    const n = power[difficulty], a = rng.int(1, 3 + n), b = rng.int(1, 3 + n);
    const slopeX = tex`\frac{\partial z}{\partial x}`, slopeY = tex`\frac{\partial z}{\partial y}`;
    const surfaceElement = tex`dS=\sqrt{1+\left(${slopeX}\right)^2+\left(${slopeY}\right)^2}\,dA`;
    if (form === 0) {
      const w = rng.int(2, 4 + n), h = rng.int(2, 4 + n);
      return numberProblem("Find the surface area of the part of the plane above the rectangle.",
        tex`z=${a}x+${b}y,\quad R=[0,${w}]\times[0,${h}]`,
        `The plane is z equals ${a} x plus ${b} y, above a rectangle of width ${w} and height ${h}.`, tex`${w * h}\sqrt{${1 + a ** 2 + b ** 2}}`,
        ["Find both first partial derivatives of the height.", "Square the two slopes, add their squares to one, and take the square root to get the surface area per unit of horizontal area."],
        [tex`${slopeX}=${a},\quad ${slopeY}=${b}`, surfaceElement, tex`S=\int_0^{${w}}\int_0^{${h}}\sqrt{1+${a}^2+${b}^2}\,dy\,dx`]);
    }
    const top = 1 + 4 * a ** 2 * b ** 2;
    return numberProblem("Find the exact area of the curved paraboloid above the disk.",
      tex`z=${a}(x^2+y^2),\quad x^2+y^2\le ${b ** 2}`,
      `Height is ${a} times the sum of x squared and y squared. The domain is a disk of radius ${b}.`, tex`\frac{(${top}\sqrt{${top}}-1)\pi}{${6 * a ** 2}}`,
      ["Compute both partial derivatives before changing to polar coordinates.", "Substitute u = 1 + 4a²r² in the radial integral, where a is the height coefficient."],
      [tex`${slopeX}=${2 * a}x,\quad ${slopeY}=${2 * a}y`, surfaceElement, tex`S=2\pi\int_0^{${b}}r\sqrt{1+${4 * a ** 2}r^2}\,dr`,
        tex`S=\frac{\pi}{${4 * a ** 2}}\int_1^{${top}}\sqrt{u}\,du`]);
  }),
  calc_triple_integrals: topic(5, "Triple integrals", ["bounding_planes", "tetrahedral_density"], ["CLO2", "CLO2"], (form, rng, difficulty) => {
    const n = power[difficulty], a = rng.int(2, 4 + n), b = rng.int(2, 4 + n), c = rng.int(2, 4 + n);
    if (form === 0) {
      const k = rng.int(1, 2 + n);
      return numberProblem("Use a triple integral to find the volume enclosed by these six planes.",
        tex`x=0,\ x=${a},\ y=0,\ y=${b},\ z=0,\ z=${c}+${k}x+y`,
        `x runs from zero to ${a}, y from zero to ${b}, and z from zero to the plane ${c} plus ${k} x plus y.`, fraction(a * b * (2 * c + k * a + b), 2),
        ["Use a vertical segment between the floor and the sloping plane.", "Project the solid onto the xy-plane to obtain the remaining bounds."],
        [tex`V=\int_0^{${a}}\int_0^{${b}}\int_0^{${c}+${k}x+y}1\,dz\,dy\,dx`,
          tex`V=\int_0^{${a}}\left(${b}(${c}+${k}x)+${fraction(b ** 2, 2)}\right)dx`]);
    }
    return numberProblem("Find the mass of this first-octant tetrahedron with the given volume density.",
      tex`x/${a}+y/${b}+z/${c}\le 1,\quad \rho(x,y,z)=z^{${n}}`,
      `In the first octant, x over ${a} plus y over ${b} plus z over ${c} is at most one. Density is z to the power ${n}.`,
      fraction(a * b * c ** (n + 1), (n + 1) * (n + 2) * (n + 3)),
      ["At a fixed height the cross-section is a right triangle.", "Both horizontal intercepts shrink by the same factor as z increases."],
      [tex`A(z)=\frac{${a * b}}{2}(1-z/${c})^2`, tex`M=\iiint_T z^{${n}}\,dV=\int_0^{${c}}z^{${n}}A(z)\,dz`,
        tex`M=${fraction(a * b * c ** (n + 1), 2)}\left(\frac1{${n + 1}}-\frac2{${n + 2}}+\frac1{${n + 3}}\right)`]);
  }),
  calc_cylindrical_integrals: topic(5, "Triple integrals in cylindrical coordinates", ["cylinder_mass", "paraboloid_volume"], ["CLO2", "CLO2"], (form, rng, difficulty) => {
    const n = power[difficulty], a = rng.int(2, 4 + n), k = rng.int(2, 3 + n);
    if (form === 0) {
      const h = rng.int(2, 4 + n);
      return numberProblem("Find the cylinder’s mass in kilograms from its volume density. Coordinates are in metres and density is in kilograms per cubic metre.",
        tex`x^2+y^2\le ${a ** 2},\quad 0\le z\le ${h},\quad \rho(x,y,z)=${k}(x^2+y^2)z^{${n}}`,
        `A solid cylinder has radius ${a} and height ${h}. Density is ${k} times the sum of x squared and y squared, multiplied by z to the power ${n}.`,
        piMultiple(k * a ** 4 * h ** (n + 1), 2 * (n + 1)),
        ["Use the circular symmetry of the region and density.", "Include the cylindrical volume factor r before integrating."],
        [tex`\rho=${k}r^2z^{${n}},\quad dV=r\,dz\,dr\,d\theta`,
          tex`M=\int_0^{2\pi}\int_0^{${a}}\int_0^{${h}}${k}r^3z^{${n}}\,dz\,dr\,d\theta`,
          tex`M=2\pi\cdot${k}\cdot\frac{${a}^4}{4}\cdot\frac{${h}^{${n + 1}}}{${n + 1}}`], "The density varies throughout the cylinder. Integrating it over the volume gives the mass in kilograms.");
    }
    const h = k * a ** 2;
    return numberProblem("Find the volume trapped between the paraboloid and the horizontal plane.",
      tex`z=${k}(x^2+y^2),\quad z=${h}`, `The lower boundary is z equals ${k} times the sum of x squared and y squared. The upper boundary is z equals ${h}.`,
      piMultiple(k * a ** 4, 2), ["Intersect the two surfaces to find the outer radius.", "Use the height of a vertical slice together with the cylindrical volume element."],
      [tex`${k}r^2=${h}\Rightarrow r=${a}`, tex`V=\int_0^{2\pi}\int_0^{${a}}\int_{${k}r^2}^{${h}} r\,dz\,dr\,d\theta`,
        tex`V=2\pi\int_0^{${a}}(${h}-${k}r^2)r\,dr`]);
  }),
  calc_spherical_integrals: topic(5, "Triple integrals in spherical coordinates", ["spherical_shell", "cone_in_ball"], ["CLO2", "CLO2"], (form, rng, difficulty) => {
    const n = power[difficulty], a = rng.int(1, 3 + n), b = a + rng.int(1, 3), k = rng.int(2, 4 + n);
    if (form === 0) {
      return numberProblem("Evaluate the triple integral over the spherical shell.",
        tex`${a ** 2}\le x^2+y^2+z^2\le ${b ** 2},\quad\iiint_E ${k}(x^2+y^2+z^2)^{${n}}\,dV`,
        `The shell has inner radius ${a} and outer radius ${b}. Integrate ${k} times the quantity (x squared plus y squared plus z squared) raised to the power ${n}.`,
        piMultiple(4 * k * (b ** (2 * n + 3) - a ** (2 * n + 3)), 2 * n + 3),
        ["Use the distance from the origin as the radial coordinate.", "For a full spherical shell the angular integral of sin φ equals 4π."],
        [tex`dV=\rho^2\sin\phi\,d\rho\,d\phi\,d\theta`,
          tex`I=\int_0^{2\pi}\int_0^\pi\int_{${a}}^{${b}}${k}\rho^{${2 * n + 2}}\sin\phi\,d\rho\,d\phi\,d\theta`,
          tex`I=4\pi\cdot ${k}\int_{${a}}^{${b}}\rho^{${2 * n + 2}}\,d\rho`]);
    }
    const [vertical, horizontal, slant] = rng.pick([[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13]] as const);
    return numberProblem("Use spherical coordinates to find the volume inside the ball and above the cone.",
      tex`x^2+y^2+z^2\le ${b ** 2},\quad z\ge \frac{${vertical}}{${horizontal}}\sqrt{x^2+y^2}`,
      `The ball has radius ${b}. The cone requires z at least ${vertical} over ${horizontal} times the horizontal radius.`,
      piMultiple(2 * b ** 3 * (slant - vertical), 3 * slant),
      ["Measure φ down from the positive z-axis.", "A right triangle through the cone gives the cosine of its half-angle."],
      [tex`\tan\phi_0=${fraction(horizontal, vertical)},\quad \cos\phi_0=${fraction(vertical, slant)}`,
        tex`V=\int_0^{2\pi}\int_0^{\phi_0}\int_0^{${b}}\rho^2\sin\phi\,d\rho\,d\phi\,d\theta`,
        tex`V=2\pi\frac{${b}^3}{3}(1-\cos\phi_0)`]);
  }),
  calc_change_variables: topic(5, "Change of variables in multiple integrals", ["area_jacobian", "transformed_integral"], ["CLO1", "CLO2"], (form, rng, difficulty) => {
    const n = power[difficulty], a = rng.int(2, 4 + n), b = rng.int(1, 3 + n), k = rng.int(1, 3 + n);
    if (form === 0) {
      return numberProblem("A small rectangle in the uv-plane maps to a parallelogram in the xy-plane. By what positive factor does its area change?", tex`x=${a}u+v,\quad y=u-${b}v`,
        `x equals ${a} u plus v, and y equals u minus ${b} v.`, `${a * b + 1}`,
        ["Use the columns of the derivative matrix as the two image directions.", "Area uses the absolute value of the signed determinant."],
        [tex`\frac{\partial(x,y)}{\partial(u,v)}=\begin{vmatrix}${a}&1\\1&-${b}\end{vmatrix}=-${a * b + 1}`,
          tex`dA=\left|-${a * b + 1}\right|\,du\,dv`]);
    }
    return numberProblem("Use the given transformation to evaluate the integral over the parallelogram.",
      tex`u=x+${k}y,\ v=x-${k}y,\quad 0\le u\le ${a},\ 0\le v\le ${b},\quad\iint_D (x+${k}y)^{${n}}(x-${k}y)\,dA`,
      `Let u be x plus ${k} y and v be x minus ${k} y. u runs from zero to ${a} and v from zero to ${b}. Integrate u to the power ${n} times v over xy area.`,
      fraction(a ** (n + 1) * b ** 2, 4 * k * (n + 1)),
      ["The Jacobian of (u, v) with respect to (x, y) is the reciprocal of the one needed in dA.", "In the transformed rectangle the two powers integrate separately."],
      [tex`\frac{\partial(u,v)}{\partial(x,y)}=-${2 * k},\quad dA=\frac1{${2 * k}}\,du\,dv`,
        tex`I=\frac{1}{${2 * k}}\int_0^{${a}}u^{${n}}\,du\int_0^{${b}}v\,dv`]);
  })
} as const;
