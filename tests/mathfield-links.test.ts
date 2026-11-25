import { afterEach, expect, it, vi } from "vitest";
import { MathfieldElement } from "mathlive";
import "../src/components/MathField";

vi.mock("mathlive", () => ({
  MathfieldElement: { openUrl: vi.fn() }
}));

afterEach(() => vi.restoreAllMocks());

it("opens math links in a tab without an opener", () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const url = new URL("https://example.com/");

  MathfieldElement.openUrl(url.href);

  expect(open).toHaveBeenCalledWith(url, "_blank", "noopener");
});

it("ignores malformed URLs and unsupported protocols", () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);

  MathfieldElement.openUrl("not a URL");
  MathfieldElement.openUrl("mailto:math@example.com");

  expect(open).not.toHaveBeenCalled();
});
