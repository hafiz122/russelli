import { skillIds } from "../data/skills";
import type { Attempt, LocalProgressV1, QuestionReward, RecentPresentation, SkillId } from "../types";

export const STORAGE_KEY = "russelli.progress.v1";
const LEGACY_STORAGE_KEY = "nurkh.progress.v1";

export interface ProgressCommit {
  previous: LocalProgressV1;
  progress: LocalProgressV1;
  applied: boolean;
}

export type ProgressUpdate = (current: LocalProgressV1) => LocalProgressV1;

function defaultMastery(): Record<SkillId, number> {
  return Object.fromEntries(skillIds.map((id) => [id, 0.35])) as Record<SkillId, number>;
}

export function createDefaultProgress(): LocalProgressV1 {
  return {
    schemaVersion: 1,
    resetId: "initial",
    calibrationCompleted: false,
    calibrationIndex: 0,
    mastery: defaultMastery(),
    recentAttempts: [],
    recentSeeds: [],
    recentPresentations: [],
    preferredSkill: null,
    totalPoints: 0,
    currentStreak: 0,
    bestStreak: 0,
    rewardQuestion: null
  };
}

function isSkillId(value: unknown): value is SkillId {
  return typeof value === "string" && skillIds.includes(value as SkillId);
}

function isAttempt(value: unknown): value is Attempt {
  if (typeof value !== "object" || value === null) return false;
  const attempt = value as Partial<Attempt>;
  return typeof attempt.questionId === "string" && attempt.questionId.length > 0 &&
    Number.isInteger(attempt.seed) &&
    isSkillId(attempt.skillId) &&
    ["easy", "medium", "hard"].includes(attempt.difficulty ?? "") &&
    typeof attempt.rawLatex === "string" &&
    typeof attempt.normalizedAnswer === "string" &&
    typeof attempt.correct === "boolean" &&
    Number.isInteger(attempt.attemptCount) && (attempt.attemptCount ?? 0) >= 1 &&
    typeof attempt.solutionRevealed === "boolean" &&
    typeof attempt.timestamp === "string" && Number.isFinite(Date.parse(attempt.timestamp));
}

function isRecentPresentation(value: unknown): value is RecentPresentation {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<RecentPresentation>;
  return typeof item.presentationId === "string" && item.presentationId.length > 0 &&
    typeof item.questionId === "string" && item.questionId.length > 0 &&
    Number.isInteger(item.seed) && (item.seed ?? 0) > 0 && (item.seed ?? 0) < 2147483647 &&
    isSkillId(item.skillId) &&
    ["easy", "medium", "hard"].includes(item.difficulty ?? "") &&
    typeof item.formId === "string" && item.formId.length > 0 &&
    typeof item.problemKey === "string" && item.problemKey.length > 0 &&
    typeof item.answerKey === "string" &&
    (item.calibrationIndex === null ||
      (Number.isInteger(item.calibrationIndex) && (item.calibrationIndex ?? -1) >= 0 && (item.calibrationIndex ?? 0) < skillIds.length));
}

function rewardCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function questionReward(value: unknown): QuestionReward | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<QuestionReward>;
  if (typeof candidate.questionId !== "string" || candidate.questionId.length === 0) return null;
  if (candidate.status !== "eligible" && candidate.status !== "awarded" &&
      candidate.status !== "solution_revealed" && candidate.status !== "skipped") return null;
  return {
    questionId: candidate.questionId,
    status: candidate.status,
    ...(typeof candidate.presentationId === "string" && candidate.presentationId.length > 0
      ? { presentationId: candidate.presentationId } : {})
  };
}

export function loadProgress(): { progress: LocalProgressV1; recovered: boolean } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { progress: createDefaultProgress(), recovered: false };
    const value = JSON.parse(raw) as Partial<LocalProgressV1>;
    if (value.schemaVersion !== 1 || typeof value.mastery !== "object" || value.mastery === null) {
      throw new Error("Unsupported progress format");
    }

    const base = createDefaultProgress();
    base.resetId = typeof value.resetId === "string" && value.resetId.length > 0 ? value.resetId : base.resetId;
    for (const id of skillIds) {
      const score = value.mastery[id];
      if (typeof score === "number" && Number.isFinite(score)) {
        base.mastery[id] = Math.max(0, Math.min(1, score));
      }
    }

    base.calibrationCompleted = Boolean(value.calibrationCompleted);
    base.calibrationIndex = Math.max(0, Math.min(skillIds.length, Number(value.calibrationIndex) || 0));
    base.recentAttempts = Array.isArray(value.recentAttempts) ? value.recentAttempts.filter(isAttempt).slice(-80) : [];
    base.recentSeeds = Array.isArray(value.recentSeeds)
      ? value.recentSeeds.filter((seed) => Number.isInteger(seed)).slice(-40)
      : [];
    base.recentPresentations = Array.isArray(value.recentPresentations)
      ? value.recentPresentations.filter(isRecentPresentation).slice(-40)
      : [];
    base.preferredSkill = isSkillId(value.preferredSkill) ? value.preferredSkill : null;
    base.totalPoints = rewardCount(value.totalPoints);
    base.currentStreak = rewardCount(value.currentStreak);
    base.bestStreak = Math.max(base.currentStreak, rewardCount(value.bestStreak));
    base.rewardQuestion = questionReward(value.rewardQuestion);
    return { progress: base, recovered: false };
  } catch {
    return { progress: createDefaultProgress(), recovered: true };
  }
}

export function saveProgress(progress: LocalProgressV1): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function clearProgress(): LocalProgressV1 {
  const progress = { ...createDefaultProgress(), resetId: crypto.randomUUID() };
  saveProgress(progress);
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  return progress;
}

async function withProgressLock<T>(action: () => T): Promise<T> {
  if (!navigator.locks) throw new Error("This browser cannot safely coordinate saved progress across tabs.");
  return navigator.locks.request(STORAGE_KEY, action);
}

export function commitProgress(expectedResetId: string, update: ProgressUpdate): Promise<ProgressCommit> {
  return withProgressLock(() => {
    const previous = loadProgress().progress;
    if (previous.resetId !== expectedResetId) return { previous, progress: previous, applied: false };
    const progress = update(previous);
    saveProgress(progress);
    return { previous, progress, applied: true };
  });
}

export function resetStoredProgress(): Promise<LocalProgressV1> {
  return withProgressLock(clearProgress);
}

