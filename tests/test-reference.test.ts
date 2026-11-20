import { describe, expect, it } from "vitest";
import { referenceFor, type ReferenceLaw } from "../src/math/testReference";

// Independent fixtures from R's pnorm, pt, pchisq and pf, in lower-tail order.
const fixtures: [ReferenceLaw, number, number][] = [
  [{ family: "normal" }, -3.125, 0.00088902529910843181],
  [{ family: "normal" }, -1.96, 0.024997895148220428],
  [{ family: "normal" }, 0.75, 0.77337264762313174],
  [{ family: "t", df: 3 }, -2.37, 0.049251990885139367],
  [{ family: "t", df: 4 }, 1.125, 0.8382366119126705],
  [{ family: "t", df: 19 }, 3.25, 0.9978931400985144],
  [{ family: "t", df: 30 }, -0.425, 0.33693481503740008],
  [{ family: "chi_square", df: 1 }, 0.85, 0.64344766223273964],
  [{ family: "chi_square", df: 6 }, 8.25, 0.77964610893476993],
  [{ family: "chi_square", df: 15 }, 17.375, 0.70305454060446715],
  [{ family: "chi_square", df: 20 }, 24.5, 0.77876697671169948],
  [{ family: "f", df1: 3, df2: 6 }, 0.45, 0.27346113074848555],
  [{ family: "f", df1: 4, df2: 7 }, 1.35, 0.6588150275313831],
  [{ family: "f", df1: 13, df2: 19 }, 2.75, 0.9777495978712557],
  [{ family: "f", df1: 16, df2: 20 }, 0.77, 0.30072155240980586]
];

describe("paper reference tables", () => {
  it.each(fixtures)("matches the independently tabulated area for %j at %s", (law, statistic, expected) => {
    const { lower, table } = referenceFor(law, statistic);
    expect(lower).toBeCloseTo(expected, 13);
    expect(table.rows).toContainEqual([String(statistic), expected.toFixed(9)]);
    const xs = table.rows.map(row => Number(row[0]));
    const areas = table.rows.map(row => Number(row[1]));
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
    expect(areas[0]).toBeLessThanOrEqual(areas[1]);
    expect(areas[1]).toBeLessThanOrEqual(areas[2]);
  });

  it("respects the lower endpoint and the reciprocal F-law identity", () => {
    expect(referenceFor({ family: "chi_square", df: 4 }, 0).lower).toBe(0);
    expect(referenceFor({ family: "t", df: 7 }, 0).lower).toBe(0.5);
    const left = referenceFor({ family: "f", df1: 7, df2: 12 }, 0.41);
    const right = referenceFor({ family: "f", df1: 12, df2: 7 }, 1 / 0.41);
    expect(left.lower + right.lower).toBeCloseTo(1, 13);
  });
});
