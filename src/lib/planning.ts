import type { LeetLoopData } from "@/types/storage";
import type { Problem } from "@/types/problem";
import { addDays, parseDate, startOfLocalDay, toLocalDateKey } from "./dates";
import { hasExpiredSnooze, isProblemAvailable } from "./availability";
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
  newStarts: Problem[];
  completedCount: number;
  deferredCount: number;
  load: number;
  capacity: number;
};

type MutablePlanDay = {
  date: Date;
  dateKey: string;
  capacity: number;
  completedCount: number;
  deferredCount: number;
  committedSlots: number;
  newSlots: number;
  reviews: Problem[];
};

export type PlanDailyWorkOptions = {
  now?: Date;
  days?: number;
  dailyCapacity?: number;
  frozenTodayProblemIds?: ReadonlySet<string>;
};

function sortByCreatedDate(problems: Problem[]): Problem[] {
  return [...problems].sort((a, b) => {
    const aTime = parseDate(a.createdAt)?.getTime() ?? 0;
    const bTime = parseDate(b.createdAt)?.getTime() ?? 0;

    return aTime - bTime || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}

function getIdealReviewAt(problem: Problem): string | undefined {
  return problem.idealReviewAt ?? problem.nextReviewAt;
}

function sortByIdealReviewDate(problems: Problem[]): Problem[] {
  return [...problems].sort((a, b) => {
    const aTime = parseDate(getIdealReviewAt(a))?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = parseDate(getIdealReviewAt(b))?.getTime() ?? Number.MAX_SAFE_INTEGER;

    return aTime - bTime || a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
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
  return override ?? getDailyCapacityForDate(data, date);
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

export function getIdealReviewDateKey(problem: Problem): string | undefined {
  const date = parseDate(getIdealReviewAt(problem));
  return date ? toLocalDateKey(date) : undefined;
}

export function getReviewsForDate(problems: Problem[], date: Date, today = new Date()): Problem[] {
  const dateKey = toLocalDateKey(date);
  const todayKey = toLocalDateKey(today);

  return sortByIdealReviewDate(
    problems.filter((problem) => {
      if (!isReviewProblem(problem)) {
        return false;
      }

      if (!isProblemAvailable(problem, today)) {
        return false;
      }

      const plannedDateKey = getPlannedDateKey(problem);
      return dateKey === todayKey
        ? Boolean(plannedDateKey && plannedDateKey <= todayKey)
        : plannedDateKey === dateKey;
    }),
  );
}

export function getNewStartsForDate(problems: Problem[], date: Date, today = new Date()): Problem[] {
  const dateKey = toLocalDateKey(date);
  const todayKey = toLocalDateKey(today);

  return sortByCreatedDate(
    problems.filter((problem) => {
      if (!isNewProblem(problem)) {
        return false;
      }

      if (!isProblemAvailable(problem, today)) {
        return false;
      }

      const plannedDateKey = getPlannedDateKey(problem);
      return dateKey === todayKey
        ? Boolean(plannedDateKey && plannedDateKey <= todayKey)
        : plannedDateKey === dateKey;
    }),
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

export function getDeferredProblemIdsForDate(data: LeetLoopData, date: Date): Set<string> {
  const dateKey = toLocalDateKey(date);

  return new Set(
    data.problems
      .filter((problem) => problem.planSlotConsumedOn === dateKey)
      .map((problem) => problem.id),
  );
}

function createMutablePlanDay(
  data: LeetLoopData,
  date: Date,
  dailyCapacity?: number,
): MutablePlanDay {
  const completedIds = getCompletedProblemIdsForDate(data, date);
  const deferredIds = getDeferredProblemIdsForDate(data, date);

  return {
    date,
    dateKey: toLocalDateKey(date),
    capacity: resolveDailyCapacity(data, date, dailyCapacity),
    completedCount: completedIds.size,
    deferredCount: [...deferredIds].filter((problemId) => !completedIds.has(problemId)).length,
    committedSlots: 0,
    newSlots: 0,
    reviews: [],
  };
}

function remainingReviewCapacity(day: MutablePlanDay): number {
  return Math.max(
    0,
    day.capacity -
      day.completedCount -
      day.deferredCount -
      day.committedSlots -
      day.newSlots -
      day.reviews.length,
  );
}

/**
 * Assigns every review a concrete plan date without changing its ideal memory
 * date. Collisions use the minimum number of days required, then balance work
 * across those days. Older ideal dates are leveled first, so newer work cannot
 * leapfrog an older review.
 */
export function planDailyWork(
  data: LeetLoopData,
  options: PlanDailyWorkOptions = {},
): LeetLoopData {
  const now = options.now ?? new Date();
  const today = startOfLocalDay(now);
  const todayKey = toLocalDateKey(today);
  const newStartPlanningDays = options.days ?? UPCOMING_PLAN_DAYS;
  const freezeToday = options.frozenTodayProblemIds !== undefined;
  const requestedFrozenIds = options.frozenTodayProblemIds ?? new Set<string>();
  const frozenProblems = data.problems.filter(
    (problem) =>
      requestedFrozenIds.has(problem.id) &&
      isProblemAvailable(problem, now) &&
      (isReviewProblem(problem) || isNewProblem(problem)),
  );
  const frozenProblemIds = new Set(frozenProblems.map((problem) => problem.id));
  const frozenReviewAssignments = new Map<string, string>();
  const frozenNewAssignments = new Map<string, string>();

  for (const problem of frozenProblems) {
    const assignment = getPlannedDateKey(problem) === todayKey
      ? problem.nextReviewAt ?? today.toISOString()
      : today.toISOString();

    if (isReviewProblem(problem)) {
      frozenReviewAssignments.set(problem.id, assignment);
    } else {
      frozenNewAssignments.set(problem.id, assignment);
    }
  }

  const newProblems = sortByCreatedDate(
    data.problems.filter(
      (problem) =>
        !frozenProblemIds.has(problem.id) &&
        isNewProblem(problem) &&
        isProblemAvailable(problem, now),
    ),
  );
  const reviewProblems = sortByIdealReviewDate(
    data.problems.filter(
      (problem) =>
        !frozenProblemIds.has(problem.id) &&
        isReviewProblem(problem) &&
        isProblemAvailable(problem, now) &&
        Boolean(getIdealReviewDateKey(problem)),
    ),
  );
  const planDays: MutablePlanDay[] = [];

  function ensureDay(index: number): MutablePlanDay {
    while (planDays.length <= index) {
      const date = addDays(today, planDays.length);
      const day = createMutablePlanDay(data, date, options.dailyCapacity);

      if (freezeToday && day.dateKey === todayKey) {
        // A frozen Today queue owns every remaining slot, including intentional
        // empty space, so future work cannot backfill it during this replan.
        day.committedSlots = Math.max(
          0,
          day.capacity - day.completedCount - day.deferredCount,
        );
      }

      planDays.push(day);
    }

    return planDays[index]!;
  }

  for (let index = 0; index < newStartPlanningDays; index += 1) {
    ensureDay(index);
  }

  // Reserve configured new-start capacity before leveling reviews. The actual
  // problems are assigned after review placement so existing dates can remain
  // stable whenever they still fit.
  let unreservedNewCount = newProblems.length;
  const reservedNewStarts = getReservedNewStarts(data.settings);

  for (let index = 0; index < newStartPlanningDays && unreservedNewCount > 0; index += 1) {
    const day = ensureDay(index);
    const available = Math.max(
      0,
      day.capacity - day.completedCount - day.deferredCount - day.committedSlots,
    );
    const reserved = Math.min(reservedNewStarts, unreservedNewCount, available);
    day.newSlots = reserved;
    unreservedNewCount -= reserved;
  }

  const reviewGroups = new Map<string, Problem[]>();

  for (const problem of reviewProblems) {
    const idealDateKey = getIdealReviewDateKey(problem);
    if (!idealDateKey) {
      continue;
    }

    const startDateKey = idealDateKey < todayKey ? todayKey : idealDateKey;
    const group = reviewGroups.get(startDateKey) ?? [];
    group.push(problem);
    reviewGroups.set(startDateKey, group);
  }

  function levelReviews(): Map<string, string> {
    for (const day of planDays) {
      day.reviews = [];
    }

    const assignments = new Map(frozenReviewAssignments);

    for (const [startDateKey, group] of [...reviewGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      let startIndex = 0;
      while (ensureDay(startIndex).dateKey < startDateKey) {
        startIndex += 1;
      }

      let endIndex = startIndex;
      let availableCapacity = 0;

      while (availableCapacity < group.length) {
        availableCapacity += remainingReviewCapacity(ensureDay(endIndex));
        endIndex += 1;
      }

      const lastIndex = endIndex - 1;
      const targetCounts = new Map<number, number>();

      // Work out the same balanced day loads without assigning identities yet.
      // That lets an already-leveled review keep its concrete plan date when the
      // day still needs the same number of reviews.
      for (let assignedCount = 0; assignedCount < group.length; assignedCount += 1) {
        let selectedIndex = -1;
        let selectedUtilization = Number.POSITIVE_INFINITY;

        for (let index = startIndex; index <= lastIndex; index += 1) {
          const day = ensureDay(index);
          const targetedReviews = targetCounts.get(index) ?? 0;
          if (remainingReviewCapacity(day) - targetedReviews <= 0) {
            continue;
          }

          const utilization = day.capacity <= 0
            ? 1
            : (
                day.completedCount +
                day.deferredCount +
                day.committedSlots +
                day.newSlots +
                day.reviews.length +
                targetedReviews
              ) / day.capacity;
          if (utilization < selectedUtilization) {
            selectedIndex = index;
            selectedUtilization = utilization;
          }
        }

        targetCounts.set(selectedIndex, (targetCounts.get(selectedIndex) ?? 0) + 1);
      }

      const remainingTargets = new Map(targetCounts);
      const floatingProblems: Problem[] = [];

      function assignReview(problem: Problem, index: number): void {
        const selectedDay = ensureDay(index);
        selectedDay.reviews.push(problem);
        assignments.set(
          problem.id,
          getPlannedDateKey(problem) === selectedDay.dateKey
            ? problem.nextReviewAt ?? selectedDay.date.toISOString()
            : selectedDay.date.toISOString(),
        );
        remainingTargets.set(index, (remainingTargets.get(index) ?? 0) - 1);
      }

      for (const problem of group) {
        const currentDateKey = getPlannedDateKey(problem);
        const normalizedDateKey = currentDateKey && currentDateKey < todayKey
          ? todayKey
          : currentDateKey;
        let currentIndex = -1;

        if (normalizedDateKey) {
          for (let index = startIndex; index <= lastIndex; index += 1) {
            if (ensureDay(index).dateKey === normalizedDateKey) {
              currentIndex = index;
              break;
            }
          }
        }

        if (currentIndex >= 0 && (remainingTargets.get(currentIndex) ?? 0) > 0) {
          assignReview(problem, currentIndex);
        } else {
          floatingProblems.push(problem);
        }
      }

      for (const problem of floatingProblems) {
        let selectedIndex = -1;

        for (let index = startIndex; index <= lastIndex; index += 1) {
          if ((remainingTargets.get(index) ?? 0) > 0) {
            selectedIndex = index;
            break;
          }
        }

        assignReview(problem, selectedIndex);
      }
    }

    return assignments;
  }

  // The first pass protects the configured reserve while finding review load.
  // New starts then claim the earliest genuinely open slots, after which a
  // final review pass levels around those committed new-start assignments.
  let reviewAssignments = levelReviews();

  for (const day of planDays.slice(0, newStartPlanningDays)) {
    day.newSlots = 0;
  }

  const newAssignments = new Map(frozenNewAssignments);
  const floatingNewProblems: Problem[] = [];

  // Keep an existing new-start assignment when it still fits around the
  // provisional review schedule.
  for (const problem of newProblems) {
    const currentDateKey = getPlannedDateKey(problem);
    const normalizedDateKey = currentDateKey && currentDateKey < todayKey ? todayKey : currentDateKey;
    const day = normalizedDateKey
      ? planDays.slice(0, newStartPlanningDays).find((item) => item.dateKey === normalizedDateKey)
      : undefined;

    if (
      day &&
      day.completedCount +
        day.deferredCount +
        day.committedSlots +
        day.reviews.length +
        day.newSlots < day.capacity
    ) {
      newAssignments.set(
        problem.id,
        currentDateKey === normalizedDateKey
          ? problem.nextReviewAt ?? day.date.toISOString()
          : day.date.toISOString(),
      );
      day.newSlots += 1;
      continue;
    }

    floatingNewProblems.push(problem);
  }

  for (const day of planDays.slice(0, newStartPlanningDays)) {
    while (
      day.completedCount +
        day.deferredCount +
        day.committedSlots +
        day.reviews.length +
        day.newSlots < day.capacity &&
      floatingNewProblems.length > 0
    ) {
      const problem = floatingNewProblems.shift()!;
      newAssignments.set(problem.id, day.date.toISOString());
      day.newSlots += 1;
    }
  }

  reviewAssignments = levelReviews();

  let changed = false;
  const updatedAt = now.toISOString();
  const problems = data.problems.map((problem) => {
    const expiredSnooze = hasExpiredSnooze(problem, now);
    const staleConsumedSlot = Boolean(
      problem.planSlotConsumedOn && problem.planSlotConsumedOn < todayKey,
    );
    const currentProblem = expiredSnooze || staleConsumedSlot
      ? {
          ...problem,
          snoozedAt: expiredSnooze ? undefined : problem.snoozedAt,
          snoozedUntil: expiredSnooze ? undefined : problem.snoozedUntil,
          planSlotConsumedOn: staleConsumedSlot ? undefined : problem.planSlotConsumedOn,
        }
      : problem;

    if (currentProblem !== problem) {
      changed = true;
    }

    if (isReviewProblem(currentProblem)) {
      if (!isProblemAvailable(currentProblem, now)) {
        return currentProblem;
      }

      const idealReviewAt = getIdealReviewAt(currentProblem);
      const nextReviewAt = reviewAssignments.get(currentProblem.id) ?? currentProblem.nextReviewAt;

      if (
        currentProblem.idealReviewAt === idealReviewAt &&
        currentProblem.nextReviewAt === nextReviewAt &&
        currentProblem === problem
      ) {
        return currentProblem;
      }

      changed = true;
      return { ...currentProblem, idealReviewAt, nextReviewAt, updatedAt };
    }

    if (isNewProblem(currentProblem)) {
      if (!isProblemAvailable(currentProblem, now)) {
        return currentProblem;
      }

      const nextReviewAt = newAssignments.get(currentProblem.id);
      if (
        currentProblem.nextReviewAt === nextReviewAt &&
        currentProblem.idealReviewAt === undefined &&
        currentProblem === problem
      ) {
        return currentProblem;
      }

      changed = true;
      return { ...currentProblem, idealReviewAt: undefined, nextReviewAt, updatedAt };
    }

    return currentProblem;
  });

  if (!changed) {
    return data;
  }

  return { ...data, problems, updatedAt };
}

// Kept as a compatibility name for existing call sites while planning now
// levels both reviews and new starts.
export function planNewProblemStarts(
  data: LeetLoopData,
  options: Parameters<typeof planDailyWork>[1] = {},
): LeetLoopData {
  return planDailyWork(data, options);
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
  const plan: UpcomingPlanDay[] = [];

  for (let index = 0; index < days; index += 1) {
    const date = addDays(today, index);
    const reviews = getReviewsForDate(data.problems, date, now);
    const newStarts = getNewStartsForDate(data.problems, date, now);
    const completedIds = getCompletedProblemIdsForDate(data, date);
    const deferredIds = getDeferredProblemIdsForDate(data, date);
    const pendingIds = new Set([
      ...reviews.map((problem) => problem.id),
      ...newStarts.map((problem) => problem.id),
    ]);
    const completedCount = [...completedIds].filter((problemId) => !pendingIds.has(problemId)).length;
    const deferredCount = [...deferredIds].filter((problemId) => !completedIds.has(problemId)).length;
    const capacity = resolveDailyCapacity(data, date, options.dailyCapacity);

    plan.push({
      date,
      dateKey: toLocalDateKey(date),
      reviews,
      newStarts,
      completedCount,
      deferredCount,
      load: pendingIds.size + completedCount + deferredCount,
      capacity,
    });
  }

  return plan;
}

export function countUnscheduledNewProblems(data: LeetLoopData, now = new Date()): number {
  return data.problems.filter(
    (problem) => isNewProblem(problem) && isProblemAvailable(problem, now) && !problem.nextReviewAt,
  ).length;
}

export function getRefillCandidateProblems(data: LeetLoopData, date: Date): Problem[] {
  const dateKey = toLocalDateKey(date);

  return sortByPlanThenCreatedDate(
    data.problems.filter(
      (problem) =>
        isNewProblem(problem) &&
        isProblemAvailable(problem, date) &&
        getPlannedDateKey(problem) !== dateKey,
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
        ? { ...problem, nextReviewAt: todayIso, updatedAt }
        : problem,
    ),
    updatedAt,
  };
  const plannedData = planDailyWork(nextData, { now });
  const addedCount = plannedData.problems.filter(
    (problem) => candidateIds.has(problem.id) && getPlannedDateKey(problem) === todayKey,
  ).length;

  return { data: plannedData, addedCount };
}
