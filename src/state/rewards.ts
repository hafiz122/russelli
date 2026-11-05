import type { LocalProgressV1, QuestionReward } from "../types";

export type RewardEvent =
  | { type: "answer"; questionId: string; parseable: boolean; correct: boolean; solutionRevealed?: boolean }
  | { type: "skip" | "reveal_solution"; questionId: string };

export function applyRewardEvent(progress: LocalProgressV1, event: RewardEvent): LocalProgressV1 {
  if (event.type === "answer" && !event.parseable) return progress;

  const previous = progress.rewardQuestion?.questionId === event.questionId ? progress.rewardQuestion : null;
  if (previous?.status === "awarded" || previous?.status === "skipped") return progress;

  let status: QuestionReward["status"] = previous?.status ?? "eligible";
  if (event.type === "skip") status = "skipped";
  else if (event.type === "reveal_solution" || (event.type === "answer" && event.solutionRevealed)) status = "solution_revealed";

  if (event.type === "answer" && event.correct && status === "solution_revealed") {
    return { ...progress, rewardQuestion: { questionId: event.questionId, status } };
  }

  if (event.type !== "answer" || !event.correct || status !== "eligible") {
    return { ...progress, currentStreak: 0, rewardQuestion: { questionId: event.questionId, status } };
  }

  const currentStreak = Math.min(Number.MAX_SAFE_INTEGER, progress.currentStreak + 1);
  const points = 10 + (currentStreak % 5 === 0 ? 10 : 0);
  return {
    ...progress,
    totalPoints: Math.min(Number.MAX_SAFE_INTEGER, progress.totalPoints + points),
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
    rewardQuestion: { questionId: event.questionId, status: "awarded" }
  };
}
