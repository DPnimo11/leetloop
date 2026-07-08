import type { Problem } from "@/types/problem";
import { parseDate } from "./dates";

export type ProblemAvailability = "available" | "snoozed" | "paused";

export function getProblemAvailability(
  problem: Problem,
  now = new Date(),
): ProblemAvailability {
  if (!problem.snoozedAt) {
    return "available";
  }

  if (!problem.snoozedUntil) {
    return "paused";
  }

  const snoozedUntil = parseDate(problem.snoozedUntil);
  return snoozedUntil && snoozedUntil.getTime() > now.getTime()
    ? "snoozed"
    : "available";
}

export function isProblemAvailable(problem: Problem, now = new Date()): boolean {
  return getProblemAvailability(problem, now) === "available";
}

export function hasExpiredSnooze(problem: Problem, now = new Date()): boolean {
  return Boolean(
    problem.snoozedAt &&
      problem.snoozedUntil &&
      getProblemAvailability(problem, now) === "available",
  );
}
