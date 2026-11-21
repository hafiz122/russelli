import { ComputeEngine, isFunction, isNumber, type BoxedExpression } from "@cortex-js/compute-engine";
import { statisticsSkillIds } from "../data/skills";
import type { AnswerSpec, Question, ValidationResult } from "../types";
import { distributionLatex, readDistribution } from "./distributions";
import { formatPValue, readTestAnswer } from "./testAnswers";

const ce = new ComputeEngine();

function compact(value: string): string {
  return value
    .replace(/\\left|\\right/g, "")
    .replace(/\\,/g, "")
    .replace(/\\cdot/g, "")
    .replace(/\s+/g, "")
    .replace(/[{}]/g, "");
}

function parse(value: string, canonical = true, parseNumbers: "auto" | "rational" = "auto"): BoxedExpression | null {
  try {
    const expression = ce.parse(value, { form: canonical ? "canonical" : "structural", parseNumbers });
    if (!expression?.isValid || expression.has("Error")) return null;
    return expression;
  } catch {
    return null;
  }
}

function splitTuple(value: string, size = 2): string[] | null {
  const cleaned = value
    .replace(/\\left|\\right/g, "")
    .trim();
  const opener = cleaned[0];
  const closer = cleaned.at(-1);
  const hasOpen = opener === "(" || opener === "[";
  const hasClose = closer === ")" || closer === "]";
  if (hasOpen !== hasClose || (hasOpen && !(
    (opener === "(" && closer === ")") || (opener === "[" && closer === "]")
  ))) return null;
  const body = hasOpen ? cleaned.slice(1, -1) : cleaned;
  let depth = 0;
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === "{" || character === "(" || character === "[") depth += 1;
    if (character === "}" || character === ")" || character === "]") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(body.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(body.slice(start));
  return parts.length === size && parts.every((part) => part.trim()) ? parts : null;
}

function parseMatrix(value: string): BoxedExpression[][] | null {
  const expression = parse(value);
  if (!expression || !isFunction(expression) || expression.operator !== "Matrix") return null;
  const entries = expression.ops[0];
  if (!isFunction(entries) || entries.operator !== "List" || entries.ops.length === 0) return null;
  const rows = entries.ops.map((row) => isFunction(row) && row.operator === "List" ? row.ops : null);
  if (rows.some((row) => row === null || row.length === 0 || row.length !== rows[0]?.length)) return null;
  return rows as BoxedExpression[][];
}

function equalMatrices(actual: BoxedExpression[][], expected: BoxedExpression[][]): boolean {
  return actual.length === expected.length && actual[0].length === expected[0].length &&
    actual.every((row, i) => row.every((entry, j) => equalExpressions(entry.latex, expected[i][j].latex)));
}

function equalVectorDirections(actual: string[], expected: string[]): boolean {
  if (actual.some((component) => {
    const parsed = parse(component)!;
    const value = parsed.N();
    return parsed.freeVariables.length > 0 || !isNumber(value) || !Number.isFinite(value.re) || value.im !== 0;
  })) return false;
  if (actual.every((component) => equalExpressions(component, "0"))) return false;
  const left = ce.box(["Multiply", parse(actual[0])!, parse(expected[1])!]);
  const right = ce.box(["Multiply", parse(actual[1])!, parse(expected[0])!]);
  return ce.box(["Subtract", left, right]).simplify().isSame(ce.number(0));
}

function equalExpressions(actual: string, expected: string): boolean {
  const actualExpression = parse(actual);
  const expectedExpression = parse(expected);
  if (!actualExpression || !expectedExpression) return false;
  return (
    actualExpression.isSame(expectedExpression) ||
    actualExpression.is(expectedExpression) ||
    actualExpression.isIdenticallyEqual(expectedExpression) === true
  );
}

function equalExactExpressions(actual: string, expected: string, valueSymbol?: string): boolean {
  const left = parseExactValue(actual, valueSymbol);
  const right = parseExactValue(expected);
  if (!left || !right) return false;
  if (left.isSame(right)) return true;
  if (right.freeVariables.length === 0) return false;
  return left.isIdenticallyEqual(right) === true;
}

function equalTransformation(actual: string, answer: AnswerSpec): boolean {
  if (actual === answer.latex) return true;
  const matches = (candidates: string[], simplify: (value: BoxedExpression) => BoxedExpression) => {
    const submitted = parse(actual, true, "rational");
    if (!submitted) return false;
    const left = simplify(submitted);
    return candidates.some((latex) => {
      const candidate = parse(latex, true, "rational");
      if (!candidate) return false;
      const right = simplify(candidate);
      return left.isSame(right) || ce.box(["Subtract", left, right]).simplify().isSame(ce.number(0));
    });
  };
  if (matches([answer.latex, ...(answer.equivalentLatex ?? [])], (value) => value.simplify())) return true;
  if (!answer.interiorSupport) return false;
  ce.pushScope();
  try {
    ce.assume(ce.box(["Greater", "y", answer.interiorSupport.lower]));
    ce.assume(ce.box(["Less", "y", answer.interiorSupport.upper]));
    return matches([answer.latex], (value) => value.map((term) => {
      if (isFunction(term) && term.operator === "Abs") {
        const argument = term.ops[0];
        if (argument.isNonNegative) return argument;
        if (argument.isNonPositive) return argument.neg();
      }
      return term.operator === "Sqrt" ? term.simplify() : term;
    }).simplify());
  } finally {
    ce.popScope();
  }
}

function parseExactValue(latex: string, valueSymbol?: string): BoxedExpression | undefined {
  // The engine constructs decimal denominators with a machine power of ten.
  // From 10^23 onward, that can change the fraction before it is compared.
  const value = latex.replace(/(\d*)\.(\d{23,})/g, (_, whole: string, decimals: string) =>
    `\\frac{${whole}${decimals}}{10^{${decimals.length}}}`
  );
  const expression = parse(value, true, "rational");
  if (valueSymbol && expression && isFunction(expression) && expression.operator === "Equal") {
    if (expression.ops.length !== 2) return undefined;
    const [left, right] = expression.ops;
    if (left.json === valueSymbol) return right.evaluate();
    if (right.json === valueSymbol) return left.evaluate();
    return undefined;
  }
  return expression?.evaluate();
}

function parseTestResult(latex: string) {
  const answer = readTestAnswer(latex);
  if (!answer?.decision || !answer.pValue.trim() || answer.pValue.includes("\\placeholder")) return null;
  const probability = parseExactValue(answer.pValue);
  if (!probability || probability.freeVariables.length) return null;
  const number = probability.N();
  if (!isNumber(number) || !Number.isFinite(number.re) || number.im !== 0 ||
      probability.isLess(0) !== false || probability.isGreater(1) !== false) return null;
  return { probability, decision: answer.decision };
}

function roundsToPValue(probability: BoxedExpression, reference: number): boolean {
  const tenThousandths = Number(formatPValue(reference).replace(".", ""));
  const lower = ce.box(["Rational", 2 * tenThousandths - 1, 20_000]);
  const upper = ce.box(["Rational", 2 * tenThousandths + 1, 20_000]);
  return probability.isLess(lower) === false && probability.isLess(upper) === true;
}

function equalEquations(actual: string, expected: string): boolean {
  const actualExpression = parse(actual);
  const expectedExpression = parse(expected);
  if (
    !actualExpression ||
    !expectedExpression ||
    expectedExpression.operator !== "Equal" ||
    !isFunction(expectedExpression)
  ) {
    return false;
  }

  if (actualExpression.operator !== "Equal" || !isFunction(actualExpression)) {
    const expectedRight = expectedExpression.ops[1];
    return actualExpression.isIdenticallyEqual(expectedRight) === true || actualExpression.is(expectedRight);
  }

  const actualLeft = actualExpression.ops[0];
  const actualRight = actualExpression.ops[1];
  const expectedLeft = expectedExpression.ops[0];
  const expectedRight = expectedExpression.ops[1];

  if (actualLeft.isSame(expectedLeft)) {
    return actualRight.isIdenticallyEqual(expectedRight) === true || actualRight.is(expectedRight);
  }
  if (actualRight.isSame(expectedLeft)) {
    return actualLeft.isIdenticallyEqual(expectedRight) === true || actualLeft.is(expectedRight);
  }
  if (actualExpression.isSame(expectedExpression)) return true;

  const actualDifference = ce.box(["Subtract", actualLeft, actualRight]).simplify();
  const expectedDifference = ce.box(["Subtract", expectedLeft, expectedRight]).simplify();
  const variables = [...new Set([...actualDifference.freeVariables, ...expectedDifference.freeVariables])];
  for (let sample = 0; sample <= variables.length; sample += 1) {
    const substitution = Object.fromEntries(variables.map((variable, index) => [variable, index === sample - 1 ? 1 : 0]));
    const denominator = expectedDifference.subs(substitution).simplify();
    const numericDenominator = denominator.N();
    if (!isNumber(numericDenominator) || numericDenominator.re === 0) continue;
    const ratio = ce.box(["Divide", actualDifference.subs(substitution), denominator]).simplify();
    const value = ratio.N();
    if (!isNumber(value) || !Number.isFinite(value.re) || value.re === 0) return false;
    const residual = ce.box(["Subtract", actualDifference, ce.box(["Multiply", ratio, expectedDifference])]).simplify();
    return residual.isSame(ce.number(0));
  }
  return false;
}

function polynomialDegree(expression: BoxedExpression): number | null {
  if (expression.freeVariables.length === 0) return 0;
  if (expression.json === "x") return 1;
  if (!isFunction(expression)) return null;
  const degrees = expression.ops.map(polynomialDegree);
  if (degrees.some((degree) => degree === null)) return null;
  const values = degrees as number[];
  switch (expression.operator) {
    case "Delimiter":
    case "Negate":
      return values[0];
    case "Add":
    case "Subtract":
      return Math.max(...values);
    case "Multiply":
    case "InvisibleOperator":
      return values.reduce((sum, degree) => sum + degree, 0);
    case "Divide":
      return values[1] === 0 ? values[0] : null;
    case "Power": {
      const exponent = expression.ops[1].N();
      return isNumber(exponent) && Number.isInteger(exponent.re) && exponent.re >= 0
        ? values[0] * exponent.re
        : null;
    }
    default:
      return null;
  }
}

function hasUncancelledPolynomialFactors(actual: string, expected: string): boolean {
  let raw = parse(actual, false);
  const target = parse(expected, false);
  while (raw && isFunction(raw) && raw.operator === "Delimiter" && raw.ops.length === 1) raw = raw.ops[0];
  if (!raw || !target || !isFunction(raw) || !isFunction(target) || raw.operator !== "Divide" || target.operator !== "Divide") return false;
  return raw.ops.some((operand, index) => {
    const actualDegree = polynomialDegree(operand);
    const expectedDegree = polynomialDegree(target.ops[index]);
    return actualDegree !== null && expectedDegree !== null && actualDegree > expectedDegree;
  });
}

interface ParsedInterval {
  leftDelimiter: "(" | "[";
  leftEndpoint: string;
  rightEndpoint: string;
  rightDelimiter: ")" | "]";
  normalized: string;
}

function makeInterval(
  leftDelimiter: ParsedInterval["leftDelimiter"],
  leftEndpoint: string,
  rightEndpoint: string,
  rightDelimiter: ParsedInterval["rightDelimiter"]
): ParsedInterval | null {
  const left = leftEndpoint === "-∞" ? "-∞" : parse(leftEndpoint)?.simplify().latex;
  const right = rightEndpoint === "∞" ? "∞" : parse(rightEndpoint)?.simplify().latex;
  if (!left || !right) return null;
  return {
    leftDelimiter,
    leftEndpoint: left,
    rightEndpoint: right,
    rightDelimiter,
    normalized: `${leftDelimiter}${left},${right}${rightDelimiter}`
  };
}

function parseInterval(value: string): ParsedInterval | null {
  const cleaned = value
    .replace(/\\left|\\right/g, "")
    .replace(/\\lbrack/g, "[")
    .replace(/\\rbrack/g, "]")
    .replace(/\\lparen/g, "(")
    .replace(/\\rparen/g, ")")
    .replace(/\\infty/g, "∞")
    .replace(/\\,/g, "")
    .replace(/\s+/g, "")
    .replace(/\+∞/g, "∞");
  const match = cleaned.match(/^([([])(.+),(.+)([)\]])$/);
  if (match) {
    return makeInterval(
      match[1] as ParsedInterval["leftDelimiter"],
      match[2],
      match[3],
      match[4] as ParsedInterval["rightDelimiter"]
    );
  }

  const relation = parse(value, false);
  if (!relation || !isFunction(relation) || relation.ops.length !== 2) return null;
  const [leftOperand, rightOperand] = relation.ops;
  const leftIsX = compact(leftOperand.latex) === "x";
  const rightIsX = compact(rightOperand.latex) === "x";
  if (leftIsX === rightIsX) return null;
  const boundary = (leftIsX ? rightOperand : leftOperand).simplify().latex;
  const operator = relation.operator;
  const lowerBounded = leftIsX ? operator === "Greater" || operator === "GreaterEqual" : operator === "Less" || operator === "LessEqual";
  const inclusive = operator === "GreaterEqual" || operator === "LessEqual";
  if (!["Greater", "GreaterEqual", "Less", "LessEqual"].includes(operator)) return null;
  return lowerBounded
    ? makeInterval(inclusive ? "[" : "(", boundary, "∞", ")")
    : makeInterval("(", "-∞", boundary, inclusive ? "]" : ")");
}

function equalIntervalEndpoints(actual: string, expected: string): boolean {
  if (actual === "-∞" || actual === "∞" || expected === "-∞" || expected === "∞") {
    return actual === expected;
  }
  return equalExpressions(actual, expected);
}

function equalIntervals(actual: ParsedInterval, expected: ParsedInterval): boolean {
  return (
    actual.leftDelimiter === expected.leftDelimiter &&
    actual.rightDelimiter === expected.rightDelimiter &&
    equalIntervalEndpoints(actual.leftEndpoint, expected.leftEndpoint) &&
    equalIntervalEndpoints(actual.rightEndpoint, expected.rightEndpoint)
  );
}

export function isParseableAnswer(question: Question, latex: string): boolean {
  if (!latex.trim()) return false;
  if (question.answer.kind === "hypothesis_test") return parseTestResult(latex) !== null;
  if (question.answer.kind === "distribution") {
    const law = readDistribution(latex);
    return Boolean(law && law.parameters.every((parameter) => {
      if (!parameter.trim() || parameter.includes("\\placeholder")) return false;
      const expression = parse(parameter);
      return expression && expression.isNumber !== false && expression.isFinite !== false;
    }));
  }
  if (["ordered_pair", "ordered_triple", "vector_direction"].includes(question.answer.kind)) {
    const tuple = splitTuple(latex, question.answer.kind === "ordered_triple" ? 3 : 2);
    return Boolean(tuple && tuple.every((component) => parse(component)));
  }
  if (question.answer.kind === "matrix") return parseMatrix(latex) !== null;
  if (question.answer.kind === "interval") return parseInterval(latex) !== null;
  return parse(latex) !== null;
}

export function validateAnswer(question: Question, latex: string): ValidationResult {
  if (question.answer.kind === "hypothesis_test") {
    const actual = parseTestResult(latex);
    if (!actual) {
      return { parseable: false, correct: false, normalizedAnswer: "", retryEligible: true,
        feedback: "Enter a p-value from 0 to 1 and choose a decision." };
    }
    const expected = question.answer.testResult;
    const correct = Boolean(expected && (actual.decision === "reject") === (expected.pValue <= expected.alpha) &&
      roundsToPValue(actual.probability, expected.pValue));
    return { parseable: true, correct, normalizedAnswer: latex, retryEligible: !correct,
      feedback: correct ? "Your p-value and decision are correct." : "Check the tail probability and compare it with the significance level." };
  }
  if (!isParseableAnswer(question, latex)) {
    return {
      parseable: false,
      correct: false,
      normalizedAnswer: "",
      feedback: "Check the answer format. The math field needs a complete expression.",
      retryEligible: true
    };
  }

  let correct = false;
  let normalizedAnswer = latex;

  if (question.answer.kind === "distribution") {
    const actual = readDistribution(latex)!;
    const expected = question.answer.distribution;
    correct = actual.family === expected?.family &&
      actual.parameters.every((parameter, index) => equalExactExpressions(parameter, expected.parameters[index]));
    normalizedAnswer = distributionLatex(actual.family, actual.parameters.map((parameter) => parse(parameter)!.simplify().latex));
  } else if (question.answer.kind === "ordered_pair" || question.answer.kind === "ordered_triple" || question.answer.kind === "vector_direction") {
    const size = question.answer.kind === "ordered_triple" ? 3 : 2;
    const actual = splitTuple(latex, size)!;
    const expected = splitTuple(question.answer.latex, size)!;
    correct = question.answer.kind === "vector_direction"
      ? equalVectorDirections(actual, expected)
      : actual.every((component, index) => equalExpressions(component, expected[index]));
    normalizedAnswer = `(${actual.map((component) => parse(component)!.simplify().latex).join(",")})`;
  } else if (question.answer.kind === "matrix") {
    const actual = parseMatrix(latex)!;
    const expected = parseMatrix(question.answer.latex)!;
    if (actual.length !== expected.length || actual[0].length !== expected[0].length) {
      return {
        parseable: true,
        correct: false,
        normalizedAnswer: latex,
        feedback: `Your answer is a ${actual.length} by ${actual[0].length} matrix. Enter a ${expected.length} by ${expected[0].length} matrix.`,
        retryEligible: true
      };
    }
    correct = equalMatrices(actual, expected);
    normalizedAnswer = latex;
  } else if (question.answer.kind === "interval") {
    const actualInterval = parseInterval(latex)!;
    const expectedInterval = parseInterval(question.answer.latex)!;
    normalizedAnswer = actualInterval.normalized;
    const closesInfinity =
      (actualInterval.leftEndpoint === "-∞" && actualInterval.leftDelimiter === "[") ||
      (actualInterval.rightEndpoint === "∞" && actualInterval.rightDelimiter === "]");
    if (closesInfinity) {
      return {
        parseable: true,
        correct: false,
        normalizedAnswer,
        feedback: "Infinity is never included. Use a parenthesis next to infinity.",
        retryEligible: true
      };
    }
    correct = equalIntervals(actualInterval, expectedInterval);
  } else if (question.answer.kind === "equation") {
    correct = equalEquations(latex, question.answer.latex);
    normalizedAnswer = parse(latex)!.latex;
  } else if (question.answer.kind === "expression" && question.skillId === "transformations") {
    correct = equalTransformation(latex, question.answer);
    normalizedAnswer = parse(latex, true, "rational")!.simplify().latex;
  } else {
    correct = question.answer.kind === "number" && statisticsSkillIds.includes(question.skillId)
      ? equalExactExpressions(latex, question.answer.latex, question.answer.valueSymbol)
      : equalExpressions(latex, question.answer.latex);
    normalizedAnswer = parse(latex)!.simplify().latex;
  }

  if (correct && question.answer.requiresFactoredForm) {
    const raw = parse(latex, false);
    correct = Boolean(
      (raw?.operator === "Multiply" || raw?.operator === "InvisibleOperator") &&
        isFunction(raw) &&
        polynomialDegree(raw) === 2 &&
        raw.ops.filter((operand) => operand.freeVariables.includes("x")).length >= 2
    );
    if (!correct) {
      return {
        parseable: true,
        correct: false,
        normalizedAnswer,
        feedback: "The expression is equivalent, but this question asks for factored form.",
        retryEligible: true
      };
    }
  }

  if (correct && question.answer.forbiddenFactorLatex) {
    const forbidden = compact(question.answer.forbiddenFactorLatex);
    if (compact(latex).includes(forbidden) || hasUncancelledPolynomialFactors(latex, question.answer.latex)) {
      return {
        parseable: true,
        correct: false,
        normalizedAnswer,
        feedback: "The value is equivalent, but the common factor still needs to be cancelled.",
        retryEligible: true
      };
    }
  }

  return {
    parseable: true,
    correct,
    normalizedAnswer,
    feedback: correct ? "Correct. Your final answer is equivalent." : "Not yet. Keep your work on paper and check the final expression.",
    retryEligible: !correct
  };
}

