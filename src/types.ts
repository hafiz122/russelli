export type SkillId =
  | "expressions"
  | "linear"
  | "lines_systems"
  | "exponents_radicals"
  | "polynomials"
  | "factoring_quadratics"
  | "rational"
  | "functions";

export type Difficulty = "easy" | "medium" | "hard";

export type AnswerKind =
  | "number"
  | "expression"
  | "equation"
  | "ordered_pair"
  | "interval";

export interface AnswerSpec {
  latex: string;
  kind: AnswerKind;
  requiresFactoredForm?: boolean;
  forbiddenFactorLatex?: string;
}

export interface Question {
  id: string;
  seed: number;
  generatorVersion: 1;
  skillId: SkillId;
  difficulty: Difficulty;
  promptLatex: string;
  instruction: string;
  answer: AnswerSpec;
  hints: string[];
  workedSolution: string[];
}

export interface ValidationResult {
  parseable: boolean;
  correct: boolean;
  normalizedAnswer: string;
  feedback: string;
  retryEligible: boolean;
}

export interface Attempt {
  questionId: string;
  seed: number;
  skillId: SkillId;
  difficulty: Difficulty;
  rawLatex: string;
  normalizedAnswer: string;
  correct: boolean;
  attemptCount: number;
  solutionRevealed: boolean;
  timestamp: string;
}

export interface SkillDefinition {
  id: SkillId;
  title: string;
  shortTitle: string;
  description: string;
  prerequisites: SkillId[];
}

export interface LocalProgressV1 {
  schemaVersion: 1;
  resetId: string;
  calibrationCompleted: boolean;
  calibrationIndex: number;
  mastery: Record<SkillId, number>;
  recentAttempts: Attempt[];
  recentSeeds: number[];
  preferredSkill: SkillId | null;
  totalPoints: number;
  currentStreak: number;
  bestStreak: number;
  rewardQuestion: QuestionReward | null;
}

export interface QuestionReward {
  questionId: string;
  status: "eligible" | "awarded" | "solution_revealed" | "skipped";
}

export interface QuestionGenerator {
  skillId: SkillId;
  generate(seed: number, difficulty: Difficulty): Question;
  validate(question: Question, answer: string): ValidationResult;
}

