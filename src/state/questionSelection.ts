import { formIds, generateQuestion } from "../math/generators";
import type { Difficulty, Question, RecentPresentation, SkillId } from "../types";

const CANDIDATE_COUNT = 16;
const RECENT_QUESTION_COUNT = 40;
const RECENT_ANSWER_COUNT = 4;
const SEED_PAIR_COUNT = 1_073_741_823;

export interface QuestionSelectionOptions {
  skillId: SkillId;
  difficulty: Difficulty;
  recentPresentations: readonly RecentPresentation[];
  previousFormId: string | null;
  presentationId: string;
  randomUint32?: () => number;
}

export interface QuestionSelection {
  question: Question;
  presentation: RecentPresentation;
}

function secureRandomUint32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

function seedForParity(value: number, parity: 0 | 1): number {
  const pair = ((value >>> 0) % SEED_PAIR_COUNT) + 1;
  return parity === 0 ? pair * 2 : pair * 2 - 1;
}

function nextSeedOfParity(seed: number, parity: 0 | 1): number {
  const maximum = parity === 0 ? 2_147_483_646 : 2_147_483_645;
  return seed === maximum ? (parity === 0 ? 2 : 1) : seed + 2;
}

function answerKey(question: Question): string {
  return `${question.answer.kind}:${question.answer.latex}`;
}

function lastIndexOfKey(recent: readonly RecentPresentation[], key: string): number {
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    if (recent[index].problemKey === key) return index;
  }
  return -1;
}

export function selectQuestion({
  skillId,
  difficulty,
  recentPresentations,
  previousFormId,
  presentationId,
  randomUint32 = secureRandomUint32
}: QuestionSelectionOptions): QuestionSelection {
  const forms = formIds[skillId];
  const recent = recentPresentations.slice(-RECENT_QUESTION_COUNT);
  const lastForTopic = [...recent].reverse().find((item) => item.skillId === skillId);
  const priorForm = forms.includes(previousFormId ?? "")
    ? previousFormId
    : forms.includes(lastForTopic?.formId ?? "") ? lastForTopic?.formId : null;
  const parity: 0 | 1 = priorForm === forms[0]
    ? 1
    : priorForm === forms[1] ? 0 : (randomUint32() >>> 0) % 2 as 0 | 1;

  const candidates: Question[] = [];
  const usedSeeds = new Set<number>();
  for (let index = 0; index < CANDIDATE_COUNT; index += 1) {
    let seed = seedForParity(randomUint32(), parity);
    while (usedSeeds.has(seed)) seed = nextSeedOfParity(seed, parity);
    usedSeeds.add(seed);
    candidates.push(generateQuestion(skillId, seed, difficulty));
  }

  const recentKeys = new Set(recent.map((item) => item.problemKey));
  const novel = candidates.filter((candidate) => !recentKeys.has(candidate.problemKey));
  let preferred: Question[];
  if (novel.length > 0) {
    const recentAnswers = new Set(recent.filter((item) => item.skillId === skillId).slice(-RECENT_ANSWER_COUNT).map((item) => item.answerKey));
    const freshAnswers = novel.filter((candidate) => !recentAnswers.has(answerKey(candidate)));
    preferred = freshAnswers.length > 0 ? freshAnswers : novel;
  } else {
    const lastIndex = (candidate: Question) => lastIndexOfKey(recent, candidate.problemKey);
    const oldestMatch = Math.min(...candidates.map(lastIndex));
    preferred = candidates.filter((candidate) => lastIndex(candidate) === oldestMatch);
  }

  const question = preferred[(randomUint32() >>> 0) % preferred.length];
  return {
    question,
    presentation: {
      presentationId,
      questionId: question.id,
      seed: question.seed,
      skillId,
      difficulty,
      calibrationIndex: null,
      formId: question.formId,
      problemKey: question.problemKey,
      answerKey: answerKey(question)
    }
  };
}
