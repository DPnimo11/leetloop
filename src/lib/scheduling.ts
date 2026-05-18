import type { AttemptResult } from "@/types/attempt";
import type { Problem, ProblemStatus } from "@/types/problem";
import { addDays } from "./dates";

export const BASE_REVIEW_INTERVAL_DAYS = {
  failed_reconstruct: 1,
  looked_solution: 2,
  needed_hint: 3,
  solved_buggy: 7,
  solved_clean: 14,
} as const satisfies Record<AttemptResult, number>;

const LEARNING_RESULTS = new Set<AttemptResult>([
  "failed_reconstruct",
  "looked_solution",
  "needed_hint",
]);

export function getCleanReviewIntervalDays(cleanStreak: number): number {
  if (cleanStreak <= 1) {
    return 14;
  }

  if (cleanStreak === 2) {
    return 30;
  }

  return 60;
}

export function getNextReviewIntervalDays(problem: Problem, result: AttemptResult): number {
  if (result !== "solved_clean") {
    return BASE_REVIEW_INTERVAL_DAYS[result];
  }

  return getCleanReviewIntervalDays(problem.cleanStreak + 1);
}

export function getStatusAfterAttempt(result: AttemptResult): ProblemStatus {
  return LEARNING_RESULTS.has(result) ? "learning" : "reviewing";
}

export function scheduleNextReview(
  problem: Problem,
  result: AttemptResult,
  attemptedAt = new Date(),
): Problem {
  const attemptedAtIso = attemptedAt.toISOString();
  const cleanStreak = result === "solved_clean" ? problem.cleanStreak + 1 : 0;
  const intervalDays =
    result === "solved_clean"
      ? getCleanReviewIntervalDays(cleanStreak)
      : BASE_REVIEW_INTERVAL_DAYS[result];

  return {
    ...problem,
    status: getStatusAfterAttempt(result),
    lastAttemptedAt: attemptedAtIso,
    nextReviewAt: addDays(attemptedAt, intervalDays).toISOString(),
    reviewCount: problem.reviewCount + 1,
    cleanStreak,
    lastResult: result,
    updatedAt: attemptedAtIso,
  };
}
