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
  | "eigen"
  | "counting"
  | "conditional_probability"
  | "discrete_variables"
  | "continuous_variables"
  | "transformations"
  | "sampling_distributions"
  | "one_sample_laws"
  | "two_sample_laws"
  | "hypothesis_testing"
  | "one_sample_tests"
  | "comparing_means"
  | "proportion_tests"
  | "variance_tests"
  | "errors_power"
  | "likelihood_ratio";

export type TrackId = "algebra" | "linear_algebra" | "statistics_probability";
export type DistributionFamily = "normal" | "t" | "chi_square" | "f";

export type Difficulty = "easy" | "medium" | "hard";

export type AnswerKind =
  | "number"
  | "expression"
  | "equation"
  | "ordered_pair"
  | "ordered_triple"
  | "interval"
  | "matrix"
  | "vector_direction"
  | "distribution"
  | "hypothesis_test";

export interface AnswerSpec {
  latex: string;
  kind: AnswerKind;
  valueSymbol?: string;
  interiorSupport?: { lower: number; upper: number };
  equivalentLatex?: string[];
  requiresFactoredForm?: boolean;
  forbiddenFactorLatex?: string;
  matrixShape?: { rows: number; cols: number };
  distribution?: { family: DistributionFamily; parameters: string[] };
  testResult?: { pValue: number; alpha: number };
}

export interface ReferenceTable {
  caption: string;
  headers: string[];
  rows: string[][];
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
  promptDescription?: string;
  referenceTable?: ReferenceTable;
  instruction: string;
  answer: AnswerSpec;
  hints: string[];
  workedSolution: string[];
  workedConclusion?: string;
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
  skipped?: boolean;
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
  statisticsReadinessVersion: 2;
  resetId: string;
  calibrationCompleted: boolean;
  calibrationIndex: number;
  mastery: Record<SkillId, number>;
  recentAttempts: Attempt[];
  recentSeeds: number[];
  recentPresentations: RecentPresentation[];
  preferredSkill: SkillId | null;
  preferredLinearSkill: SkillId | null;
  preferredStatisticsSkill: SkillId | null;
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

