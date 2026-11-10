import { generateQuestion } from "../math/generators";
import type { LocalProgressV1, Question, SkillId, TrackId } from "../types";
import { chooseSkill, difficultyFor } from "./adaptive";
import { selectQuestion } from "./questionSelection";

export interface ReservationOptions {
  presentationId: string;
  topicOverride: SkillId | null;
  track?: TrackId;
  lastForms: Partial<Record<SkillId, string>>;
  randomUint32?: () => number;
}

export interface Reservation {
  progress: LocalProgressV1;
  question: Question;
  calibrationIndex: number | null;
}

export function reservePresentation(progress: LocalProgressV1, options: ReservationOptions): Reservation {
  const existing = progress.recentPresentations.find((item) => item.presentationId === options.presentationId);
  if (existing) {
    const question = generateQuestion(existing.skillId, existing.seed, existing.difficulty);
    if (question.id === existing.questionId && question.formId === existing.formId && question.problemKey === existing.problemKey) {
      return {
        progress,
        question,
        calibrationIndex: existing.calibrationIndex
      };
    }
  }

  const currentHistory = existing
    ? progress.recentPresentations.filter((item) => item.presentationId !== options.presentationId)
    : progress.recentPresentations;
  const track = options.track ?? "algebra";
  const skillId = options.topicOverride ?? chooseSkill(progress, track);
  const difficulty = difficultyFor(progress.mastery[skillId]);
  const { question, presentation } = selectQuestion({
    skillId,
    difficulty,
    recentPresentations: currentHistory,
    previousFormId: options.lastForms[skillId] ?? null,
    presentationId: options.presentationId,
    randomUint32: options.randomUint32
  });

  const calibrationIndex = track === "linear_algebra" || progress.calibrationCompleted ? null : progress.calibrationIndex;
  return {
    progress: { ...progress, recentPresentations: [...currentHistory, { ...presentation, calibrationIndex }].slice(-40) },
    question,
    calibrationIndex
  };
}
