import { algebraSkillIds, skills, statisticsSkillIds, tracks } from "../data/skills";
import { isCalculusTopic, topicsForFocus, type CalculusFocus } from "../data/calculus";
import type { Attempt, Difficulty, LocalProgressV1, SkillId, TrackId } from "../types";
import { applyRewardEvent } from "./rewards";

export function difficultyFor(score: number): Difficulty {
  if (score < 0.45) return "easy";
  if (score <= 0.75) return "medium";
  return "hard";
}

function readiness(progress: LocalProgressV1, skillId: SkillId): number {
  const skill = skills.find((item) => item.id === skillId);
  if (!skill || skill.prerequisites.length === 0) return 1;
  return Math.min(...skill.prerequisites.map((id) => progress.mastery[id]));
}

export function chooseSkill(progress: LocalProgressV1, track: TrackId = "algebra", focus?: CalculusFocus): SkillId {
  if (track === "algebra" && !progress.calibrationCompleted) {
    return algebraSkillIds[progress.calibrationIndex] ?? algebraSkillIds[0];
  }
  const { skillIds, preference } = tracks[track];
  const focused = track === "calculus" && focus && (focus.chapter || focus.topic || focus.clo);
  let candidates: SkillId[] = focused ? topicsForFocus(focus) : skillIds;
  const preferred = progress[preference];
  if (preferred && !(track === "calculus" && focus)) return preferred;
  if (focused && focus.clo) {
    const solved = progress.independentCalculusTopics[focus.clo];
    const outstanding = candidates.filter(id => isCalculusTopic(id) && !solved.includes(id));
    if (outstanding.length) candidates = outstanding;
  }
  if (track !== "algebra" && !focus?.clo) {
    const next = candidates.find((id) => progress.mastery[id] < 0.45);
    if (next) return next;
  }

  const useDisplayHistory = track === "statistics_probability" || track === "calculus";
  const history = useDisplayHistory && progress.recentPresentations.some(item => candidates.includes(item.skillId))
    ? progress.recentPresentations : progress.recentAttempts;
  const newestFirst = [...history].reverse();
  const ranked = candidates.map(skillId => {
    const lastSeen = newestFirst.findIndex(item => item.skillId === skillId);
    const age = lastSeen === -1 ? 100 : lastSeen;
    const priority = (1 - progress.mastery[skillId]) * 0.65 +
      Math.min(age / 12, 1) * 0.2 + readiness(progress, skillId) * 0.15;
    return { skillId, priority, age };
  });
  return ranked.sort((a, b) => b.priority - a.priority ||
    (useDisplayHistory ? b.age - a.age : 0))[0].skillId;
}

export function nextSeed(progress: LocalProgressV1, now = Date.now()): number {
  let candidate = Math.abs(Math.trunc(now % 2147483647)) || 1;
  while (progress.recentSeeds.includes(candidate)) candidate = (candidate + 7919) % 2147483647 || 1;
  return candidate;
}

export function readinessAfterAnswer(score: number, attempt: Attempt): number {
  if (attempt.correct && attempt.solutionRevealed && (statisticsSkillIds.includes(attempt.skillId) || isCalculusTopic(attempt.skillId))) return score;
  const delta = attempt.correct ? (attempt.attemptCount === 1 && !attempt.hintUsed ? 0.08 : 0.04) : -0.07;
  return Math.max(0, Math.min(1, score + delta));
}

export function recordAttempt(progress: LocalProgressV1, attempt: Attempt): LocalProgressV1 {
  const identity = { questionId: attempt.questionId, presentationId: attempt.presentationId };
  if (attempt.skipped && (statisticsSkillIds.includes(attempt.skillId) || isCalculusTopic(attempt.skillId))) {
    return applyRewardEvent({
      ...progress, recentSeeds: [...progress.recentSeeds, attempt.seed].slice(-40)
    }, { type: "skip", ...identity });
  }
  const completesCurrentSlot = attempt.calibrationIndex !== null && attempt.calibrationIndex !== undefined &&
    algebraSkillIds.includes(attempt.skillId) && attempt.calibrationIndex === progress.calibrationIndex &&
    (attempt.correct || attempt.solutionRevealed);
  const nextCalibrationIndex = progress.calibrationCompleted || !completesCurrentSlot
    ? progress.calibrationIndex
    : Math.min(algebraSkillIds.length, progress.calibrationIndex + (attempt.correct || attempt.solutionRevealed ? 1 : 0));

  const updated = {
    ...progress,
    calibrationIndex: nextCalibrationIndex,
    calibrationCompleted: progress.calibrationCompleted || nextCalibrationIndex >= algebraSkillIds.length,
    mastery: { ...progress.mastery, [attempt.skillId]: readinessAfterAnswer(progress.mastery[attempt.skillId], attempt) },
    recentAttempts: [...progress.recentAttempts, attempt].slice(-80),
    recentSeeds: [...progress.recentSeeds, attempt.seed].slice(-40)
  };
  const { outcome, skillId } = attempt;
  if (outcome && isCalculusTopic(skillId) && attempt.correct && attempt.attemptCount === 1 && !attempt.hintUsed &&
      !attempt.solutionRevealed && !progress.independentCalculusTopics[outcome].includes(skillId)) {
    updated.independentCalculusTopics = { ...progress.independentCalculusTopics,
      [outcome]: [...progress.independentCalculusTopics[outcome], skillId] };
  }
  if (attempt.skipped) return applyRewardEvent(updated, { type: "skip", ...identity });
  return applyRewardEvent(updated, {
    type: "answer",
    ...identity,
    parseable: true,
    correct: attempt.correct,
    solutionRevealed: attempt.solutionRevealed
  });
}

export function setPreferredSkill(progress: LocalProgressV1, skillId: SkillId | null, track: TrackId = "algebra"): LocalProgressV1 {
  return { ...progress, [tracks[track].preference]: skillId };
}

