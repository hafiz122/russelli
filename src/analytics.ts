export type AnalyticsChoice = "allowed" | "declined" | null;

export const ANALYTICS_CHOICE_KEY = "russelli.analytics-choice.v1";
const measurementId = (import.meta.env.VITE_GA4_MEASUREMENT_ID ?? "").trim();
const cookiePath = "/russelli/";
const deniedConsent = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied"
};
const allowedConsent = { ...deniedConsent, analytics_storage: "granted" };
const googleWindow = window as Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};
let activeChoice: AnalyticsChoice = null;
let tagScript: HTMLScriptElement | null = null;
let configured = false;

export function analyticsConfigured(): boolean {
  return /^G-[A-Z0-9]+$/.test(measurementId);
}

export function analyticsAvailable(): boolean {
  return analyticsConfigured() && import.meta.env.PROD &&
    window.location.protocol === "https:" && window.location.hostname === "hafiz122.github.io" &&
    (window.location.pathname === "/russelli" || window.location.pathname.startsWith("/russelli/"));
}

export function readAnalyticsChoice(): AnalyticsChoice {
  try {
    const choice = window.localStorage.getItem(ANALYTICS_CHOICE_KEY);
    return choice === "allowed" || choice === "declined" ? choice : null;
  } catch {
    return null;
  }
}

export function saveAnalyticsChoice(choice: Exclude<AnalyticsChoice, null>): boolean {
  try {
    window.localStorage.setItem(ANALYTICS_CHOICE_KEY, choice);
    return true;
  } catch {
    try {
      window.localStorage.removeItem(ANALYTICS_CHOICE_KEY);
    } catch {
      // Collection remains disabled even when a stale choice cannot be removed.
    }
    return false;
  }
}

function withoutQuery(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? `${url.origin}${url.pathname}` : "";
  } catch {
    return "";
  }
}

function clearAnalyticsCookies(): void {
  try {
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0].trim();
      if (name === "russelli_ga" || name.startsWith("russelli_ga_")) {
        document.cookie = `${name}=; Max-Age=0; Path=${cookiePath}; SameSite=Lax; Secure`;
      }
    }
  } catch {
    // The disable flag still stops collection when cookie access is blocked.
  }
}

export function applyAnalyticsChoice(choice: AnalyticsChoice): void {
  const previousChoice = activeChoice;
  activeChoice = choice;
  if (!analyticsAvailable()) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = choice !== "allowed";

  if (choice !== "allowed") {
    if (tagScript && !configured) {
      tagScript.remove();
      tagScript = null;
    }
    if (configured && previousChoice === "allowed") googleWindow.gtag?.("consent", "update", deniedConsent);
    clearAnalyticsCookies();
    return;
  }

  if (configured) {
    if (previousChoice !== "allowed") googleWindow.gtag?.("consent", "update", allowedConsent);
    return;
  }
  if (tagScript) return;

  googleWindow.dataLayer ??= [];
  googleWindow.gtag = function (..._args: unknown[]) {
    googleWindow.dataLayer!.push(arguments);
  };
  const script = document.createElement("script");
  script.async = true;
  script.referrerPolicy = "no-referrer";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.onload = () => {
    // A removed script can still finish fetching after consent changes.
    if (tagScript !== script || activeChoice !== "allowed" || !analyticsAvailable() || configured) return;
    configured = true;
    googleWindow.gtag!("consent", "default", deniedConsent);
    googleWindow.gtag!("consent", "update", allowedConsent);
    googleWindow.gtag!("js", new Date());
    googleWindow.gtag!("config", measurementId, {
      page_location: withoutQuery(window.location.href),
      page_referrer: withoutQuery(document.referrer),
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: "none",
      cookie_path: cookiePath,
      cookie_prefix: "russelli",
      send_page_view: true
    });
  };
  script.onerror = () => {
    if (tagScript === script) {
      script.remove();
      tagScript = null;
    }
  };
  tagScript = script;
  document.head.append(script);
}
