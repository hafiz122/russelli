import { skillIds } from "../data/skills";
import type { Attempt, LocalProgressV1, SkillId } from "../types";

const STORAGE_KEY = "nurkh.progress.v1";

function defaultMastery(): Record<SkillId, number> {
  return Object.fromEntries(skillIds.map((id) => [id, 0.35])) as Record<SkillId, number>;
}

export function createDefaultProgress(): LocalProgressV1 {
  return {
    schemaVersion: 1,
    calibrationCompleted: false,
    calibrationIndex: 0,
    mastery: defaultMastery(),
    recentAttempts: [],
    recentSeeds: [],
    preferredSkill: null
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

export function loadProgress(): { progress: LocalProgressV1; recovered: boolean } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { progress: createDefaultProgress(), recovered: false };
    const value = JSON.parse(raw) as Partial<LocalProgressV1>;
    if (value.schemaVersion !== 1 || typeof value.mastery !== "object" || value.mastery === null) {
      throw new Error("Unsupported progress format");
    }

    const base = createDefaultProgress();
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
    base.preferredSkill = isSkillId(value.preferredSkill) ? value.preferredSkill : null;
    return { progress: base, recovered: false };
  } catch {
    return { progress: createDefaultProgress(), recovered: true };
  }
}

export function saveProgress(progress: LocalProgressV1): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function clearProgress(): LocalProgressV1 {
  window.localStorage.removeItem(STORAGE_KEY);
  return createDefaultProgress();
}

