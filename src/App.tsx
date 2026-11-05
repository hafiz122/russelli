import { useEffect, useMemo, useRef, useState } from "react";
import { MathAnswerInput, StaticMath } from "./components/MathField";
import { getSkill, skillIds, skills } from "./data/skills";
import { changelog } from "./data/changelog";
import { generateQuestion } from "./math/generators";
import { isParseableAnswer, validateAnswer } from "./math/validator";
import { chooseSkill, difficultyFor, nextSeed, recordAttempt, setPreferredSkill } from "./state/adaptive";
import { commitProgress, loadProgress, resetStoredProgress, STORAGE_KEY, type ProgressCommit, type ProgressUpdate } from "./state/storage";
import { applyRewardEvent } from "./state/rewards";
import type { Attempt, LocalProgressV1, SkillId, ValidationResult } from "./types";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
type UpdateProgress = (update: ProgressUpdate) => Promise<ProgressCommit | null>;

function siteHref(path: string): string {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

function currentPath(): "home" | "practice" | "progress" | "changelog" {
  const pathname = basePath && window.location.pathname.startsWith(`${basePath}/`)
    ? window.location.pathname.slice(basePath.length)
    : window.location.pathname;
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/practice") return "practice";
  if (path === "/progress") return "progress";
  if (path === "/changelog") return "changelog";
  return "home";
}

function SiteShell({ children, route }: { children: React.ReactNode; route: ReturnType<typeof currentPath> }) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a className="wordmark" href={siteHref("/")} aria-label="russelli home">russelli.</a>
        <nav aria-label="Primary navigation">
          <a className={route === "practice" ? "active" : ""} href={siteHref("/practice/")}>Practice</a>
          <a className={route === "progress" ? "active" : ""} href={siteHref("/progress/")}>Progress</a>
          <a className={route === "changelog" ? "active" : ""} aria-current={route === "changelog" ? "page" : undefined} href={siteHref("/changelog/")}>Changelog</a>
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer className="site-footer">
        <span>Work it out by hand.</span>
        <span>Your progress stays on this device.</span>
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
  const hasAttempts = progress.recentAttempts.length > 0;
  const completed = progress.calibrationCompleted;
  const actionLabel = completed ? "Continue adaptive practice" : hasAttempts ? "Continue calibration" : "Start the calibration";

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
          {skills.map((skill, index) => (
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
    </div>
  );
}

function PracticePage({ progress, updateProgress, saving }: { progress: LocalProgressV1; updateProgress: UpdateProgress; saving: boolean }) {
  const querySkill = new URLSearchParams(window.location.search).get("topic") as SkillId | null;
  const validQuerySkill = querySkill && skillIds.includes(querySkill) ? querySkill : null;
  const [question, setQuestion] = useState(() => {
    const skillId = validQuerySkill ?? chooseSkill(progress);
    return generateQuestion(skillId, nextSeed(progress), difficultyFor(progress.mastery[skillId]));
  });
  const [questionContext, setQuestionContext] = useState(() => ({
    calibration: !progress.calibrationCompleted,
    calibrationNumber: Math.min(progress.calibrationIndex + 1, skillIds.length)
  }));
  const [answer, setAnswer] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);
  const [feedback, setFeedback] = useState<ValidationResult | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [solutionVisible, setSolutionVisible] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  const acceptedRef = useRef(false);
  const parseable = isParseableAnswer(question, answer);
  const skill = getSkill(question.skillId);

  function makeAttempt(result: ValidationResult, revealed = solutionVisible): Attempt {
    return {
      questionId: question.id,
      seed: question.seed,
      skillId: question.skillId,
      difficulty: question.difficulty,
      rawLatex: answer,
      normalizedAnswer: result.normalizedAnswer,
      correct: result.correct,
      attemptCount: Math.max(attemptCount + 1, hintCount > 0 ? 2 : 1),
      solutionRevealed: revealed,
      timestamp: new Date().toISOString()
    };
  }

  async function submitAnswer() {
    if (!parseable || acceptedRef.current || saving) return;
    const result = validateAnswer(question, answer);
    if (!result.parseable) return;
    acceptedRef.current = result.correct;
    const attempt = makeAttempt(result);
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
    if (saving) return;
    let nextProgress = progress;
    if (recordSkip && !feedback?.correct) {
      const skippedResult: ValidationResult = {
        parseable: true,
        correct: false,
        normalizedAnswer: answer,
        feedback: "Question skipped.",
        retryEligible: false
      };
      const attempt = makeAttempt(skippedResult, solutionVisible);
      const commit = await updateProgress((current) => applyRewardEvent(recordAttempt(current, attempt), {
        type: "skip", questionId: question.id
      }));
      if (!commit?.applied) return;
      nextProgress = commit.progress;
    }
    const nextSkill = validQuerySkill ?? chooseSkill(nextProgress);
    setQuestion(generateQuestion(nextSkill, nextSeed(nextProgress, Date.now() + attemptCount + 1), difficultyFor(nextProgress.mastery[nextSkill])));
    setQuestionContext({
      calibration: !nextProgress.calibrationCompleted,
      calibrationNumber: Math.min(nextProgress.calibrationIndex + 1, skillIds.length)
    });
    setAnswer("");
    setAttemptCount(0);
    setFeedback(null);
    setHintCount(0);
    setSolutionVisible(false);
    setEarnedPoints(null);
    acceptedRef.current = false;
  }

  async function revealSolution() {
    if (acceptedRef.current) {
      setSolutionVisible(true);
      return;
    }
    const commit = await updateProgress((current) => applyRewardEvent(current, { type: "reveal_solution", questionId: question.id }));
    if (commit?.applied) setSolutionVisible(true);
  }

  async function chooseTopic(skillId: SkillId | null) {
    const commit = await updateProgress((current) => setPreferredSkill(current, skillId));
    if (!commit?.applied) return;
    window.location.href = skillId ? siteHref(`/practice/?topic=${skillId}`) : siteHref("/practice/");
  }

  return (
    <div className="practice-page page-shell">
      <section className="practice-context" aria-label="Practice context">
        <div>
          {questionContext.calibration ? (
            <p className="plain-kicker">Calibration {questionContext.calibrationNumber} of {skillIds.length}</p>
          ) : (
            <p className="plain-kicker">Adaptive practice</p>
          )}
          <h1>{skill.title}</h1>
          <p>{skill.description}</p>
        </div>
        <label className="topic-select-label">
          Practice focus
          <select
            disabled={saving}
            value={validQuerySkill ?? progress.preferredSkill ?? "adaptive"}
            onChange={(event) => chooseTopic(event.target.value === "adaptive" ? null : (event.target.value as SkillId))}
          >
            <option value="adaptive">Adaptive queue</option>
            {skills.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
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
        <StaticMath className="problem-equation" latex={question.promptLatex} label={question.instruction} />
        <p className="paper-prompt">Work this out on paper, then enter your final answer.</p>

        <div className="answer-area">
          <label id="answer-label" className="answer-label">Final answer</label>
          <MathAnswerInput
            value={answer}
            onChange={(value) => {
              setAnswer(value);
              if (!feedback?.correct) setFeedback(null);
            }}
            onSubmit={submitAnswer}
            disabled={Boolean(feedback?.correct)}
            readOnly={saving}
            label="Final algebra answer"
          />
          <details className="syntax-help">
            <summary>Answer format help</summary>
            <p>Use the math keyboard for fractions, powers, and roots. Enter ordered pairs as (x, y) and inequalities in interval notation. Infinity always uses a parenthesis, never a square bracket.</p>
          </details>
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
              <button className="button primary" type="button" onClick={submitAnswer} disabled={!parseable || saving}>Check answer</button>
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
            <ol>
              {question.workedSolution.map((step, index) => (
                <li key={`${step}-${index}`}><StaticMath latex={step} label={`Solution step ${index + 1}`} /></li>
              ))}
            </ol>
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

function ProgressPage({ progress, resetProgress, saving }: { progress: LocalProgressV1; resetProgress: () => Promise<boolean>; saving: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const attempts = progress.recentAttempts;
  const correct = attempts.filter((attempt) => attempt.correct).length;

  async function reset() {
    if (await resetProgress()) dialogRef.current?.close();
  }

  return (
    <div className="progress-page page-shell">
      <section className="progress-heading">
        <p className="plain-kicker">Stored on this device</p>
        <h1>Your algebra record</h1>
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

      {attempts.length === 0 ? (
        <section className="progress-empty" aria-labelledby="empty-title">
          <h2 id="empty-title">No answers recorded yet.</h2>
          <p>Complete the first calibration question to start a local progress record.</p>
          <a className="button primary" href={siteHref("/practice/")}>Answer the first question</a>
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
            <div className="mastery-rows">
              {skills.map((skill) => {
                const score = progress.mastery[skill.id];
                const label = score < 0.45 ? "Building" : score <= 0.75 ? "Developing" : "Ready for challenge";
                return (
                  <article key={skill.id} className="mastery-row">
                    <div>
                      <h3>{skill.title}</h3>
                      <p>{label}</p>
                    </div>
                    <div className="mastery-meter" role="meter" aria-label={`${skill.title}: ${label}`} aria-valuemin={0} aria-valuemax={1} aria-valuenow={score}>
                      <span style={{ width: `${score * 100}%` }} />
                    </div>
                    <a href={siteHref(`/practice/?topic=${skill.id}`)}>Practice this topic</a>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="recent-results" aria-labelledby="recent-title">
            <div className="recent-heading">
              <h2 id="recent-title">Recent checks</h2>
              <p>Your latest final-answer submissions on this device.</p>
            </div>
            <ol>
              {attempts.slice(-6).reverse().map((attempt, index) => (
                <li key={`${attempt.questionId}-${attempt.timestamp}-${index}`}>
                  <div>
                    <strong>{getSkill(attempt.skillId).title}</strong>
                    <span>{attempt.difficulty} · attempt {attempt.attemptCount}</span>
                  </div>
                  <StaticMath
                    latex={attempt.rawLatex || "\\text{skipped}"}
                    label={attempt.rawLatex ? `Submitted answer ${attempt.rawLatex}` : "Question skipped"}
                  />
                  <span className={attempt.correct ? "result-accepted" : "result-retry"}>
                    {attempt.correct ? "Accepted" : attempt.solutionRevealed ? "Solution viewed" : "Try again"}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

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
      {route === "practice" && <PracticePage key={progress.resetId} progress={progress} updateProgress={updateProgress} saving={saving} />}
      {route === "progress" && <ProgressPage progress={progress} resetProgress={resetProgress} saving={saving} />}
      {route === "changelog" && <ChangelogPage />}
    </SiteShell>
  );
}

