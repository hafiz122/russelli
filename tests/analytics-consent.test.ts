// @vitest-environment-options {"url":"https://hafiz122.github.io/russelli/"}
import { createElement, Fragment, StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const measurementId = "G-TEST12345";

async function renderConsent() {
  vi.resetModules();
  const { AnalyticsConsent, useAnalyticsConsent } = await import("../src/components/AnalyticsConsent");
  const analytics = await import("../src/analytics");
  function Harness() {
    const consent = useAnalyticsConsent();
    return createElement(Fragment, null,
      createElement(AnalyticsConsent, { consent, privacyHref: "/russelli/privacy/" }),
      createElement("main", { id: "main-content", tabIndex: -1 }, "Practice remains available"),
      consent.available && createElement("button", {
        ref: consent.settingsButtonRef,
        type: "button",
        onClick: consent.openSettings,
        "aria-expanded": consent.isOpen
      }, "Analytics settings")
    );
  }
  render(createElement(StrictMode, null, createElement(Harness)));
  return analytics;
}

function googleScript(): HTMLScriptElement | null {
  return document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]');
}

beforeEach(() => {
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_GA4_MEASUREMENT_ID", measurementId);
  document.head.querySelectorAll("script").forEach((script) => script.remove());
  delete (window as Window & { dataLayer?: unknown }).dataLayer;
  delete (window as Window & { gtag?: unknown }).gtag;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("analytics preferences", () => {
  it("offers equal explicit choices without loading Google or taking initial focus", async () => {
    const analytics = await renderConsent();
    expect(screen.getByRole("button", { name: "Allow analytics" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline analytics" })).toBeTruthy();
    const note = screen.getByRole("complementary", { name: "Optional site analytics" });
    expect(note.contains(document.activeElement)).toBe(false);
    expect(screen.getByRole("link", { name: "Privacy details" }).getAttribute("href")).toBe("/russelli/privacy/");
    expect(googleScript()).toBe(null);
    fireEvent.click(screen.getByRole("button", { name: "Decline analytics" }));
    expect(analytics.readAnalyticsChoice()).toBe("declined");
    expect(screen.queryByRole("complementary", { name: "Optional site analytics" })).toBe(null);
    expect(googleScript()).toBe(null);
    expect(document.activeElement).toBe(document.getElementById("main-content"));
  });

  it("allows a saved choice to be reopened and left unchanged with keyboard focus preserved", async () => {
    await renderConsent();
    fireEvent.click(screen.getByRole("button", { name: "Decline analytics" }));
    const settings = screen.getByRole("button", { name: "Analytics settings" });
    fireEvent.click(settings);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("complementary", { name: "Optional site analytics" })));
    fireEvent(window, new Event("focus"));
    fireEvent(window, new Event("pageshow"));
    expect(document.activeElement).toBe(screen.getByRole("complementary", { name: "Optional site analytics" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep current choice" }));
    expect(document.activeElement).toBe(settings);
    expect(googleScript()).toBe(null);
  });

  it("starts one tag after an allowed choice despite StrictMode effects", async () => {
    const analytics = await renderConsent();
    fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
    expect(analytics.readAnalyticsChoice()).toBe("allowed");
    expect(document.querySelectorAll('script[src*="googletagmanager.com"]')).toHaveLength(1);
    expect(screen.queryByRole("complementary", { name: "Optional site analytics" })).toBe(null);
  });

  it("does not load Google when an allowance cannot be saved", async () => {
    await renderConsent();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
    expect(googleScript()).toBe(null);
    expect(screen.getByRole("status").textContent).toMatch(/Analytics stays off/);
    expect(screen.getByText("Practice remains available")).toBeTruthy();
  });

  it("keeps a failed withdrawal off despite stale saved allowance and later synchronization", async () => {
    const analytics = await renderConsent();
    fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
    googleScript()!.dispatchEvent(new Event("load"));
    fireEvent.click(screen.getByRole("button", { name: "Analytics settings" }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    fireEvent.click(screen.getByRole("button", { name: "Decline analytics" }));
    expect(analytics.readAnalyticsChoice()).toBe("allowed");
    fireEvent(window, new Event("focus"));
    fireEvent(window, new Event("pageshow"));
    fireEvent(window, new StorageEvent("storage", { key: analytics.ANALYTICS_CHOICE_KEY }));
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]).toBe(true);
    const queue = ((window as Window & { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((command) => Array.from(command));
    expect(queue.filter(([command, operation, value]) => command === "consent" && operation === "update" &&
      (value as Record<string, string>).analytics_storage === "granted")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toMatch(/Analytics stays off/);
  });

  it("withdraws allowance when another tab changes or clears the preference", async () => {
    const analytics = await renderConsent();
    fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
    const pending = googleScript()!;
    const delayedLoad = pending.onload!;
    analytics.saveAnalyticsChoice("declined");
    fireEvent(window, new StorageEvent("storage", { key: analytics.ANALYTICS_CHOICE_KEY }));
    delayedLoad.call(pending, new Event("load"));
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]).toBe(true);
    expect((window as Window & { dataLayer?: unknown[] }).dataLayer).toEqual([]);
    window.localStorage.removeItem(analytics.ANALYTICS_CHOICE_KEY);
    fireEvent(window, new StorageEvent("storage", { key: null }));
    expect(screen.getByRole("button", { name: "Allow analytics" })).toBeTruthy();
    expect(googleScript()).toBe(null);
  });

  it("shows no analytics controls when no measurement ID is configured", async () => {
    vi.stubEnv("VITE_GA4_MEASUREMENT_ID", "");
    await renderConsent();
    expect(screen.queryByRole("button", { name: "Analytics settings" })).toBe(null);
    expect(screen.queryByRole("button", { name: "Allow analytics" })).toBe(null);
    expect(googleScript()).toBe(null);
  });

  it("allows local preview of controls without enabling local collection", async () => {
    vi.stubEnv("PROD", false);
    await renderConsent();
    fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
    expect(googleScript()).toBe(null);
  });
});
