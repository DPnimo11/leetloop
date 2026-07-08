import type { Attempt, AttemptInput } from "@/types/attempt";
import { isAttemptResult } from "@/types/attempt";
import type { Problem, ProblemInput } from "@/types/problem";
import { isDifficulty, isPlatform, isProblemStatus } from "@/types/problem";
import type { ProblemTemplate } from "@/types/problem-set";
import type { LeetLoopData } from "@/types/storage";
import { scheduleNextReview } from "./scheduling";
import { isDueOnOrBefore, toLocalDateKey } from "./dates";
import { createProblemInputFromTemplate, getProblemLeetcodeSlug, normalizeLeetcodeSlug } from "./problemSets";
import { createDefaultSettings, normalizeSettings, updateSettings as updateSettingsInData } from "./settings";

export const STORAGE_VERSION = 1;
export const STORAGE_KEY = "leetloop:data:v1";

export type IdFactory = () => string;

export type MutationOptions = {
  now?: Date;
  idFactory?: IdFactory;
};

export function createEmptyData(now = new Date()): LeetLoopData {
  return {
    version: STORAGE_VERSION,
    problems: [],
    attempts: [],
    settings: createDefaultSettings(),
    updatedAt: now.toISOString(),
  };
}

function createId(prefix: string, idFactory?: IdFactory): string {
  if (idFactory) {
    return idFactory();
  }

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function touchData(data: LeetLoopData, now = new Date()): LeetLoopData {
  return {
    ...data,
    updatedAt: now.toISOString(),
  };
}

export function createProblem(
  input: ProblemInput,
  options: MutationOptions = {},
): Problem {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const url = input.url.trim();

  return {
    id: createId("problem", options.idFactory),
    title: input.title.trim(),
    url,
    platform: input.platform ?? "LeetCode",
    difficulty: input.difficulty,
    patterns: input.patterns ?? [],
    status: input.status ?? "new",
    notes: input.notes?.trim() || undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
    reviewCount: 0,
    cleanStreak: 0,
    leetcodeSlug: input.leetcodeSlug ?? normalizeLeetcodeSlug(url),
    sourceSetSlugs: input.sourceSetSlugs,
  };
}

export function addProblem(
  data: LeetLoopData,
  input: ProblemInput,
  options: MutationOptions = {},
): { data: LeetLoopData; problem: Problem } {
  const problem = createProblem(input, options);
  const nextData = touchData(
    {
      ...data,
      problems: [problem, ...data.problems],
    },
    options.now,
  );

  return { data: nextData, problem };
}

export function addProblemFromTemplate(
  data: LeetLoopData,
  template: ProblemTemplate,
  options: MutationOptions = {},
): { data: LeetLoopData; problem: Problem; added: boolean } {
  const existing = data.problems.find((problem) => getProblemLeetcodeSlug(problem) === template.titleSlug);

  if (existing) {
    return {
      data,
      problem: existing,
      added: false,
    };
  }

  const next = addProblem(data, createProblemInputFromTemplate(template), options);

  return {
    ...next,
    added: true,
  };
}

export function updateProblem(
  data: LeetLoopData,
  problemId: string,
  updates: Partial<ProblemInput>,
  now = new Date(),
): LeetLoopData {
  const nowIso = now.toISOString();
  const problems = data.problems.map((problem) =>
    problem.id === problemId ? applyProblemUpdates(problem, updates, nowIso) : problem,
  );

  return touchData({ ...data, problems }, now);
}

function applyProblemUpdates(
  problem: Problem,
  updates: Partial<ProblemInput>,
  updatedAt: string,
): Problem {
  const url = updates.url?.trim() ?? problem.url;

  return {
    ...problem,
    ...updates,
    title: updates.title?.trim() ?? problem.title,
    url,
    notes: updates.notes === undefined ? problem.notes : updates.notes.trim() || undefined,
    updatedAt,
    leetcodeSlug: updates.leetcodeSlug ?? (updates.url ? normalizeLeetcodeSlug(url) : problem.leetcodeSlug),
  };
}

export function deleteProblem(data: LeetLoopData, problemId: string, now = new Date()): LeetLoopData {
  return touchData(
    {
      ...data,
      problems: data.problems.filter((problem) => problem.id !== problemId),
      attempts: data.attempts.filter((attempt) => attempt.problemId !== problemId),
    },
    now,
  );
}

export function updateSettings(
  data: LeetLoopData,
  updates: Parameters<typeof updateSettingsInData>[1],
  now = new Date(),
): LeetLoopData {
  return updateSettingsInData(data, updates, now);
}

export function createAttempt(
  problemId: string,
  input: AttemptInput,
  options: MutationOptions = {},
): Attempt {
  const attemptedAt = input.attemptedAt ?? (options.now ?? new Date()).toISOString();

  return {
    id: createId("attempt", options.idFactory),
    problemId,
    attemptedAt,
    result: input.result,
    timeMinutes: input.timeMinutes,
    note: input.note?.trim() || undefined,
  };
}

function getAttemptPlannedForDate(problem: Problem, attemptedAt: Date): string | undefined {
  if (problem.status === "retired" || !isDueOnOrBefore(problem.nextReviewAt, attemptedAt)) {
    return undefined;
  }

  return toLocalDateKey(attemptedAt);
}

export function logAttempt(
  data: LeetLoopData,
  problemId: string,
  input: AttemptInput,
  options: MutationOptions = {},
): { data: LeetLoopData; attempt: Attempt; problem: Problem } {
  const problem = data.problems.find((item) => item.id === problemId);

  if (!problem) {
    throw new Error(`Problem not found: ${problemId}`);
  }

  const attempt = createAttempt(problemId, input, options);
  const attemptedAt = new Date(attempt.attemptedAt);
  const plannedForDate = getAttemptPlannedForDate(problem, attemptedAt);
  const countedAttempt: Attempt = plannedForDate ? { ...attempt, plannedForDate } : attempt;
  const scheduledProblem = scheduleNextReview(problem, input.result, attemptedAt);
  const problems = data.problems.map((item) => (item.id === problemId ? scheduledProblem : item));
  const nextData = touchData(
    {
      ...data,
      problems,
      attempts: [countedAttempt, ...data.attempts],
    },
    attemptedAt,
  );

  return {
    data: nextData,
    attempt: countedAttempt,
    problem: scheduledProblem,
  };
}

function normalizeProblem(value: unknown): Problem | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<Problem>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.url !== "string" ||
    !isDifficulty(candidate.difficulty) ||
    !isPlatform(candidate.platform) ||
    !isProblemStatus(candidate.status)
  ) {
    return undefined;
  }

  return {
    ...candidate,
    id: candidate.id,
    title: candidate.title,
    url: candidate.url,
    platform: candidate.platform,
    difficulty: candidate.difficulty,
    patterns: Array.isArray(candidate.patterns)
      ? candidate.patterns.filter((pattern): pattern is string => typeof pattern === "string" && pattern.length > 0)
      : [],
    status: candidate.status,
    idealReviewAt:
      typeof candidate.idealReviewAt === "string"
        ? candidate.idealReviewAt
        : candidate.status === "new"
          ? undefined
          : typeof candidate.nextReviewAt === "string"
            ? candidate.nextReviewAt
            : undefined,
    nextReviewAt: typeof candidate.nextReviewAt === "string" ? candidate.nextReviewAt : undefined,
    createdAt: candidate.createdAt ?? new Date().toISOString(),
    updatedAt: candidate.updatedAt ?? new Date().toISOString(),
    reviewCount: candidate.reviewCount ?? 0,
    cleanStreak: candidate.cleanStreak ?? 0,
  };
}

function normalizeAttempt(value: unknown): Attempt | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<Attempt>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.problemId !== "string" ||
    typeof candidate.attemptedAt !== "string" ||
    !isAttemptResult(candidate.result)
  ) {
    return undefined;
  }

  return {
    id: candidate.id,
    problemId: candidate.problemId,
    attemptedAt: candidate.attemptedAt,
    result: candidate.result,
    timeMinutes: candidate.timeMinutes,
    note: candidate.note,
    plannedForDate: typeof candidate.plannedForDate === "string" ? candidate.plannedForDate : undefined,
  };
}

export function parseLeetLoopData(raw: string): LeetLoopData {
  const parsed = JSON.parse(raw) as Partial<LeetLoopData>;

  if (parsed.version !== STORAGE_VERSION) {
    throw new Error("Unsupported LeetLoop data version.");
  }

  return {
    version: STORAGE_VERSION,
    problems: Array.isArray(parsed.problems)
      ? parsed.problems.map(normalizeProblem).filter((problem): problem is Problem => Boolean(problem))
      : [],
    attempts: Array.isArray(parsed.attempts)
      ? parsed.attempts.map(normalizeAttempt).filter((attempt): attempt is Attempt => Boolean(attempt))
      : [],
    settings: normalizeSettings(parsed.settings),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
  };
}

/**
 * Removes the legacy pre-cloud localStorage blob. App state now lives in
 * Supabase; this purges stale local data after a successful cloud load.
 */
export function clearLegacyLocalData(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function exportData(data: LeetLoopData): string {
  return JSON.stringify(data, null, 2);
}

export function importData(raw: string): LeetLoopData {
  return parseLeetLoopData(raw);
}
