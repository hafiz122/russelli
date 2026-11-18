import { useEffect, useRef, useState } from "react";
import { ANALYTICS_CHOICE_KEY, analyticsConfigured, applyAnalyticsChoice, readAnalyticsChoice, saveAnalyticsChoice, type AnalyticsChoice } from "../analytics";
import "./AnalyticsConsent.css";

export function useAnalyticsConsent() {
  const available = analyticsConfigured();
  const [choice, setChoice] = useState<AnalyticsChoice>(readAnalyticsChoice);
  const [isOpen, setIsOpen] = useState(available && choice === null);
  const [saveFailed, setSaveFailed] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLElement>(null);
  const openedFromSettings = useRef(false);
  const saveBlocked = useRef(false);

  useEffect(() => {
    if (!available) return;
    const synchronize = () => {
      if (saveBlocked.current) {
        applyAnalyticsChoice(null);
        return;
      }
      const savedChoice = readAnalyticsChoice();
      applyAnalyticsChoice(savedChoice);
      setChoice(savedChoice);
      setSaveFailed(false);
      if (!openedFromSettings.current) {
        if (savedChoice !== null && noteRef.current?.contains(document.activeElement)) {
          document.getElementById("main-content")?.focus({ preventScroll: true });
        }
        setIsOpen(savedChoice === null);
      }
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === ANALYTICS_CHOICE_KEY || event.key === null) synchronize();
    };
    synchronize();
    window.addEventListener("storage", storageChanged);
    window.addEventListener("pageshow", synchronize);
    window.addEventListener("focus", synchronize);
    return () => {
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("pageshow", synchronize);
      window.removeEventListener("focus", synchronize);
    };
  }, [available]);

  useEffect(() => {
    if (isOpen && openedFromSettings.current) noteRef.current?.focus();
  }, [isOpen]);

  function returnFocus() {
    if (openedFromSettings.current) settingsButtonRef.current?.focus();
    else document.getElementById("main-content")?.focus({ preventScroll: true });
  }

  function choose(nextChoice: Exclude<AnalyticsChoice, null>) {
    const saved = saveAnalyticsChoice(nextChoice);
    saveBlocked.current = !saved;
    applyAnalyticsChoice(saved ? nextChoice : null);
    setSaveFailed(!saved);
    setChoice(saved || nextChoice === "declined" ? nextChoice : null);
    setIsOpen(!saved && nextChoice === "allowed");
    if (saved || nextChoice === "declined") {
      returnFocus();
      openedFromSettings.current = false;
    }
  }

  function openSettings() {
    openedFromSettings.current = true;
    setIsOpen(true);
    if (isOpen) noteRef.current?.focus();
  }

  function closeSettings() {
    setIsOpen(false);
    returnFocus();
    openedFromSettings.current = false;
  }

  return {
    available, choice, isOpen, saveFailed, settingsButtonRef, noteRef, choose, openSettings, closeSettings
  };
}

export function AnalyticsConsent({ consent, privacyHref }: { consent: ReturnType<typeof useAnalyticsConsent>; privacyHref: string }) {
  if (!consent.available) return null;
  return (
    <>
      <aside id="analytics-consent" className="analytics-consent" aria-labelledby="analytics-consent-title" ref={consent.noteRef} tabIndex={-1} hidden={!consent.isOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape" && consent.choice !== null) consent.closeSettings();
        }}>
        <div className="analytics-consent-copy">
          <p id="analytics-consent-title"><strong>Optional site analytics</strong></p>
          <p>May I use Google Analytics cookies to count visits and pages viewed? Your answers and practice record stay in this browser. <a className="analytics-privacy-link" href={privacyHref}>Privacy details</a></p>
          {consent.choice !== null && <p className="analytics-current-choice">Current choice: {consent.choice === "allowed" ? "analytics allowed" : "analytics declined"}.</p>}
        </div>
        <div className="analytics-consent-actions">
          <button className="analytics-choice-button" type="button" onClick={() => consent.choose("allowed")}>Allow analytics</button>
          <button className="analytics-choice-button" type="button" onClick={() => consent.choose("declined")}>Decline analytics</button>
          {consent.choice !== null && <button className="analytics-keep-choice" type="button" onClick={consent.closeSettings}>Keep current choice</button>}
        </div>
      </aside>
      {consent.saveFailed && <p className="analytics-save-notice" role="status">Analytics stays off on this page. This browser couldn’t save your choice for future pages. You can keep practicing.</p>}
    </>
  );
}
