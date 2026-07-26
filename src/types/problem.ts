import type { AttemptResult } from "./attempt";

export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export const PROBLEM_STATUSES = ["new", "learning", "reviewing", "retired"] as const;
export const PLATFORMS = ["LeetCode", "NeetCode", "Other"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];
export type Platform = (typeof PLATFORMS)[number];

export type Problem = {
  id: string;
  title: string;
  url: string;
  platform: Platform;
  difficulty: Difficulty;
  patterns: string[];
  primaryPattern?: string;
  status: ProblemStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastAttemptedAt?: string;
  idealReviewAt?: string;
  nextReviewAt?: string;
  snoozedAt?: string;
  snoozedUntil?: string;
  planSlotConsumedOn?: string;
  reviewCount: number;
  cleanStreak: number;
  lastResult?: AttemptResult;
  leetcodeSlug?: string;
  sourceSetSlugs?: string[];
};

export type ProblemInput = {
  title: string;
  url: string;
  platform?: Platform;
  difficulty: Difficulty;
  patterns?: string[];
  primaryPattern?: string;
  status?: ProblemStatus;
  notes?: string;
  leetcodeSlug?: string;
  sourceSetSlugs?: string[];
};

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && DIFFICULTIES.includes(value as Difficulty);
}

export function isProblemStatus(value: unknown): value is ProblemStatus {
  return typeof value === "string" && PROBLEM_STATUSES.includes(value as ProblemStatus);
}

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && PLATFORMS.includes(value as Platform);
}
