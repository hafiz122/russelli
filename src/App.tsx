import { useEffect, useMemo, useRef, useState } from "react";
import { MathAnswerInput, StaticMath } from "./components/MathField";
import { getSkill, skillIds, skills } from "./data/skills";
import { generateQuestion } from "./math/generators";
import { isParseableAnswer, validateAnswer } from "./math/validator";
import { chooseSkill, difficultyFor, nextSeed, recordAttempt, setPreferredSkill } from "./state/adaptive";
import { clearProgress, loadProgress, saveProgress } from "./state/storage";
import type { Attempt, LocalProgressV1, SkillId, ValidationResult } from "./types";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function siteHref(path: string): string {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

function currentPath(): "home" | "practice" | "progress" {
  const pathname = basePath && window.location.pathname.startsWith(`${basePath}/`)
    ? window.location.pathname.slice(basePath.length)
    : window.location.pathname;
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/practice") return "practice";
  if (path === "/progress") return "progress";
  return "home";
}

function SiteShell({ children, route }: { children: React.ReactNode; route: ReturnType<typeof currentPath> }) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a className="wordmark" href={siteHref("/")} aria-label="nurkh home">nurkh.</a>
        <nav aria-label="Primary navigation">
          <a className={route === "practice" ? "active" : ""} href={siteHref("/practice/")}>Practice</a>
          <a className={route === "progress" ? "active" : ""} href={siteHref("/progress/")}>Progress</a>
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
      Saved progress could not be read, so nurkh. started a fresh local record.
    </div>
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
          nurkh. gives you one question at a time. Solve it on paper, enter the final answer, and get an exact mathematical check.
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

function PracticePage({ progress, updateProgress }: { progress: LocalProgressV1; updateProgress: (value: LocalProgressV1) => void }) {
  const querySkill = new URLSearchParams(window.location.search).get("topic") as SkillId | null;
  const validQuerySkill = querySkill && skillIds.includes(querySkill) ? querySkill : null;
  const [selectedSkill, setSelectedSkill] = useState<SkillId>(() => validQuerySkill ?? chooseSkill(progress));
  const [questionContext, setQuestionContext] = useState(() => ({
    calibration: !progress.calibrationCompleted,
    calibrationNumber: Math.min(progress.calibrationIndex + 1, skillIds.length)
  }));
  const [seed, setSeed] = useState(() => nextSeed(progress));
  const [answer, setAnswer] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);
  const [feedback, setFeedback] = useState<ValidationResult | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [solutionVisible, setSolutionVisible] = useState(false);
  const [difficulty, setDifficulty] = useState(() => difficultyFor(progress.mastery[selectedSkill]));
  const question = useMemo(
    () => generateQuestion(selectedSkill, seed, difficulty),
    [difficulty, seed, selectedSkill]
  );
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

  function submitAnswer() {
    if (!parseable || feedback?.correct) return;
    const result = validateAnswer(question, answer);
    setAttemptCount((count) => count + 1);
    setFeedback(result);
    updateProgress(recordAttempt(progress, makeAttempt(result)));
  }

  function loadNext(recordSkip: boolean) {
    let nextProgress = progress;
    if (recordSkip && !feedback?.correct) {
      const skippedResult: ValidationResult = {
        parseable: true,
        correct: false,
        normalizedAnswer: answer,
        feedback: "Question skipped.",
        retryEligible: false
      };
      nextProgress = recordAttempt(progress, makeAttempt(skippedResult, solutionVisible));
      updateProgress(nextProgress);
    }
    const nextSkill = validQuerySkill ?? chooseSkill(nextProgress);
    setSelectedSkill(nextSkill);
    setDifficulty(difficultyFor(nextProgress.mastery[nextSkill]));
    setQuestionContext({
      calibration: !nextProgress.calibrationCompleted,
      calibrationNumber: Math.min(nextProgress.calibrationIndex + 1, skillIds.length)
    });
    setSeed(nextSeed(nextProgress, Date.now() + attemptCount + 1));
    setAnswer("");
    setAttemptCount(0);
    setFeedback(null);
    setHintCount(0);
    setSolutionVisible(false);
  }

  function chooseTopic(skillId: SkillId | null) {
    const next = setPreferredSkill(progress, skillId);
    updateProgress(next);
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
            value={validQuerySkill ?? progress.preferredSkill ?? "adaptive"}
            onChange={(event) => chooseTopic(event.target.value === "adaptive" ? null : (event.target.value as SkillId))}
          >
            <option value="adaptive">Adaptive queue</option>
            {skills.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
      </section>

      <section className="problem-sheet" aria-labelledby="problem-instruction">
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
          </div>
        )}

        <div className="problem-actions">
          {feedback?.correct ? (
            <button className="button primary" type="button" onClick={() => loadNext(false)}>Load the next question</button>
          ) : (
            <>
              <button className="button primary" type="button" onClick={submitAnswer} disabled={!parseable}>Check answer</button>
              <button className="button quiet" type="button" onClick={() => loadNext(true)}>Skip this question</button>
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
          <button className="note-action" type="button" onClick={() => setHintCount((count) => count + 1)}>Reveal the next hint</button>
        )}
        {!solutionVisible ? (
          <button className="note-action secondary" type="button" onClick={() => setSolutionVisible(true)}>Show worked solution</button>
        ) : (
          <div className="worked-solution">
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

function ProgressPage({ progress, updateProgress }: { progress: LocalProgressV1; updateProgress: (value: LocalProgressV1) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const attempts = progress.recentAttempts;
  const correct = attempts.filter((attempt) => attempt.correct).length;

  function reset() {
    updateProgress(clearProgress());
    dialogRef.current?.close();
  }

  return (
    <div className="progress-page page-shell">
      <section className="progress-heading">
        <p className="plain-kicker">Stored on this device</p>
        <h1>Your algebra record</h1>
        <p>Mastery changes as you answer. Choose any topic when you want focused practice.</p>
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
          <p>Resetting removes the calibration and answer history from this browser.</p>
        </div>
        <button className="button danger" type="button" onClick={() => dialogRef.current?.showModal()}>Reset local progress</button>
      </section>

      <dialog ref={dialogRef} className="reset-dialog" onCancel={() => dialogRef.current?.close()}>
        <h2>Reset this progress record?</h2>
        <p>This removes every answer and mastery score stored by nurkh. on this device.</p>
        <div>
          <button className="button quiet" type="button" onClick={() => dialogRef.current?.close()}>Keep my progress</button>
          <button className="button danger" type="button" onClick={reset}>Reset progress</button>
        </div>
      </dialog>
    </div>
  );
}

export default function App() {
  const route = currentPath();
  const initial = useMemo(() => loadProgress(), []);
  const [progress, setProgress] = useState(initial.progress);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  return (
    <SiteShell route={route}>
      <RecoveryNotice visible={initial.recovered} />
      {route === "home" && <HomePage progress={progress} />}
      {route === "practice" && <PracticePage progress={progress} updateProgress={setProgress} />}
      {route === "progress" && <ProgressPage progress={progress} updateProgress={setProgress} />}
    </SiteShell>
  );
}

