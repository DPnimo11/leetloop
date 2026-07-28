import type { SupabaseClient } from "@supabase/supabase-js";
import type { Attempt } from "@/types/attempt";
import { isAttemptResult } from "@/types/attempt";
import type { Problem } from "@/types/problem";
import { isDifficulty, isPlatform, isProblemStatus } from "@/types/problem";
import type { LeetLoopData, LeetLoopSettings } from "@/types/storage";
import { STORAGE_VERSION } from "@/lib/storage";
import { createDefaultSettings, normalizeSettings } from "@/lib/settings";
import { inferPrimaryPattern } from "@/lib/tags";

/**
 * Cloud persistence layer. Mirrors the localStorage model: the app keeps the
 * full LeetLoopData in memory and mutates it through the existing pure
 * functions; this module only loads it from / syncs it to Supabase Postgres.
 */

type ProblemRow = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  platform: string;
  difficulty: string;
  patterns: string[] | null;
  primary_pattern: string | null;
  status: string;
  notes: string | null;
  last_attempted_at: string | null;
  ideal_review_at: string | null;
  next_review_at: string | null;
  snoozed_at: string | null;
  snoozed_until: string | null;
  plan_slot_consumed_on: string | null;
  review_count: number | null;
  clean_streak: number | null;
  last_result: string | null;
  leetcode_slug: string | null;
  source_set_slugs: string[] | null;
  created_at: string;
  updated_at: string;
};

type AttemptRow = {
  id: string;
  user_id: string;
  problem_id: string;
  attempted_at: string;
  result: string;
  time_minutes: number | null;
  note: string | null;
  planned_for_date: string | null;
};

type SettingsRow = {
  user_id: string;
  daily_target: number | null;
  reserved_new_starts_per_day: number | null;
  extra_daily_capacity: Record<string, number> | null;
  priority_category: string | null;
};

// --- row <-> app mappers -----------------------------------------------------

function problemToRow(problem: Problem, userId: string): ProblemRow {
  return {
    id: problem.id,
    user_id: userId,
    title: problem.title,
    url: problem.url,
    platform: problem.platform,
    difficulty: problem.difficulty,
    patterns: problem.patterns,
    primary_pattern: problem.primaryPattern ?? null,
    status: problem.status,
    notes: problem.notes ?? null,
    last_attempted_at: problem.lastAttemptedAt ?? null,
    ideal_review_at: problem.idealReviewAt ?? null,
    next_review_at: problem.nextReviewAt ?? null,
    snoozed_at: problem.snoozedAt ?? null,
    snoozed_until: problem.snoozedUntil ?? null,
    plan_slot_consumed_on: problem.planSlotConsumedOn ?? null,
    review_count: problem.reviewCount,
    clean_streak: problem.cleanStreak,
    last_result: problem.lastResult ?? null,
    leetcode_slug: problem.leetcodeSlug ?? null,
    source_set_slugs: problem.sourceSetSlugs ?? null,
    created_at: problem.createdAt,
    updated_at: problem.updatedAt,
  };
}

function rowToProblem(row: ProblemRow): Problem | undefined {
  if (!isPlatform(row.platform) || !isDifficulty(row.difficulty) || !isProblemStatus(row.status)) {
    return undefined;
  }

  const patterns = Array.isArray(row.patterns) ? row.patterns : [];

  return {
    id: row.id,
    title: row.title,
    url: row.url,
    platform: row.platform,
    difficulty: row.difficulty,
    patterns,
    // Back-fill a concept for problems saved before primaryPattern existed.
    // Section-blind (priority only); persists on the problem's next sync.
    primaryPattern: row.primary_pattern ?? inferPrimaryPattern(patterns),
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAttemptedAt: row.last_attempted_at ?? undefined,
    idealReviewAt:
      row.ideal_review_at ?? (row.status === "new" ? undefined : row.next_review_at ?? undefined),
    nextReviewAt: row.next_review_at ?? undefined,
    snoozedAt: row.snoozed_at ?? undefined,
    snoozedUntil: row.snoozed_at ? row.snoozed_until ?? undefined : undefined,
    planSlotConsumedOn: row.plan_slot_consumed_on ?? undefined,
    reviewCount: row.review_count ?? 0,
    cleanStreak: row.clean_streak ?? 0,
    lastResult: isAttemptResult(row.last_result) ? row.last_result : undefined,
    leetcodeSlug: row.leetcode_slug ?? undefined,
    sourceSetSlugs: row.source_set_slugs ?? undefined,
  };
}

function attemptToRow(attempt: Attempt, userId: string): AttemptRow {
  return {
    id: attempt.id,
    user_id: userId,
    problem_id: attempt.problemId,
    attempted_at: attempt.attemptedAt,
    result: attempt.result,
    time_minutes: attempt.timeMinutes ?? null,
    note: attempt.note ?? null,
    planned_for_date: attempt.plannedForDate ?? null,
  };
}

function rowToAttempt(row: AttemptRow): Attempt | undefined {
  if (!isAttemptResult(row.result)) {
    return undefined;
  }

  return {
    id: row.id,
    problemId: row.problem_id,
    attemptedAt: row.attempted_at,
    result: row.result,
    timeMinutes: row.time_minutes ?? undefined,
    note: row.note ?? undefined,
    plannedForDate: row.planned_for_date ?? undefined,
  };
}

function settingsToRow(settings: LeetLoopSettings, userId: string): SettingsRow {
  return {
    user_id: userId,
    daily_target: settings.dailyTarget,
    reserved_new_starts_per_day: settings.reservedNewStartsPerDay,
    extra_daily_capacity: settings.extraDailyCapacity,
    priority_category: settings.priorityCategory ?? null,
  };
}

// --- load --------------------------------------------------------------------

export async function loadCloudData(
  supabase: SupabaseClient,
  userId: string,
): Promise<LeetLoopData> {
  const [problemsResult, attemptsResult, settingsResult] = await Promise.all([
    supabase.from("problems").select("*").eq("user_id", userId),
    supabase.from("attempts").select("*").eq("user_id", userId),
    supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  if (problemsResult.error) throw problemsResult.error;
  if (attemptsResult.error) throw attemptsResult.error;
  if (settingsResult.error) throw settingsResult.error;

  const problems = ((problemsResult.data ?? []) as ProblemRow[])
    .map(rowToProblem)
    .filter((problem): problem is Problem => Boolean(problem))
    // Newest first, mirroring the in-memory prepend convention.
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const attempts = ((attemptsResult.data ?? []) as AttemptRow[])
    .map(rowToAttempt)
    .filter((attempt): attempt is Attempt => Boolean(attempt))
    .sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime());

  const settingsRow = settingsResult.data as SettingsRow | null;
  const settings = settingsRow
    ? normalizeSettings({
        dailyTarget: settingsRow.daily_target ?? undefined,
        reservedNewStartsPerDay: settingsRow.reserved_new_starts_per_day ?? undefined,
        extraDailyCapacity: settingsRow.extra_daily_capacity ?? {},
        priorityCategory: settingsRow.priority_category ?? undefined,
      })
    : createDefaultSettings();

  return {
    version: STORAGE_VERSION,
    problems,
    attempts,
    settings,
    updatedAt: new Date().toISOString(),
  };
}

// --- sync (diff prev -> next, write only what changed) -----------------------

type Diff<T> = { upserts: T[]; deletes: string[] };

function diffById<T extends { id: string }>(prev: T[], next: T[]): Diff<T> {
  const prevMap = new Map(prev.map((item) => [item.id, item]));
  const nextMap = new Map(next.map((item) => [item.id, item]));

  const upserts: T[] = [];
  for (const [id, item] of nextMap) {
    const before = prevMap.get(id);
    if (!before || JSON.stringify(before) !== JSON.stringify(item)) {
      upserts.push(item);
    }
  }

  const deletes: string[] = [];
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) {
      deletes.push(id);
    }
  }

  return { upserts, deletes };
}

function settingsChanged(prev: LeetLoopSettings, next: LeetLoopSettings): boolean {
  return JSON.stringify(prev) !== JSON.stringify(next);
}

/**
 * Persist the delta between two LeetLoopData snapshots. Upserts happen
 * problems-before-attempts (FK), deletes happen attempts-before-problems.
 */
export async function syncCloudData(
  supabase: SupabaseClient,
  userId: string,
  prev: LeetLoopData,
  next: LeetLoopData,
): Promise<void> {
  const problemDiff = diffById(prev.problems, next.problems);
  const attemptDiff = diffById(prev.attempts, next.attempts);

  if (problemDiff.upserts.length > 0) {
    const { error } = await supabase
      .from("problems")
      .upsert(problemDiff.upserts.map((problem) => problemToRow(problem, userId)));
    if (error) throw error;
  }

  if (attemptDiff.upserts.length > 0) {
    const { error } = await supabase
      .from("attempts")
      .upsert(attemptDiff.upserts.map((attempt) => attemptToRow(attempt, userId)));
    if (error) throw error;
  }

  if (attemptDiff.deletes.length > 0) {
    const { error } = await supabase.from("attempts").delete().in("id", attemptDiff.deletes);
    if (error) throw error;
  }

  if (problemDiff.deletes.length > 0) {
    const { error } = await supabase.from("problems").delete().in("id", problemDiff.deletes);
    if (error) throw error;
  }

  if (settingsChanged(prev.settings, next.settings)) {
    const { error } = await supabase
      .from("settings")
      .upsert(settingsToRow(next.settings, userId));
    if (error) throw error;
  }
}
