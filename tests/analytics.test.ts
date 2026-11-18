// @vitest-environment-options {"url":"https://hafiz122.github.io/russelli/practice/?topic=functions#answer"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const measurementId = "G-TEST12345";
const environment = globalThis as unknown as { jsdom: { reconfigure: (options: { url: string }) => void } };

async function loadAnalytics() {
  vi.resetModules();
  return import("../src/analytics");
}

function googleScript(): HTMLScriptElement | null {
  return document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]');
}

function commands(): unknown[][] {
  const dataLayer = (window as Window & { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? [];
  return dataLayer.map((command) => Array.from(command));
}

beforeEach(() => {
  environment.jsdom.reconfigure({ url: "https://hafiz122.github.io/russelli/practice/?topic=functions#answer" });
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_GA4_MEASUREMENT_ID", measurementId);
  window.history.replaceState(null, "", "/russelli/practice/?topic=functions#answer");
  document.head.querySelectorAll("script").forEach((script) => script.remove());
  delete (window as Window & { dataLayer?: unknown }).dataLayer;
  delete (window as Window & { gtag?: unknown }).gtag;
  delete (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`];
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: "https://university.example/course/?student=private#grades"
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  document.cookie.split(";").forEach((cookie) => {
    document.cookie = `${cookie.split("=")[0].trim()}=; Max-Age=0; Path=/russelli/`;
  });
});

describe("optional Google Analytics", () => {
  it("does not load Google without an explicit saved or current allowance", async () => {
    const analytics = await loadAnalytics();
    expect(analytics.analyticsAvailable()).toBe(true);
    expect(analytics.readAnalyticsChoice()).toBe(null);
    analytics.applyAnalyticsChoice(null);
    expect(googleScript()).toBe(null);
    expect(commands()).toEqual([]);
    analytics.applyAnalyticsChoice("declined");
    expect(googleScript()).toBe(null);
    expect(commands()).toEqual([]);
  });

  it.each([
    "http://hafiz122.github.io/russelli/",
    "https://other.example/russelli/",
    "https://hafiz122.github.io/russelli-other/",
    "https://hafiz122.github.io/"
  ])("does not track outside its production site: %s", async (url) => {
    environment.jsdom.reconfigure({ url });
    const analytics = await loadAnalytics();
    expect(analytics.analyticsAvailable()).toBe(false);
    analytics.applyAnalyticsChoice("allowed");
    expect(googleScript()).toBe(null);
  });

  it.each(["", "G-", "G-TEST<script>", "UA-1234567"])("does not load an invalid measurement ID: %s", async (id) => {
    vi.stubEnv("VITE_GA4_MEASUREMENT_ID", id);
    const analytics = await loadAnalytics();
    expect(analytics.analyticsAvailable()).toBe(false);
    analytics.applyAnalyticsChoice("allowed");
    expect(googleScript()).toBe(null);
  });

  it("does not track development builds even on the production hostname", async () => {
    vi.stubEnv("PROD", false);
    const analytics = await loadAnalytics();
    expect(analytics.analyticsAvailable()).toBe(false);
    analytics.applyAnalyticsChoice("allowed");
    expect(googleScript()).toBe(null);
  });

  it("persists an explicit choice separately from the practice record", async () => {
    const analytics = await loadAnalytics();
    window.localStorage.setItem("russelli.progress.v1", '{"rawLatex":"private answer"}');
    expect(analytics.saveAnalyticsChoice("allowed")).toBe(true);
    expect(analytics.readAnalyticsChoice()).toBe("allowed");
    expect(analytics.saveAnalyticsChoice("declined")).toBe(true);
    expect(analytics.readAnalyticsChoice()).toBe("declined");
    expect(window.localStorage.getItem("russelli.progress.v1")).toBe('{"rawLatex":"private answer"}');
  });

  it("treats corrupt or unreadable preferences as unchosen", async () => {
    const analytics = await loadAnalytics();
    window.localStorage.setItem(analytics.ANALYTICS_CHOICE_KEY, "true");
    expect(analytics.readAnalyticsChoice()).toBe(null);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(analytics.readAnalyticsChoice()).toBe(null);
    expect(googleScript()).toBe(null);
  });

  it("reports when a choice cannot be saved without changing practice data", async () => {
    const analytics = await loadAnalytics();
    window.localStorage.setItem(analytics.ANALYTICS_CHOICE_KEY, "allowed");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    expect(analytics.saveAnalyticsChoice("declined")).toBe(false);
    expect(analytics.readAnalyticsChoice()).toBe(null);
    expect(googleScript()).toBe(null);
  });

  it("keeps practice usable if the browser blocks cookie access", async () => {
    const analytics = await loadAnalytics();
    vi.spyOn(document, "cookie", "get").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => analytics.applyAnalyticsChoice("declined")).not.toThrow();
    expect(googleScript()).toBe(null);
  });

  it("loads one async Google tag only after allowance and sends no learner data", async () => {
    const analytics = await loadAnalytics();
    window.localStorage.setItem("russelli.progress.v1", '{"rawLatex":"private answer","totalPoints":50}');
    analytics.applyAnalyticsChoice("allowed");
    analytics.applyAnalyticsChoice("allowed");
    const script = googleScript();
    expect(script).not.toBe(null);
    expect(script!.async).toBe(true);
    expect(script!.referrerPolicy).toBe("no-referrer");
    expect(script!.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
    expect(document.querySelectorAll('script[src*="googletagmanager.com"]')).toHaveLength(1);
    expect(commands()).toEqual([]);

    script!.dispatchEvent(new Event("load"));
    analytics.applyAnalyticsChoice("allowed");
    const configurations = commands().filter(([command]) => command === "config");
    expect(configurations).toHaveLength(1);
    expect(configurations[0]).toEqual(["config", measurementId, expect.objectContaining({
      page_location: "https://hafiz122.github.io/russelli/practice/",
      page_referrer: "https://university.example/course/",
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: "none",
      cookie_path: "/russelli/",
      cookie_prefix: "russelli",
      send_page_view: true
    })]);
    expect(commands().slice(0, 2)).toEqual([
      ["consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }],
      ["consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }]
    ]);
    expect(JSON.stringify(commands())).not.toMatch(/private answer|rawLatex|totalPoints/);
  });

  it("does not configure a tag if consent is withdrawn while it loads", async () => {
    const analytics = await loadAnalytics();
    analytics.applyAnalyticsChoice("allowed");
    const script = googleScript()!;
    expect(script).not.toBe(null);
    const delayedLoad = script.onload!;
    analytics.applyAnalyticsChoice("declined");
    delayedLoad.call(script, new Event("load"));
    expect(commands()).toEqual([]);
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]).toBe(true);
  });

  it("disables an active tag and clears only this site's analytics cookies on withdrawal", async () => {
    const analytics = await loadAnalytics();
    analytics.applyAnalyticsChoice("allowed");
    googleScript()!.dispatchEvent(new Event("load"));
    document.cookie = "russelli_ga=identifier; Path=/russelli/";
    document.cookie = "russelli_ga_TEST12345=session; Path=/russelli/";
    document.cookie = "unrelated=value; Path=/russelli/";
    analytics.applyAnalyticsChoice("declined");
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]).toBe(true);
    expect(document.cookie).not.toContain("russelli_ga");
    expect(document.cookie).toContain("unrelated=value");
    analytics.applyAnalyticsChoice("allowed");
    expect(commands().filter(([command]) => command === "config")).toHaveLength(1);
  });

  it("can retry loading after the tag is blocked or fails", async () => {
    const analytics = await loadAnalytics();
    analytics.applyAnalyticsChoice("allowed");
    const failedScript = googleScript()!;
    expect(failedScript).not.toBe(null);
    failedScript.dispatchEvent(new Event("error"));
    expect(commands()).toEqual([]);
    analytics.applyAnalyticsChoice("allowed");
    const retry = googleScript();
    expect(retry).not.toBe(failedScript);
    retry!.dispatchEvent(new Event("load"));
    expect(commands().filter(([command]) => command === "config")).toHaveLength(1);
  });
});
