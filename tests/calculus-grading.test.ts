import { expect, it } from "vitest";
import { generateQuestion } from "../src/math/generators";
import { validateAnswer } from "../src/math/validator";

const plane = generateQuestion("calc_lines_planes", 1, "medium");
const trace = generateQuestion("calc_parametric_curves", 1, "easy");
const taylor = generateQuestion("calc_taylor_series", 1, "medium");

it("compares equation coefficients and intercepts exactly, including long decimals", () => {
  expect(validateAnswer(plane, "x+y-0.4z=-4").correct).toBe(true);
  expect(validateAnswer(plane, "5x+5y-2z=-20.00000000000000000001").correct).toBe(false);
  expect(validateAnswer(trace, "y=3x^2-6x+3.000000000000000000000001").correct).toBe(false);
});

it("compares interval endpoints, tuple components and polynomial coefficients exactly", () => {
  const interval = generateQuestion("calc_power_series", 1, "medium");
  const pair = generateQuestion("calc_parametric_curves", 2, "medium");
  expect(validateAnswer(interval, "[-4.000,6.0]").correct).toBe(true);
  expect(validateAnswer(interval, "[-4,6.00000000000000000001]").correct).toBe(false);
  expect(validateAnswer(pair, "(0,16.00000000000000000001)").correct).toBe(false);
  expect(validateAnswer(taylor, "15x^2-15x+5.00000000000000000001").correct).toBe(false);
});

it("preserves points of the trace and the domain of a Taylor polynomial", () => {
  expect(validateAnswer(trace, "y=3(x-1)^3/(x-1)").correct).toBe(false);
  expect(validateAnswer(trace, "y=3(x-1)^3(x-1)^{-1}").correct).toBe(false);
  expect(validateAnswer(taylor, "(5(3x^2-3x+1)(x-1))/(x-1)").correct).toBe(false);
  expect(validateAnswer(taylor, "(30x^2-30x+10)/2").correct).toBe(true);
  expect(validateAnswer(taylor, "5(3x^2-3x+1)(1+x^2)/(1+x^2)").correct).toBe(true);
});

it("recognizes powers of an implicit equation while retaining factors that can vanish", () => {
  for (const value of ["(y-3(x-1)^2)^2=0", "0=(2y-6(x-1)^2)^3", "(1+x^2)(y-3(x-1)^2)=0", "(y-3(x-1)^2)/(1+x^2)=0"]) {
    expect(validateAnswer(trace, value).correct, value).toBe(true);
  }
  for (const value of ["x(y-3(x-1)^2)=0", "(y-3(x-1)^2)^2=1", "(y-3(x-1)^2)^{-1}=0"]) {
    expect(validateAnswer(trace, value).correct, value).toBe(false);
  }
});

it("requires the result of a calculus operation even inside an otherwise correct expression", () => {
  const number = { ...trace, answer: { kind: "number" as const, latex: "2" } };
  for (const entered of ["\\int_0^2 x\\,dx", "1+\\int_0^1 2x\\,dx", "\\lim_{x\\to2}x", "\\sum_{n=1}^2 1"]) {
    expect(validateAnswer(number, entered)).toMatchObject({ parseable: true, correct: false,
      retryEligible: true, feedback: expect.stringContaining("evaluated result") });
  }
  const derivative = { ...trace, answer: { kind: "expression" as const, latex: "2x" } };
  expect(validateAnswer(derivative, "\\frac{d}{dx}x^2").correct).toBe(false);
  expect(validateAnswer(derivative, "\\frac{\\partial}{\\partial x}x^2").correct).toBe(false);
  expect(validateAnswer(number, "8/4").correct).toBe(true);
});

it("preserves scientific notation and exact recurring decimals", () => {
  const value = (expected: string, entered: string) =>
    validateAnswer({ ...trace, answer: { kind: "number", latex: expected } }, entered).correct;
  expect(value("1250", "1.25e3")).toBe(true);
  expect(value("1/8", "1.25E-1")).toBe(true);
  expect(value("1/6", "0.1\\overline{6}")).toBe(true);
  expect(value("1/6", "0.1(6)")).toBe(true);
  expect(value("1/6", "0.1\\left(6\\right)")).toBe(true);
});
