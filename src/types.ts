export type SkillId =
  | "expressions"
  | "linear"
  | "lines_systems"
  | "exponents_radicals"
  | "polynomials"
  | "factoring_quadratics"
  | "rational"
  | "functions"
  | "vectors"
  | "matrices"
  | "linear_systems"
  | "determinants_inverses"
  | "eigen";

export type TrackId = "algebra" | "linear_algebra";

export type Difficulty = "easy" | "medium" | "hard";

export type AnswerKind =
  | "number"
  | "expression"
  | "equation"
  | "ordered_pair"
  | "ordered_triple"
  | "interval"
  | "matrix"
  | "vector_direction";

export interface AnswerSpec {
  latex: string;
  kind: AnswerKind;
  requiresFactoredForm?: boolean;
  forbiddenFactorLatex?: string;
  matrixShape?: { rows: number; cols: number };
}

export interface Question {
  id: string;
  seed: number;
  generatorVersion: 1 | 2;
  skillId: SkillId;
  difficulty: Difficulty;
  formId: string;
  problemKey: string;
  promptLatex: string;
  instruction: string;
  answer: AnswerSpec;
  hints: string[];
  workedSolution: string[];
}

export interface RecentPresentation {
  presentationId: string;
  questionId: string;
  seed: number;
  skillId: SkillId;
  difficulty: Difficulty;
  calibrationIndex: number | null;
  formId: string;
  problemKey: string;
  answerKey: string;
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
  presentationId?: string;
  calibrationIndex?: number | null;
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
  track: TrackId;
}

export interface LocalProgressV1 {
  schemaVersion: 1;
  resetId: string;
  calibrationCompleted: boolean;
  calibrationIndex: number;
  mastery: Record<SkillId, number>;
  recentAttempts: Attempt[];
  recentSeeds: number[];
  recentPresentations: RecentPresentation[];
  preferredSkill: SkillId | null;
  preferredLinearSkill: SkillId | null;
  totalPoints: number;
  currentStreak: number;
  bestStreak: number;
  rewardQuestion: QuestionReward | null;
}

export interface QuestionReward {
  questionId: string;
  presentationId?: string;
  status: "eligible" | "awarded" | "solution_revealed" | "skipped";
}

export interface QuestionGenerator {
  skillId: SkillId;
  generate(seed: number, difficulty: Difficulty): Question;
  validate(question: Question, answer: string): ValidationResult;
}

