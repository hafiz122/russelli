import { describe, expect, it } from "vitest";
import { statisticsFoundationGenerators } from "../src/math/statisticsFoundations";

const generator = statisticsFoundationGenerators.transformations;
const density = generator.generate(39, "hard");
const tex = String.raw;

describe("grading probability transformations on their stated support", () => {
  it("accepts a decreasing transform's density with the absolute Jacobian or its simplified magnitude", () => {
    expect(density.promptLatex).toContain("Y=8-5X^{2}");
    for (const answer of [
      tex`4\left(\sqrt{\frac{8-y}{5}}\right)^3\left|-\frac{1}{10\sqrt{\frac{8-y}{5}}}\right|`,
      tex`\frac{4\left(\sqrt{\frac{8-y}{5}}\right)^3}{10\left|\sqrt{\frac{8-y}{5}}\right|}`,
      tex`\frac{2}{5}\left|\frac{y-8}{5}\right|`,
      tex`\frac{2}{25}\left|8-y\right|`
    ]) {
      expect(generator.validate(density, answer), answer).toMatchObject({ parseable: true, correct: true });
    }
  });

  it("rejects a wrong sign, a missing Jacobian, and an inexact coefficient", () => {
    for (const answer of [
      tex`-\frac{2}{5}\left|\frac{y-8}{5}\right|`,
      tex`4\left(\sqrt{\frac{8-y}{5}}\right)^3`,
      tex`\frac{3}{5}\left|\frac{y-8}{5}\right|`,
      tex`\frac{16-2y}{25}+10^{-14}`
    ]) {
      expect(generator.validate(density, answer), answer).toMatchObject({ parseable: true, correct: false });
    }
  });

  it("accepts an expanded CDF and distinguishes a different polynomial", () => {
    const cdf = generator.generate(2, "medium");
    expect(cdf.promptLatex).toContain("Y=2+3X");
    expect(generator.validate(cdf, tex`\frac{y^3-6y^2+12y-8}{27}`).correct).toBe(true);
    expect(generator.validate(cdf, tex`\frac{y^3-6y^2+12y}{27}`).correct).toBe(false);
  });
});
