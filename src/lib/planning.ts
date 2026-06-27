import type { LeetLoopData } from "@/types/storage";
import type { Problem } from "@/types/problem";
import { addDays, isDueOnOrBefore, parseDate, startOfLocalDay, toLocalDateKey } from "./dates";
import {
  DEFAULT_DAILY_TARGET,
  getDailyCapacityForDate,
  getDailyTarget,
  getExtraDailyCapacity,
  getReservedNewStarts,
} from "./settings";

export const DAILY_PLAN_CAPACITY = DEFAULT_DAILY_TARGET;
export const UPCOMING_PLAN_DAYS = 14;

export type UpcomingPlanDay = {
  date: Date;
  dateKey: string;
  reviews: Problem[];
  waitingReviews: Problem[];
  newStarts: Problem[];
  completedCount: number;
  load: number;
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

function getScheduledReviews(problems: Problem[]): Problem[] {
  return sortByNextReviewDate(
    problems.filter((problem) => isReviewProblem(problem) && getPlannedDateKey(problem)),
  );
}

function addReviewsDueThrough(
  scheduledReviews: Problem[],
  reviewQueue: Problem[],
  startIndex: number,
  dateKey: string,
): number {
  let nextIndex = startIndex;

  while (nextIndex < scheduledReviews.length) {
    const problem = scheduledReviews[nextIndex];
    const reviewDateKey = problem ? getPlannedDateKey(problem) : undefined;

    if (!problem || !reviewDateKey || reviewDateKey > dateKey) {
      break;
    }

    reviewQueue.push(problem);
    nextIndex += 1;
  }

  return nextIndex;
}

function getNewStartsForPlanDate(
  problems: Problem[],
  dateKey: string,
  todayKey: string,
): Problem[] {
  return sortByCreatedDate(
    problems.filter((problem) => {
      if (!isNewProblem(problem)) {
        return false;
      }

      const plannedDateKey = getPlannedDateKey(problem);

      return dateKey === todayKey
        ? Boolean(plannedDateKey && plannedDateKey <= todayKey)
        : plannedDateKey === dateKey;
    }),
  );
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
  const todayKey = toLocalDateKey(today);
  const days = options.days ?? UPCOMING_PLAN_DAYS;
  const planDays = Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index);

    return {
      date,
      dateKey: toLocalDateKey(date),
      capacity: resolveDailyCapacity(data, date, options.dailyCapacity),
    };
  });
  const planDayByDateKey = new Map(planDays.map((day) => [day.dateKey, day]));
  const assignments = new Map<string, string>();
  const newProblems = sortByCreatedDate(data.problems.filter(isNewProblem));
  const floatingNewProblems: Problem[] = [];
  const lockedNewProblemsByDate = new Map<string, Problem[]>();

  for (const problem of newProblems) {
    const currentDateKey = getPlannedDateKey(problem);

    if (!currentDateKey) {
      floatingNewProblems.push(problem);
      continue;
    }

    const normalizedDateKey = currentDateKey < todayKey ? todayKey : currentDateKey;
    const day = planDayByDateKey.get(normalizedDateKey);

    if (!day) {
      assignments.set(problem.id, "");
      continue;
    }

    const lockedProblems = lockedNewProblemsByDate.get(normalizedDateKey) ?? [];
    lockedProblems.push(problem);
    lockedNewProblemsByDate.set(normalizedDateKey, lockedProblems);
  }

  const scheduledReviews = getScheduledReviews(data.problems);
  const reviewQueue: Problem[] = [];
  const reservedNewStarts = getReservedNewStarts(data.settings);
  let reviewIndex = 0;

  for (const day of planDays) {
    reviewIndex = addReviewsDueThrough(
      scheduledReviews,
      reviewQueue,
      reviewIndex,
      day.dateKey,
    );

    const completedCount = getCompletedProblemIdsForDate(data, day.date).size;
    const remainingCapacity = Math.max(0, day.capacity - completedCount);
    const lockedProblems = lockedNewProblemsByDate.get(day.dateKey) ?? [];
    const reserveCandidateCount =
      completedCount > 0
        ? lockedProblems.length
        : lockedProblems.length + floatingNewProblems.length;
    const reservedCapacity = Math.min(
      reservedNewStarts,
      reserveCandidateCount,
      remainingCapacity,
    );
    const reviewCapacity = Math.max(0, remainingCapacity - reservedCapacity);
    const plannedReviewCount = Math.min(reviewQueue.length, reviewCapacity);
    reviewQueue.splice(0, plannedReviewCount);

    const newStartCapacity = remainingCapacity - plannedReviewCount;
    const preservedLocked = lockedProblems.slice(0, newStartCapacity);
    const displacedLocked = lockedProblems.slice(newStartCapacity);

    for (const problem of preservedLocked) {
      const currentDateKey = getPlannedDateKey(problem);
      assignments.set(
        problem.id,
        currentDateKey === day.dateKey
          ? problem.nextReviewAt ?? day.date.toISOString()
          : day.date.toISOString(),
      );
    }

    const remainingNewStartCapacity = newStartCapacity - preservedLocked.length;
    const newlyAssigned = floatingNewProblems.splice(0, remainingNewStartCapacity);

    for (const problem of newlyAssigned) {
      assignments.set(problem.id, day.date.toISOString());
    }

    if (displacedLocked.length) {
      floatingNewProblems.unshift(...displacedLocked);
    }
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
  const todayKey = toLocalDateKey(today);
  const days = options.days ?? UPCOMING_PLAN_DAYS;
  const scheduledReviews = getScheduledReviews(data.problems);
  const reviewQueue: Problem[] = [];
  const plan: UpcomingPlanDay[] = [];
  const reservedNewStarts = getReservedNewStarts(data.settings);
  let reviewIndex = 0;

  for (let index = 0; index < days; index += 1) {
    const date = addDays(today, index);
    const dateKey = toLocalDateKey(date);
    const capacity = resolveDailyCapacity(data, date, options.dailyCapacity);
    reviewIndex = addReviewsDueThrough(
      scheduledReviews,
      reviewQueue,
      reviewIndex,
      dateKey,
    );

    const allNewStarts = getNewStartsForPlanDate(data.problems, dateKey, todayKey);
    const completedIds = getCompletedProblemIdsForDate(data, date);
    const pendingCandidateIds = new Set<string>([
      ...reviewQueue.map((problem) => problem.id),
      ...allNewStarts.map((problem) => problem.id),
    ]);
    const completedCount = [...completedIds].filter(
      (problemId) => !pendingCandidateIds.has(problemId),
    ).length;
    const remainingCapacity = Math.max(0, capacity - completedCount);
    const reservedCapacity = Math.min(
      reservedNewStarts,
      allNewStarts.length,
      remainingCapacity,
    );
    const reviewCapacity = Math.max(0, remainingCapacity - reservedCapacity);
    const reviews = reviewQueue.splice(0, reviewCapacity);
    const newStartCapacity = remainingCapacity - reviews.length;
    const newStarts = allNewStarts.slice(0, newStartCapacity);
    const waitingReviews = [...reviewQueue];
    const pendingIds = new Set<string>([
      ...reviews.map((problem) => problem.id),
      ...newStarts.map((problem) => problem.id),
    ]);
    const load = pendingIds.size + completedCount;

    plan.push({
      date,
      dateKey,
      reviews,
      waitingReviews,
      newStarts,
      completedCount,
      load,
      capacity,
    });
  }

  return plan;
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
