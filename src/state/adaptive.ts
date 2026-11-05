import { skills, skillIds } from "../data/skills";
import type { Attempt, Difficulty, LocalProgressV1, SkillId } from "../types";

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

function lastSeenIndex(progress: LocalProgressV1, skillId: SkillId): number {
  const reverseIndex = [...progress.recentAttempts].reverse().findIndex((attempt) => attempt.skillId === skillId);
  return reverseIndex < 0 ? 100 : reverseIndex;
}

export function chooseSkill(progress: LocalProgressV1): SkillId {
  if (!progress.calibrationCompleted) return skillIds[progress.calibrationIndex] ?? skillIds[0];
  if (progress.preferredSkill) return progress.preferredSkill;

  return [...skillIds].sort((left, right) => {
    const leftPriority =
      (1 - progress.mastery[left]) * 0.65 +
      Math.min(lastSeenIndex(progress, left) / 12, 1) * 0.2 +
      readiness(progress, left) * 0.15;
    const rightPriority =
      (1 - progress.mastery[right]) * 0.65 +
      Math.min(lastSeenIndex(progress, right) / 12, 1) * 0.2 +
      readiness(progress, right) * 0.15;
    return rightPriority - leftPriority;
  })[0];
}

export function nextSeed(progress: LocalProgressV1, now = Date.now()): number {
  let candidate = Math.abs(Math.trunc(now % 2147483647)) || 1;
  while (progress.recentSeeds.includes(candidate)) candidate = (candidate + 7919) % 2147483647 || 1;
  return candidate;
}

export function recordAttempt(progress: LocalProgressV1, attempt: Attempt): LocalProgressV1 {
  const delta = attempt.correct ? (attempt.attemptCount === 1 ? 0.08 : 0.04) : -0.07;
  const nextScore = Math.max(0, Math.min(1, progress.mastery[attempt.skillId] + delta));
  const alreadyCompleted = progress.recentAttempts.some(previous =>
    previous.questionId === attempt.questionId && (previous.correct || previous.solutionRevealed)
  );
  const nextCalibrationIndex = progress.calibrationCompleted || alreadyCompleted
    ? progress.calibrationIndex
    : Math.min(skillIds.length, progress.calibrationIndex + (attempt.correct || attempt.solutionRevealed ? 1 : 0));

  return {
    ...progress,
    calibrationIndex: nextCalibrationIndex,
    calibrationCompleted: progress.calibrationCompleted || nextCalibrationIndex >= skillIds.length,
    mastery: { ...progress.mastery, [attempt.skillId]: nextScore },
    recentAttempts: [...progress.recentAttempts, attempt].slice(-80),
    recentSeeds: [...progress.recentSeeds, attempt.seed].slice(-40)
  };
}

export function setPreferredSkill(progress: LocalProgressV1, skillId: SkillId | null): LocalProgressV1 {
  return { ...progress, preferredSkill: skillId };
}

