import type { LeetLoopData } from "@/types/storage";
import type { Problem } from "@/types/problem";
import { addDays, isDueOnOrBefore, parseDate, startOfLocalDay, toLocalDateKey } from "./dates";
import { DEFAULT_DAILY_TARGET, getDailyCapacityForDate, getDailyTarget, getExtraDailyCapacity } from "./settings";

export const DAILY_PLAN_CAPACITY = DEFAULT_DAILY_TARGET;
export const UPCOMING_PLAN_DAYS = 14;

export type UpcomingPlanDay = {
  date: Date;
  dateKey: string;
  reviews: Problem[];
  newStarts: Problem[];
  completedCount: number;
  load: number;
  capacity: number;
};

type PlanDay = {
  date: Date;
  dateKey: string;
  loadIds: Set<string>;
  capacity: number;
};

function sortByCreatedDate(problems: Problem[]): Problem[] {
  return [...problems].sort((a, b) => {
    const aTime = parseDate(a.createdAt)?.getTime() ?? 0;
    const bTime = parseDate(b.createdAt)?.getTime() ?? 0;

    return aTime - bTime || a.title.localeCompare(b.title);
  });
}

function sortByNextReviewDate(problems: Problem[]): Problem[] {
  return [...problems].sort((a, b) => {
    const aTime = parseDate(a.nextReviewAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = parseDate(b.nextReviewAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    return aTime - bTime || a.title.localeCompare(b.title);
  });
}

function sortByPlanThenCreatedDate(problems: Problem[]): Problem[] {
  return [...problems].sort((a, b) => {
    const aPlanTime = parseDate(a.nextReviewAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bPlanTime = parseDate(b.nextReviewAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const aCreatedTime = parseDate(a.createdAt)?.getTime() ?? 0;
    const bCreatedTime = parseDate(b.createdAt)?.getTime() ?? 0;

    return aPlanTime - bPlanTime || aCreatedTime - bCreatedTime || a.title.localeCompare(b.title);
  });
}

function resolveDailyCapacity(data: LeetLoopData, date: Date, override?: number): number {
  if (override !== undefined) {
    return override;
  }

  return getDailyCapacityForDate(data, date);
}

export function isReviewProblem(problem: Problem): boolean {
  return problem.status !== "new" && problem.status !== "retired";
}

export function isNewProblem(problem: Problem): boolean {
  return problem.status === "new";
}

export function getPlannedDateKey(problem: Problem): string | undefined {
  const date = parseDate(problem.nextReviewAt);
  return date ? toLocalDateKey(date) : undefined;
}

export function getReviewsForDate(problems: Problem[], date: Date, today = new Date()): Problem[] {
  const dateKey = toLocalDateKey(date);
  const todayKey = toLocalDateKey(today);
  const reviews = problems.filter((problem) => {
    if (!isReviewProblem(problem)) {
      return false;
    }

    return dateKey === todayKey
      ? isDueOnOrBefore(problem.nextReviewAt, today)
      : getPlannedDateKey(problem) === dateKey;
  });

  return sortByNextReviewDate(reviews);
}

export function getNewStartsForDate(problems: Problem[], date: Date): Problem[] {
  const dateKey = toLocalDateKey(date);
  return sortByCreatedDate(
    problems.filter((problem) => isNewProblem(problem) && getPlannedDateKey(problem) === dateKey),
  );
}

export function getCompletedProblemIdsForDate(data: LeetLoopData, date: Date): Set<string> {
  const dateKey = toLocalDateKey(date);
  const completedIds = new Set<string>();

  for (const attempt of data.attempts) {
    if (attempt.plannedForDate === dateKey) {
      completedIds.add(attempt.problemId);
    }
  }

  return completedIds;
}

export function planNewProblemStarts(
  data: LeetLoopData,
  options: {
    now?: Date;
    days?: number;
    dailyCapacity?: number;
  } = {},
): LeetLoopData {
  const now = options.now ?? new Date();
  const today = startOfLocalDay(now);
  const days = options.days ?? UPCOMING_PLAN_DAYS;
  const planDays: PlanDay[] = Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index);
    const reviews = getReviewsForDate(data.problems, date, today);
    const completedIds = getCompletedProblemIdsForDate(data, date);
    const capacity = resolveDailyCapacity(data, date, options.dailyCapacity);
    const loadIds = new Set<string>([
      ...reviews.map((problem) => problem.id),
      ...completedIds,
    ]);

    return {
      date,
      dateKey: toLocalDateKey(date),
      loadIds,
      capacity,
    };
  });
  const planDayByDateKey = new Map(planDays.map((day) => [day.dateKey, day]));
  const assignments = new Map<string, string>();
  const newProblems = sortByCreatedDate(data.problems.filter(isNewProblem));

  for (const problem of newProblems) {
    const currentDateKey = getPlannedDateKey(problem);

    if (!currentDateKey) {
      continue;
    }

    const day = planDayByDateKey.get(currentDateKey);

    if (!day || day.loadIds.size >= day.capacity) {
      assignments.set(problem.id, "");
      continue;
    }

    day.loadIds.add(problem.id);
    assignments.set(problem.id, problem.nextReviewAt ?? day.date.toISOString());
  }

  for (const problem of newProblems) {
    if (assignments.has(problem.id)) {
      continue;
    }

    const day = planDays.find((item) => item.loadIds.size < item.capacity);

    if (!day) {
      assignments.set(problem.id, "");
      continue;
    }

    day.loadIds.add(problem.id);
    assignments.set(problem.id, day.date.toISOString());
  }

  let changed = false;
  const updatedAt = now.toISOString();
  const problems = data.problems.map((problem) => {
    if (!isNewProblem(problem)) {
      return problem;
    }

    const assignedDate = assignments.get(problem.id);
    const nextReviewAt = assignedDate || undefined;

    if (problem.nextReviewAt === nextReviewAt) {
      return problem;
    }

    changed = true;
    return {
      ...problem,
      nextReviewAt,
      updatedAt,
    };
  });

  if (!changed) {
    return data;
  }

  return {
    ...data,
    problems,
    updatedAt,
  };
}

export function getUpcomingPlan(
  data: LeetLoopData,
  options: {
    now?: Date;
    days?: number;
    dailyCapacity?: number;
  } = {},
): UpcomingPlanDay[] {
  const now = options.now ?? new Date();
  const today = startOfLocalDay(now);
  const days = options.days ?? UPCOMING_PLAN_DAYS;

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index);
    const capacity = resolveDailyCapacity(data, date, options.dailyCapacity);
    const reviews = getReviewsForDate(data.problems, date, today);
    const newStarts = getNewStartsForDate(data.problems, date);
    const pendingIds = new Set<string>([
      ...reviews.map((problem) => problem.id),
      ...newStarts.map((problem) => problem.id),
    ]);
    const completedIds = getCompletedProblemIdsForDate(data, date);
    const completedCount = [...completedIds].filter((problemId) => !pendingIds.has(problemId)).length;
    const load = pendingIds.size + completedCount;

    return {
      date,
      dateKey: toLocalDateKey(date),
      reviews,
      newStarts,
      completedCount,
      load,
      capacity,
    };
  });
}

export function countUnscheduledNewProblems(data: LeetLoopData): number {
  return data.problems.filter((problem) => isNewProblem(problem) && !problem.nextReviewAt).length;
}

export function getRefillCandidateProblems(data: LeetLoopData, date: Date): Problem[] {
  const dateKey = toLocalDateKey(date);

  return sortByPlanThenCreatedDate(
    data.problems.filter(
      (problem) => isNewProblem(problem) && getPlannedDateKey(problem) !== dateKey,
    ),
  );
}

export function countRefillCandidateProblems(data: LeetLoopData, date: Date): number {
  return getRefillCandidateProblems(data, date).length;
}

export function refillTodayPlan(
  data: LeetLoopData,
  options: {
    now?: Date;
    count?: number;
  } = {},
): { data: LeetLoopData; addedCount: number } {
  const now = options.now ?? new Date();
  const today = startOfLocalDay(now);
  const todayKey = toLocalDateKey(today);
  const existingPlan = getUpcomingPlan(data, { now, days: 1 })[0];
  const pendingCount = (existingPlan?.reviews.length ?? 0) + (existingPlan?.newStarts.length ?? 0);
  const completedCount = existingPlan?.completedCount ?? 0;
  const dailyTarget = getDailyTarget(data.settings);
  const batchSize = Math.max(1, options.count ?? dailyTarget);
  const candidates = getRefillCandidateProblems(data, today).slice(0, batchSize);

  if (!candidates.length) {
    return { data, addedCount: 0 };
  }

  const candidateIds = new Set(candidates.map((problem) => problem.id));
  const desiredCapacity = completedCount + pendingCount + candidates.length;
  const extraCapacity = Math.max(
    getExtraDailyCapacity(data.settings, todayKey),
    Math.max(0, desiredCapacity - dailyTarget),
  );
  const todayIso = today.toISOString();
  const updatedAt = now.toISOString();
  const nextData: LeetLoopData = {
    ...data,
    settings: {
      ...data.settings,
      extraDailyCapacity: {
        ...data.settings.extraDailyCapacity,
        [todayKey]: extraCapacity,
      },
    },
    problems: data.problems.map((problem) =>
      candidateIds.has(problem.id)
        ? {
            ...problem,
            nextReviewAt: todayIso,
            updatedAt,
          }
        : problem,
    ),
    updatedAt,
  };
  const plannedData = planNewProblemStarts(nextData, { now });
  const addedCount = plannedData.problems.filter(
    (problem) => candidateIds.has(problem.id) && getPlannedDateKey(problem) === todayKey,
  ).length;

  return {
    data: plannedData,
    addedCount,
  };
}
