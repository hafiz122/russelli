import { useEffect, useMemo, useRef, useState } from "react";
import { MathAnswerInput, StaticMath } from "./components/MathField";
import { DistributionAnswerInput } from "./components/DistributionAnswer";
import { TestAnswerInput } from "./components/TestAnswer";
import { CalculusIndex, CalculusPicker, OutcomeProgress } from "./components/CalculusCourse";
import { chapters, isCalculusTopic, outcomes, readCalculusFocus, topicsForFocus } from "./data/calculus";
import { AnalyticsConsent, useAnalyticsConsent } from "./components/AnalyticsConsent";
import { algebraSkillIds, getSkill, skills, trackIds, tracks } from "./data/skills";
import { changelog } from "./data/changelog";
import { isParseableAnswer, validateAnswer } from "./math/validator";
import { recordAttempt, setPreferredSkill } from "./state/adaptive";
import { commitProgress, loadProgress, resetStoredProgress, STORAGE_KEY, type ProgressCommit, type ProgressUpdate } from "./state/storage";
import { applyRewardEvent } from "./state/rewards";
import { reservePresentation, type Reservation } from "./state/reservation";
import type { Attempt, LocalProgressV1, Question, ReferenceTable, SkillId, TrackId, ValidationResult } from "./types";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
type UpdateProgress = (update: ProgressUpdate) => Promise<ProgressCommit | null>;
const TAB_FORMS_KEY = "russelli.last-forms.v1";

function tabLastForms(resetId: string): Partial<Record<SkillId, string>> {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(TAB_FORMS_KEY) ?? "null") as {
      resetId?: string;
      forms?: Partial<Record<SkillId, string>>;
    } | null;
    return saved?.resetId === resetId && saved.forms && typeof saved.forms === "object" ? saved.forms : {};
  } catch {
    return {};
  }
}

function rememberForm(resetId: string, question: Question): void {
  try {
    const forms = tabLastForms(resetId);
    window.sessionStorage.setItem(TAB_FORMS_KEY, JSON.stringify({
      resetId,
      forms: { ...forms, [question.skillId]: question.formId }
    }));
  } catch {
    // Selection still uses the shared display history when tab storage is unavailable.
  }
}

function siteHref(path: string): string {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

function currentPath(): TrackId | "home" | "progress" | "changelog" | "privacy" | "terms" {
  const pathname = basePath && window.location.pathname.startsWith(`${basePath}/`)
    ? window.location.pathname.slice(basePath.length)
    : window.location.pathname;
  const path = pathname.replace(/\/$/, "") || "/";
  const track = trackIds.find((id) => tracks[id].path === `${path}/`);
  if (track) return track;
  if (path === "/progress") return "progress";
  if (path === "/changelog") return "changelog";
  if (path === "/privacy") return "privacy";
  if (path === "/terms") return "terms";
  return "home";
}

function SiteShell({ children, route }: { children: React.ReactNode; route: ReturnType<typeof currentPath> }) {
  const analytics = useAnalyticsConsent();
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a className="wordmark" href={siteHref("/")} aria-label="russelli home">russelli.</a>
        <nav aria-label="Primary navigation">
          {trackIds.map((id) => (
            <a key={id} className={route === id ? "active" : ""} aria-current={route === id ? "page" : undefined} href={siteHref(tracks[id].path)}>{tracks[id].title}</a>
          ))}
          <a className={route === "progress" ? "active" : ""} href={siteHref("/progress/")}>Progress</a>
          <a className={route === "changelog" ? "active" : ""} aria-current={route === "changelog" ? "page" : undefined} href={siteHref("/changelog/")}>Changelog</a>
        </nav>
      </header>
      <AnalyticsConsent consent={analytics} privacyHref={siteHref("/privacy/")} />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <span>Work it out by hand.</span>
        <div className="footer-information">
          <span>Your progress stays on this device.</span>
          <nav aria-label="Site information">
            <a href={siteHref("/privacy/")}>Privacy</a>
            <a href={siteHref("/terms/")}>Terms</a>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSf00loxr8Eqzs1QMSlz__fzKKcRTgvHI3dYZhoOkrHqukPF6Q/viewform?usp=header" target="_blank" rel="noopener noreferrer" aria-label="Send feedback via Google Forms (opens in a new tab)">Send feedback</a>
            {analytics.available && <button className="analytics-settings-link" type="button" ref={analytics.settingsButtonRef} aria-controls="analytics-consent" aria-expanded={analytics.isOpen} onClick={analytics.openSettings}>Analytics settings</button>}
          </nav>
        </div>
      </footer>
    </>
  );
}

function RecoveryNotice({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="system-notice" role="status">
      Saved progress could not be read, so russelli. started a fresh local record.
    </div>
  );
}

function PointsHelp() {
  return (
    <details className="points-help">
      <summary>How points work</summary>
      <p>Earn 10 points for each accepted answer, with 10 extra for every fifth answer in a streak. A mistake or skip resets your streak. A correct retry starts it again. Hints are welcome.</p>
      <p>Showing a worked solution before your answer is accepted resets your streak and makes that question ineligible for points. Viewing it after acceptance changes nothing.</p>
      <p>Points and streaks stay on this device, across topics and visits. Calibration answers count too. Resetting local progress clears them.</p>
    </details>
  );
}

function HomePage({ progress }: { progress: LocalProgressV1 }) {
  const hasAttempts = progress.recentAttempts.some(attempt => !attempt.skipped);
  const hasAlgebraAttempts = progress.recentAttempts.some((attempt) => algebraSkillIds.includes(attempt.skillId));
  const completed = progress.calibrationCompleted;
  const actionLabel = completed ? "Continue adaptive practice" : hasAlgebraAttempts ? "Continue calibration" : "Start the calibration";

  return (
    <div className="home-layout page-shell">
      <section className="home-intro" aria-labelledby="home-title">
        <p className="plain-kicker">Paper first. Final answer here.</p>
        <h1 id="home-title">Algebra practice that leaves room for your own working.</h1>
        <p className="home-copy">
          russelli. gives you one question at a time. Solve it on paper, enter the final answer, and get an exact mathematical check.
        </p>
        <div className="home-actions">
          <a className="button primary" href={siteHref("/practice/")}>{actionLabel}</a>
          {hasAttempts && <a className="text-link" href={siteHref("/progress/")}>Review your progress</a>}
        </div>
      </section>

      <aside className="paper-preview" aria-label="Example practice flow">
        <p className="paper-label">A typical question</p>
        <StaticMath className="preview-equation" latex="3(x-4)+2x" label="three times x minus four, plus two x" />
        <div className="preview-rule" />
        <p>Use your notebook for the steps.</p>
        <div className="preview-answer" aria-hidden="true">5x - 12</div>
        <p className="lilac-note">Type only the final expression.</p>
      </aside>

      <section className="topic-index" aria-labelledby="topics-title">
        <div>
          <p className="section-number">Eight connected areas</p>
          <h2 id="topics-title">The algebra path</h2>
        </div>
        <ol>
          {skills.filter((skill) => skill.track === "algebra").map((skill, index) => (
            <li key={skill.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{skill.title}</h3>
                <p>{skill.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <CalculusIndex path={siteHref("/calculus/")} />
      <section className="linear-track-intro guided-track-intro" aria-labelledby="linear-track-title">
        <div>
          <p className="section-number">Five connected areas</p>
          <h2 id="linear-track-title">Linear algebra</h2>
          <p>Start with vectors, then work through matrices, systems, determinants, and eigen problems. One question at a time, with your working on paper.</p>
          <a className="button quiet" href={siteHref("/linear-algebra/")}>Practice linear algebra</a>
        </div>
        <ol>
          {skills.filter((skill) => skill.track === "linear_algebra").map((skill) => (
            <li key={skill.id}><strong>{skill.title}</strong><span>{skill.description}</span></li>
          ))}
        </ol>
      </section>
      <section className="guided-track-intro" aria-labelledby="statistics-track-title">
        <div>
          <h2 id="statistics-track-title">Statistics &amp; probability</h2>
          <p>Start with permutations and combinations, use calculus to study continuous distributions, or test a claim about a population. Choose any topic below.</p>
          <a className="button quiet" href={siteHref(tracks.statistics_probability.path)}>Practice statistics &amp; probability</a>
        </div>
        <ol>
          {skills.filter((skill) => skill.track === "statistics_probability").map((skill) => (
            <li key={skill.id}>
              <strong><a href={siteHref(`${tracks.statistics_probability.path}?topic=${skill.id}`)}>{skill.title}</a></strong>
              <span>{skill.description}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ProbabilityReference({ table }: { table: ReferenceTable }) {
  return (
    <div className="reference-wrap">
      <table className="probability-reference">
        <caption>{table.caption}</caption>
        <thead>
          <tr>{table.headers.map(header => <th key={header} scope="col">{header}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map(row => (
            <tr key={row[0]}>
              {row.map((value, i) => {
                const Cell = i === 0 ? "th" : "td";
                return <Cell key={table.headers[i]} scope={i === 0 ? "row" : undefined}>
                  <span className="reference-label" aria-hidden="true">{table.headers[i]}</span>
                  <span className="reference-value">{value}</span>
                </Cell>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PracticePage({ progress, updateProgress, saving, track }: { progress: LocalProgressV1; updateProgress: UpdateProgress; saving: boolean; track: TrackId }) {
  const { skillIds: trackSkillIds, path: practicePath, title, preference, guidedLabel } = tracks[track];
  const trackSkills = skills.filter((item) => item.track === track);
  const querySkill = new URLSearchParams(window.location.search).get("topic") as SkillId | null;
  const [calculusFocus] = useState(() => {
    if (track !== "calculus") return undefined;
    const focus = readCalculusFocus(window.location.search);
    if (focus.clo || focus.chapter || focus.topic || !isCalculusTopic(progress.preferredCalculusSkill)) return focus;
    return { topic: progress.preferredCalculusSkill };
  });
  const validQuerySkill = calculusFocus ? calculusFocus.topic ?? null :
    querySkill && trackSkillIds.includes(querySkill) ? querySkill : null;
  const wideMath = track === "statistics_probability" || track === "calculus";
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionContext, setQuestionContext] = useState<{ calibrationIndex: number | null; presentationId: string } | null>(null);
  const [reservationFailed, setReservationFailed] = useState(false);
  const firstPresentationId = useRef(crypto.randomUUID());
  const initialRequestStarted = useRef(false);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const [answer, setAnswer] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);
  const [feedback, setFeedback] = useState<ValidationResult | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [solutionVisible, setSolutionVisible] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  const acceptedRef = useRef(false);
  const parseable = question ? isParseableAnswer(question, answer) : false;
  const skill = question ? getSkill(question.skillId) : null;

  async function reserveInitialQuestion() {
    setReservationFailed(false);
    const reservation = { current: null as Reservation | null };
    const commit = await updateProgress((current) => {
      reservation.current = reservePresentation(current, {
        presentationId: firstPresentationId.current,
        topicOverride: validQuerySkill,
        calculusFocus,
        track,
        lastForms: tabLastForms(current.resetId)
      });
      return reservation.current.progress;
    });
    const reserved = reservation.current;
    if (commit?.applied && reserved) {
      setQuestion(reserved.question);
      setQuestionContext({ calibrationIndex: reserved.calibrationIndex, presentationId: firstPresentationId.current });
      rememberForm(commit.progress.resetId, reserved.question);
    } else if (commit === null) {
      setReservationFailed(true);
    }
  }

  useEffect(() => {
    if (initialRequestStarted.current) return;
    initialRequestStarted.current = true;
    void reserveInitialQuestion();
  }, []);

  useEffect(() => {
    if (reservationFailed) retryButtonRef.current?.focus();
  }, [reservationFailed]);

  function makeAttempt(result: Pick<ValidationResult, "correct" | "normalizedAnswer">, submitted: string): Attempt {
    if (!question || !questionContext) throw new Error("No question is ready.");
    return {
      questionId: question.id,
      presentationId: questionContext.presentationId,
      calibrationIndex: questionContext.calibrationIndex,
      seed: question.seed,
      skillId: question.skillId,
      difficulty: question.difficulty,
      rawLatex: submitted,
      normalizedAnswer: result.normalizedAnswer,
      correct: result.correct,
      attemptCount: question.outcome ? attemptCount + 1 : Math.max(attemptCount + 1, hintCount > 0 ? 2 : 1),
      ...(question.outcome && hintCount > 0 && { hintUsed: true }),
      solutionRevealed: solutionVisible,
      ...(question.outcome && { outcome: question.outcome }),
      ...(question.answer.kind === "choice" && { choiceLabel: question.answer.choices?.find(item => item.value === submitted)?.label }),
      timestamp: new Date().toISOString()
    };
  }

  async function submitAnswer(submitted = answer) {
    if (!question || !questionContext || acceptedRef.current || saving) return;
    const result = validateAnswer(question, submitted);
    if (!result.parseable) return;
    setAnswer(submitted);
    acceptedRef.current = result.correct;
    const attempt = makeAttempt(result, submitted);
    const commit = await updateProgress((current) => recordAttempt(current, attempt));
    if (!commit?.applied) {
      acceptedRef.current = false;
      return;
    }
    setAttemptCount((count) => count + 1);
    setFeedback(result);
    setEarnedPoints(result.correct ? commit.progress.totalPoints - commit.previous.totalPoints : null);
  }

  async function loadNext(recordSkip: boolean) {
    if (!question || !questionContext || saving) return;
    const presentationId = crypto.randomUUID();
    const reservation = { current: null as Reservation | null };
    const commit = await updateProgress((current) => {
      let nextProgress = current;
      if (recordSkip && !feedback?.correct) {
        const attempt = makeAttempt({ correct: false, normalizedAnswer: answer }, answer);
        nextProgress = recordAttempt(nextProgress, { ...attempt, skipped: true });
      }
      reservation.current = reservePresentation(nextProgress, {
        presentationId,
        topicOverride: validQuerySkill,
        calculusFocus,
        track,
        lastForms: { ...tabLastForms(current.resetId), [question.skillId]: question.formId }
      });
      return reservation.current.progress;
    });
    const reserved = reservation.current;
    if (!commit?.applied || !reserved) return;
    setQuestion(reserved.question);
    setQuestionContext({ calibrationIndex: reserved.calibrationIndex, presentationId });
    rememberForm(commit.progress.resetId, reserved.question);
    setAnswer("");
    setAttemptCount(0);
    setFeedback(null);
    setHintCount(0);
    setSolutionVisible(false);
    setEarnedPoints(null);
    acceptedRef.current = false;
  }

  async function revealSolution() {
    if (!question || !questionContext) return;
    if (acceptedRef.current) {
      setSolutionVisible(true);
      return;
    }
    const commit = await updateProgress((current) => applyRewardEvent(current, {
      type: "reveal_solution", questionId: question.id, presentationId: questionContext.presentationId
    }));
    if (commit?.applied) setSolutionVisible(true);
  }

  async function chooseTopic(skillId: SkillId | null) {
    const commit = await updateProgress((current) => setPreferredSkill(current, skillId, track));
    if (!commit?.applied) return;
    window.location.href = skillId ? siteHref(`${practicePath}?topic=${skillId}`) : siteHref(practicePath);
  }

  async function chooseCalculusPractice(query: string) {
    const { topic } = readCalculusFocus(query);
    const commit = await updateProgress(current => setPreferredSkill(current, topic ?? null, "calculus"));
    if (commit?.applied) window.location.href = siteHref(practicePath + (query ? `?${query}` : ""));
  }

  function editAnswer(value: string) {
    if (value === answer) return;
    setAnswer(value);
    if (!feedback?.correct) setFeedback(null);
  }

  if (!question || !questionContext || !skill) {
    return (
      <div className="practice-page page-shell">
        <section className="problem-sheet preparation-sheet">
          <h1>{reservationFailed ? "Question unavailable" : "Preparing your question"}</h1>
          <p role="status">{reservationFailed
            ? "Your question could not be saved. Try again to continue practicing."
            : "Choosing and saving a question for your practice."}</p>
          {reservationFailed && <button ref={retryButtonRef} className="button primary" type="button" onClick={reserveInitialQuestion} disabled={saving}>Try again</button>}
        </section>
      </div>
    );
  }

  return (
    <div className="practice-page page-shell">
      <section className="practice-context" aria-label="Practice context">
        <div>
          {track !== "algebra" ? (
            <p className="plain-kicker">{track === "calculus" ? skill.description : `Guided ${title.toLowerCase()}`}</p>
          ) : questionContext.calibrationIndex !== null ? (
            <p className="plain-kicker">Calibration {Math.min(questionContext.calibrationIndex + 1, algebraSkillIds.length)} of {algebraSkillIds.length}</p>
          ) : (
            <p className="plain-kicker">Adaptive practice</p>
          )}
          <h1>{skill.title}</h1>
          <p>{question.outcome ? `${question.outcome} · ${outcomes[question.outcome]}` : skill.description}</p>
        </div>
        {calculusFocus ? <CalculusPicker focus={calculusFocus} disabled={saving} onSelect={chooseCalculusPractice} /> : <label className="topic-select-label">
          Practice focus
          <select
            disabled={saving}
            value={validQuerySkill ?? progress[preference] ?? "adaptive"}
            onChange={(event) => chooseTopic(event.target.value === "adaptive" ? null : (event.target.value as SkillId))}
          >
            <option value="adaptive">{guidedLabel}</option>
            {trackSkills.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>}
        <dl className="practice-rewards" aria-label="Practice rewards">
          <div><dt>Points</dt><dd>{progress.totalPoints}</dd></div>
          <div><dt>Current streak</dt><dd>{progress.currentStreak}</dd></div>
        </dl>
        <PointsHelp />
      </section>

      <section className="problem-sheet" aria-labelledby="problem-instruction" aria-busy={saving}>
        <div className="problem-heading">
          <span className="difficulty-label">{question.difficulty}</span>
          <span className="problem-code">Problem {question.seed.toString(36).toUpperCase()}</span>
        </div>
        <p id="problem-instruction" className="problem-instruction">{question.instruction}</p>
        <StaticMath className="problem-equation" latex={question.promptLatex} label={question.instruction}
          description={question.promptDescription} fitToContainer scrollIfWide={wideMath} />
        {track === "calculus" && <p className="math-scroll-note">Scroll sideways to read the full expression.</p>}
        {question.referenceTable && <ProbabilityReference table={question.referenceTable} />}
        <p className="paper-prompt">Work this out on paper, then enter your final answer.</p>

        <div className="answer-area">
          {question.answer.kind === "choice" ? (
            <fieldset className="calculus-choices" disabled={saving || Boolean(feedback?.correct)}>
              <legend className="answer-label">Final answer</legend>
              {question.answer.choices?.map(choice => <label key={choice.value}>
                <input type="radio" name="calculus-answer" value={choice.value} checked={answer === choice.value}
                  onChange={() => editAnswer(choice.value)} onKeyDown={event => {
                    if (event.key === "Enter" && answer) {
                      event.preventDefault();
                      void submitAnswer();
                    }
                  }} />
                {choice.label}
              </label>)}
            </fieldset>
          ) : question.answer.kind === "distribution" ? (
            <DistributionAnswerInput value={answer} onChange={editAnswer} onSubmit={submitAnswer} disabled={Boolean(feedback?.correct)} readOnly={saving} />
          ) : question.answer.kind === "hypothesis_test" ? (
            <TestAnswerInput value={answer} onChange={editAnswer} onSubmit={submitAnswer} disabled={Boolean(feedback?.correct)} readOnly={saving} />
          ) : (
            <>
              <label id="answer-label" className="answer-label">Final answer</label>
              <MathAnswerInput value={answer} onChange={editAnswer} onSubmit={submitAnswer} disabled={Boolean(feedback?.correct)}
                readOnly={saving} label={`Final ${title.toLowerCase()} answer`} matrixShape={question.answer.matrixShape} />
            </>
          )}
          {question.answer.kind !== "choice" && <details className="syntax-help">
            <summary>Answer format help</summary>
            {track === "statistics_probability" ? (
              <p>{question.answer.kind === "distribution"
                ? "Choose the distribution you found on paper and enter each parameter. You can use fractions and other exact expressions."
                : question.answer.kind === "hypothesis_test"
                ? "Compare the unrounded p-value with the stated significance level to choose your decision. Then round the p-value to four decimal places for your answer."
                : "Enter the value or formula the question asks for. You can use the math keyboard for fractions, powers, and roots."}</p>
            ) : track === "calculus" ? (
              <p>Use exact values unless the question asks for rounding. The math keyboard includes fractions, roots, and π. Enter both sides of an equation, put coordinates in parentheses, and include the endpoint brackets for an interval.</p>
            ) : (
              <p>Use the math keyboard for fractions, powers, and roots. Enter pairs as (x, y), triples as (x, y, z), and inequalities in interval notation. Infinity always uses a parenthesis. For matrix answers, use the insert button and fill each cell.</p>
            )}
          </details>}
        </div>

        {feedback && (
          <div className={`feedback ${feedback.correct ? "correct" : "incorrect"}`} role="status" aria-live="polite">
            <strong>{feedback.correct ? "Answer accepted." : "Check your answer."}</strong>
            <span>{feedback.feedback}</span>
            {feedback.correct && earnedPoints !== null && (
              <span className="points-feedback">
                {earnedPoints > 10
                  ? `+${earnedPoints} points: 10 for your answer + 10 streak bonus.`
                  : earnedPoints > 0
                    ? `+${earnedPoints} points. ${progress.currentStreak} in a row.`
                    : solutionVisible || progress.rewardQuestion?.status === "solution_revealed"
                      ? "No points for this question because its worked solution was shown."
                      : "No additional points for this question."}
              </span>
            )}
          </div>
        )}

        <div className="problem-actions">
          {feedback?.correct ? (
            <button className="button primary" type="button" onClick={() => loadNext(false)} disabled={saving}>Load the next question</button>
          ) : (
            <>
              <button className="button primary" type="button" onClick={() => submitAnswer()} disabled={!parseable || saving}>Check answer</button>
              <button className="button quiet" type="button" onClick={() => loadNext(true)} disabled={saving}>Skip this question</button>
            </>
          )}
        </div>
      </section>

      <aside className="note-margin" aria-label="Hints and worked solution">
        <div className="note-heading">
          <span>Margin notes</span>
          <span>{hintCount}/{question.hints.length}</span>
        </div>
        {hintCount === 0 ? (
          <p className="empty-note">If you get stuck, reveal one hint at a time.</p>
        ) : (
          <ol className="hint-list">
            {question.hints.slice(0, hintCount).map((hint) => <li key={hint}>{hint}</li>)}
          </ol>
        )}
        {hintCount < question.hints.length && !feedback?.correct && (
          <button className="note-action" type="button" onClick={() => setHintCount((count) => count + 1)} disabled={saving}>Reveal the next hint</button>
        )}
        {!solutionVisible ? (
          <button className="note-action secondary" type="button" onClick={revealSolution} disabled={saving}>Show worked solution</button>
        ) : (
          <div className="worked-solution">
            {!feedback?.correct && <p className="solution-points-note" role="status">No points for this question. Your streak has reset; the next question can start a new one.</p>}
            <h2>Worked solution</h2>
            {track === "calculus" && <p className="math-scroll-note">Scroll longer steps sideways to read them in full.</p>}
            <ol>
              {question.workedSolution.map((step, index) => (
                <li key={`${step}-${index}`}><StaticMath latex={step} label={`Solution step ${index + 1}`} scrollIfWide={wideMath} /></li>
              ))}
            </ol>
            {question.workedConclusion && <p className="worked-conclusion">{question.workedConclusion}</p>}
          </div>
        )}
      </aside>
    </div>
  );
}

function ChangelogPage() {
  const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="changelog-page page-shell">
      <header className="changelog-heading">
        <h1>Changelog</h1>
        <p>Updates to russelli., from new practice features to fixes in answer checking. Latest first.</p>
      </header>
      {changelog.length === 0 ? (
        <p>No updates posted yet. Check back here for changes to russelli.</p>
      ) : (
        <ol className="changelog-entries" aria-label="Updates, newest first">
          {changelog.map((entry) => (
            <li key={entry.id}>
              <article className="changelog-entry" aria-labelledby={`update-${entry.id}`}>
                <time dateTime={entry.date}>{dateFormat.format(new Date(`${entry.date}T00:00:00Z`))}</time>
                <div>
                  <h2 id={`update-${entry.id}`}>{entry.title}</h2>
                  <p>{entry.summary}</p>
                  <ul>
                    {entry.changes.map((change) => <li key={change}>{change}</li>)}
                  </ul>
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PrivacyPage() {
  return (
    <article className="legal-page page-shell">
      <header className="legal-heading">
        <h1>Privacy notice</h1>
        <p>How russelli. handles your practice record and site visits.</p>
        <p className="legal-date">Last updated <time dateTime="2026-11-18">18 November 2026</time></p>
      </header>

      <section aria-labelledby="privacy-local">
        <h2 id="privacy-local">Your practice record</h2>
        <p>Answers are checked in your browser. The site saves your submitted answers, check results, dates, topic readiness, question history, points, and streaks in your browser’s local storage so you can continue practicing. It does not send that record to us or sync it across devices.</p>
        <p>The record keeps at most 80 recent attempts, 40 recent question seeds, and 40 recently displayed questions. This question history helps avoid repeats, including questions you skip or leave without answering. This tab also remembers the last problem form shown in each topic in browser session storage until you close the tab. Other progress, including points, streaks, and calculus topics solved independently for each course outcome, stays until you reset it or clear this site’s browser data. An older local record may be read to preserve progress from before the site was renamed.</p>
      </section>

      <section aria-labelledby="privacy-control">
        <h2 id="privacy-control">Your controls</h2>
        <p>Use <a href={siteHref("/progress/")}>Reset local progress</a> on the Progress page to clear your answers and scores in this browser. The site then keeps a fresh, empty local record to prevent another open tab from restoring the old one. Clearing this site’s data in your browser removes that record too.</p>
      </section>

      <section aria-labelledby="privacy-hosting">
        <h2 id="privacy-hosting">Hosting and site visits</h2>
        <p>GitHub Pages hosts the site. GitHub says it logs visitors’ IP addresses for security, whether or not they are signed in. See <a href="https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages">GitHub’s Pages documentation</a> and <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub’s privacy statement</a> for its handling of that information.</p>
      </section>

      <section aria-labelledby="privacy-analytics">
        <h2 id="privacy-analytics">Optional analytics</h2>
        <p>If you allow analytics, russelli. uses Google Analytics to count visits and pages viewed. Google Analytics uses cookies to recognize returning browsers and receives page addresses and basic browser and device information. I use these reports to understand site usage. Analytics is not used for advertising.</p>
        <p>Your submitted answers, points, topic readiness, and stored practice record are not sent to Google Analytics.</p>
        <p>You can decline analytics and keep using every practice feature. Change your choice through Analytics settings in the footer. Your choice is saved in this browser separately from practice progress. The Google Analytics tag loads only after an allowed choice is saved.</p>
        <p>See <a href="https://policies.google.com/technologies/partner-sites">how Google uses information from sites that use its services</a>.</p>
      </section>

      <section aria-labelledby="privacy-contact">
        <h2 id="privacy-contact">Questions</h2>
        <p>For a question about this notice, email <a href="mailto:muhammadhafiz0150@gmail.com">muhammadhafiz0150@gmail.com</a>. If you write to us, we receive your email address and message and use them to reply. We will update this page if the site’s data practices change.</p>
      </section>
    </article>
  );
}

function TermsPage() {
  return (
    <article className="legal-page page-shell">
      <header className="legal-heading">
        <h1>Terms of use</h1>
        <p>A few ground rules for using russelli. to practice algebra.</p>
        <p className="legal-date">Last updated <time dateTime="2026-11-10">10 November 2026</time></p>
      </header>

      <section aria-labelledby="terms-use">
        <h2 id="terms-use">Study use</h2>
        <p>russelli. offers free algebra, linear algebra, statistics, probability, and calculus questions, hints, and automated answer checking for study. Work through each problem on paper and enter your final mathematical answer. You may use the site for your own learning or in teaching.</p>
      </section>

      <section aria-labelledby="terms-checking">
        <h2 id="terms-checking">Answer checking</h2>
        <p>Automated checks and worked solutions can contain mistakes. Check important results independently or with a teacher. The site does not certify a learner’s ability or award academic credit.</p>
      </section>

      <section aria-labelledby="terms-progress">
        <h2 id="terms-progress">Saved progress</h2>
        <p>Progress is stored in this browser. It may be lost if you reset it, clear site data, switch browsers, or use another device. See the <a href={siteHref("/privacy/")}>privacy notice</a> for details.</p>
      </section>

      <section aria-labelledby="terms-changes">
        <h2 id="terms-changes">Changes and contact</h2>
        <p>We may change or stop the site and update these terms. The date above shows the latest version. For questions, email <a href="mailto:muhammadhafiz0150@gmail.com">muhammadhafiz0150@gmail.com</a>.</p>
      </section>
    </article>
  );
}

function ProgressPage({ progress, resetProgress, saving }: { progress: LocalProgressV1; resetProgress: () => Promise<boolean>; saving: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const history = progress.recentAttempts;
  const attempts = history.filter(attempt => !attempt.skipped);
  const correct = attempts.filter((attempt) => attempt.correct).length;

  function readinessRow(id: SkillId) {
    const skill = getSkill(id);
    const score = progress.mastery[id];
    const hasAnswer = score !== 0.35 || attempts.some(attempt => attempt.skillId === id) ||
      (isCalculusTopic(id) && Object.values(progress.independentCalculusTopics).some(topics => topics.includes(id)));
    const label = !hasAnswer ? "No answer on record" : score < 0.45 ? "Building" : score <= 0.75 ? "Developing" : "Ready for challenge";
    return <article key={id} className="mastery-row">
      <div><h4>{skill.title}</h4><p>{label}</p></div>
      {hasAnswer ? (
        <div className="mastery-meter" role="meter" aria-label={`${skill.title}: ${label}`} aria-valuemin={0} aria-valuemax={1} aria-valuenow={score}>
          <span style={{ width: `${score * 100}%` }} />
        </div>
      ) : <span className="mastery-unstarted">Readiness appears after an answer.</span>}
      <a href={siteHref(`${tracks[skill.track].path}?topic=${id}`)}>Practice this topic</a>
    </article>;
  }

  async function reset() {
    if (await resetProgress()) dialogRef.current?.close();
  }

  return (
    <div className="progress-page page-shell">
      <section className="progress-heading">
        <p className="plain-kicker">Stored on this device</p>
        <h1>Your practice record</h1>
        <p>Mastery changes as you answer. Choose any topic when you want focused practice.</p>
      </section>

      <section className="progress-rewards" aria-label="Points and streaks">
        <dl className="reward-summary">
          <div><dt>Total points</dt><dd>{progress.totalPoints}</dd></div>
          <div><dt>Current streak</dt><dd>{progress.currentStreak}</dd></div>
          <div><dt>Best streak</dt><dd>{progress.bestStreak}</dd></div>
        </dl>
        <PointsHelp />
      </section>

      {history.length === 0 ? (
        <section className="progress-empty" aria-labelledby="empty-title">
          <h2 id="empty-title">No answers recorded yet.</h2>
          <p>Choose a subject. Your answers and progress will appear here.</p>
          <div className="home-actions">
            <a className="button primary" href={siteHref("/practice/")}>Answer the first question</a>
            <a className="text-link" href={siteHref("/linear-algebra/")}>Explore linear algebra</a>
            <a className="text-link" href={siteHref(tracks.statistics_probability.path)}>Explore statistics &amp; probability</a>
            <a className="text-link" href={siteHref("/calculus/")}>Practice calculus</a>
          </div>
        </section>
      ) : (
        <>
          <section className="record-summary" aria-label="Practice summary">
            <div>
              <span className="summary-value">{attempts.length}</span>
              <span>answers checked</span>
            </div>
            <div>
              <span className="summary-value">{correct}</span>
              <span>accepted answers</span>
            </div>
            <div>
              <span className="summary-value">{new Set(attempts.map((attempt) => attempt.skillId)).size}</span>
              <span>topics practiced</span>
            </div>
          </section>

          <section className="mastery-list" aria-labelledby="mastery-title">
            <div className="mastery-heading">
              <h2 id="mastery-title">Topic readiness</h2>
              <p>The bars reflect only the answers stored in this browser.</p>
            </div>
            <div className="mastery-groups">
              {trackIds.map((trackId) => (
                <div className="mastery-rows" key={trackId}>
                  <h3 className="mastery-track-title">{tracks[trackId].title}</h3>
                  {trackId === "calculus" ? chapters.map(chapter => <details className="calculus-chapter" key={chapter.number}>
                    <summary>Chapter {chapter.number} · {chapter.title}</summary>
                    {topicsForFocus({ chapter: chapter.number }).map(readinessRow)}
                  </details>) : tracks[trackId].skillIds.map(readinessRow)}
                </div>
              ))}
            </div>
          </section>

          <section className="recent-results" aria-labelledby="recent-title">
            <div className="recent-heading">
              <h2 id="recent-title">Recent checks</h2>
              <p>Your latest final-answer submissions on this device.</p>
            </div>
            <ol>
              {history.slice(-6).reverse().map((attempt, index) => (
                <li key={`${attempt.questionId}-${attempt.timestamp}-${index}`}>
                  <div>
                    <strong>{getSkill(attempt.skillId).title}</strong>
                    <span>{attempt.difficulty} · attempt {attempt.attemptCount}{attempt.hintUsed && " · hint used"}</span>
                  </div>
                  {attempt.choiceLabel ? <span>{attempt.choiceLabel}</span> : <StaticMath
                    latex={attempt.rawLatex || "\\text{skipped}"}
                    label={attempt.rawLatex ? `Submitted answer ${attempt.rawLatex}` : "Question skipped"}
                  />}
                  <span className={attempt.correct ? "result-accepted" : "result-retry"}>
                    {attempt.correct ? "Accepted" : attempt.solutionRevealed ? "Solution viewed" : "Try again"}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      <OutcomeProgress progress={progress} path={siteHref("/calculus/")} />
      <section className="local-controls" aria-labelledby="local-title">
        <div>
          <h2 id="local-title">Local data</h2>
          <p>Resetting removes calibration, answer history, points and streaks from this browser.</p>
        </div>
        <button className="button danger" type="button" onClick={() => dialogRef.current?.showModal()} disabled={saving}>Reset local progress</button>
      </section>

      <dialog ref={dialogRef} className="reset-dialog" onCancel={() => dialogRef.current?.close()}>
        <h2>Reset this progress record?</h2>
        <p>This removes every answer, mastery score, points and streaks stored by russelli. on this device.</p>
        <div>
          <button className="button quiet" type="button" onClick={() => dialogRef.current?.close()} disabled={saving}>Keep my progress</button>
          <button className="button danger" type="button" onClick={reset} disabled={saving}>Reset progress</button>
        </div>
      </dialog>
    </div>
  );
}

export default function App() {
  const route = currentPath();
  const initial = useMemo(() => loadProgress(), []);
  const [progress, setProgress] = useState(initial.progress);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const refresh = () => setProgress(loadProgress().progress);
    const storageChanged = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && (event.key === STORAGE_KEY || event.key === null)) refresh();
    };
    window.addEventListener("storage", storageChanged);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    refresh();
    return () => {
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  async function persist<T>(operation: () => Promise<T>): Promise<T | null> {
    if (savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    setStorageError(null);
    try {
      const result = await operation();
      setProgress(loadProgress().progress);
      return result;
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Please try again.");
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const updateProgress: UpdateProgress = (update) => persist(() => commitProgress(progress.resetId, update));
  const resetProgress = async () => (await persist(resetStoredProgress)) !== null;

  return (
    <SiteShell route={route}>
      <RecoveryNotice visible={initial.recovered} />
      {storageError && <div className="system-notice" role="alert">Progress could not be saved. {storageError}</div>}
      {route === "home" && <HomePage progress={progress} />}
      {(route === "algebra" || route === "linear_algebra" || route === "statistics_probability" || route === "calculus") &&
        <PracticePage key={progress.resetId} progress={progress} updateProgress={updateProgress} saving={saving} track={route} />}
      {route === "progress" && <ProgressPage progress={progress} resetProgress={resetProgress} saving={saving} />}
      {route === "changelog" && <ChangelogPage />}
      {route === "privacy" && <PrivacyPage />}
      {route === "terms" && <TermsPage />}
    </SiteShell>
  );
}

