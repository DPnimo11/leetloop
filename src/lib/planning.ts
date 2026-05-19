import type { LeetLoopData } from "@/types/storage";
import type { Problem } from "@/types/problem";
import { addDays, isDueOnOrBefore, parseDate, startOfLocalDay, toLocalDateKey } from "./dates";

export const DAILY_PLAN_CAPACITY = 5;
export const UPCOMING_PLAN_DAYS = 14;

export type UpcomingPlanDay = {
  date: Date;
  dateKey: string;
  reviews: Problem[];
  newStarts: Problem[];
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
  const dailyCapacity = options.dailyCapacity ?? DAILY_PLAN_CAPACITY;
  const planDays = Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index);
    const reviews = getReviewsForDate(data.problems, date, today);

    return {
      date,
      dateKey: toLocalDateKey(date),
      load: reviews.length,
    };
  });
  const assignments = new Map<string, string>();
  const newProblems = sortByCreatedDate(data.problems.filter(isNewProblem));

  for (const problem of newProblems) {
    const day = planDays.find((item) => item.load < dailyCapacity);

    if (!day) {
      assignments.set(problem.id, "");
      continue;
    }

    day.load += 1;
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
  const dailyCapacity = options.dailyCapacity ?? DAILY_PLAN_CAPACITY;

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index);
    const reviews = getReviewsForDate(data.problems, date, today);
    const newStarts = getNewStartsForDate(data.problems, date);
    const load = reviews.length + newStarts.length;

    return {
      date,
      dateKey: toLocalDateKey(date),
      reviews,
      newStarts,
      load,
      capacity: dailyCapacity,
    };
  });
}

export function countUnscheduledNewProblems(data: LeetLoopData): number {
  return data.problems.filter((problem) => isNewProblem(problem) && !problem.nextReviewAt).length;
}
