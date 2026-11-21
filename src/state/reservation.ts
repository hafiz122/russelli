import { generateQuestion } from "../math/generators";
import { calculusTopics, isCalculusTopic, type CalculusFocus } from "../data/calculus";
import type { LocalProgressV1, Question, SkillId, TrackId } from "../types";
import { chooseSkill, difficultyFor } from "./adaptive";
import { selectQuestion } from "./questionSelection";

export interface ReservationOptions {
  presentationId: string;
  topicOverride: SkillId | null;
  calculusFocus?: CalculusFocus;
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
  const focus = track === "calculus" ? options.calculusFocus : undefined;
  const skillId = focus ? chooseSkill(progress, track, focus) : options.topicOverride ?? chooseSkill(progress, track);
  const clo = focus?.clo;
  const aligned = isCalculusTopic(skillId) ? calculusTopics[skillId].outcomes : null;
  const requiredForm = clo && aligned && aligned[0] !== aligned[1] ? (aligned[0] === clo ? 0 : 1) : undefined;
  const difficulty = difficultyFor(progress.mastery[skillId]);
  const { question, presentation } = selectQuestion({
    skillId,
    requiredForm,
    difficulty,
    recentPresentations: currentHistory,
    previousFormId: options.lastForms[skillId] ?? null,
    presentationId: options.presentationId,
    randomUint32: options.randomUint32
  });

  const calibrationIndex = track === "algebra" && !progress.calibrationCompleted ? progress.calibrationIndex : null;
  return {
    progress: { ...progress, recentPresentations: [...currentHistory, { ...presentation, calibrationIndex }].slice(-40) },
    question,
    calibrationIndex
  };
}
