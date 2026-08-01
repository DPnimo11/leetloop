import { describe, expect, it } from "vitest";
import type { Attempt } from "@/types/attempt";
import type { Problem } from "@/types/problem";
import type { LeetLoopData } from "@/types/storage";
import { createDefaultSettings } from "./settings";
import { addDays, startOfLocalDay, toLocalDateKey } from "./dates";
import {
  DAILY_PLAN_CAPACITY,
  getAvailableNewStartCategories,
  getCompletedNewProblemIdsForDate,
  getUpcomingPlan,
  planNewProblemStarts,
  refillTodayPlan,
} from "./planning";
import { addProblem, logAttempt, snoozeProblem } from "./storage";

const now = new Date("2026-05-19T12:00:00.000Z");

function problem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: "problem_1",
    title: "Two Sum",
    url: "https://leetcode.com/problems/two-sum/",
    platform: "LeetCode",
    difficulty: "Easy",
    patterns: ["Arrays"],
    status: "new",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    reviewCount: 0,
    cleanStreak: 0,
    ...overrides,
  };
}

function data(problems: Problem[], attempts: Attempt[] = []): LeetLoopData {
  return {
    version: 1,
    problems,
    attempts,
    settings: createDefaultSettings(),
    updatedAt: now.toISOString(),
  };
}

describe("planNewProblemStarts", () => {
  it("fills today's open capacity with new problems after due reviews", () => {
    const planned = planNewProblemStarts(
      data([
        problem({
          id: "review_1",
          status: "reviewing",
          nextReviewAt: "2026-05-19T00:00:00.000Z",
        }),
        problem({
          id: "review_2",
          status: "learning",
          nextReviewAt: "2026-05-19T00:00:00.000Z",
        }),
        ...Array.from({ length: 5 }, (_, index) =>
          problem({
            id: `new_${index}`,
            title: `New ${index}`,
            createdAt: `2026-05-0${index + 1}T00:00:00.000Z`,
          }),
        ),
      ]),
      { now },
    );

    const upcoming = getUpcomingPlan(planned, { now });

    expect(upcoming[0]?.reviews).toHaveLength(2);
    expect(upcoming[0]?.newStarts).toHaveLength(DAILY_PLAN_CAPACITY - 2);
    expect(upcoming[1]?.newStarts).toHaveLength(2);
  });

  it("balances a review collision while reserving a new-start slot", () => {
    const reviews = Array.from({ length: DAILY_PLAN_CAPACITY }, (_, index) =>
      problem({
        id: `review_${index}`,
        status: "reviewing",
        nextReviewAt: "2026-05-19T00:00:00.000Z",
      }),
    );
    const planned = planNewProblemStarts(
      data([
        ...reviews,
        problem({
          id: "new_1",
          title: "New 1",
        }),
      ]),
      { now },
    );
    const upcoming = getUpcomingPlan(planned, { now });

    expect(upcoming[0]?.reviews).toHaveLength(2);
    expect(upcoming[0]?.newStarts.map((item) => item.id)).toEqual(["new_1"]);
    expect(upcoming[1]?.reviews).toHaveLength(3);
    expect(upcoming[0]?.load).toBe(3);
    expect(upcoming[1]?.load).toBe(3);
  });

  it("moves extra existing new starts when a review backlog fills the day", () => {
    const reviews = Array.from({ length: 13 }, (_, index) =>
      problem({
        id: `review_${index}`,
        status: "reviewing",
        nextReviewAt: "2026-05-19T00:00:00.000Z",
      }),
    );
    const plannedNewStarts = Array.from({ length: 4 }, (_, index) =>
      problem({
        id: `new_${index}`,
        title: `New ${index}`,
        nextReviewAt: "2026-05-19T00:00:00.000Z",
      }),
    );
    const planned = planNewProblemStarts(data([...reviews, ...plannedNewStarts]), {
      now,
    });
    const upcoming = getUpcomingPlan(planned, { now });

    expect(upcoming[0]?.reviews).toHaveLength(DAILY_PLAN_CAPACITY - 1);
    expect(upcoming[0]?.newStarts).toHaveLength(1);
    expect(upcoming.slice(0, 4).reduce((total, day) => total + day.reviews.length, 0)).toBe(13);
    expect(upcoming.every((day) => day.load <= day.capacity)).toBe(true);
  });

  it("splits an overloaded review day evenly across the minimum number of days", () => {
    const planned = planNewProblemStarts(
      data(
        Array.from({ length: DAILY_PLAN_CAPACITY + 1 }, (_, index) =>
          problem({
            id: `review_${index}`,
            status: "reviewing",
            nextReviewAt: "2026-05-19T00:00:00.000Z",
          }),
        ),
      ),
      { now },
    );
    const upcoming = getUpcomingPlan(planned, { now });

    expect(upcoming[0]?.reviews).toHaveLength(3);
    expect(upcoming[0]?.newStarts).toHaveLength(0);
    expect(upcoming[1]?.reviews).toHaveLength(3);
    expect("waitingReviews" in upcoming[0]!).toBe(false);
  });

  it("replans unfinished work at rollover without exceeding capacity or reserved new slots", () => {
    const todayDate = startOfLocalDay(now);
    const yesterday = addDays(todayDate, -1).toISOString();
    const today = todayDate.toISOString();
    const staleData = {
      ...data([
        ...Array.from({ length: 3 }, (_, index) =>
          problem({
            id: `leftover_${index}`,
            status: "reviewing",
            idealReviewAt: yesterday,
            nextReviewAt: yesterday,
          }),
        ),
        ...Array.from({ length: 5 }, (_, index) =>
          problem({
            id: `today_${index}`,
            status: "reviewing",
            idealReviewAt: today,
            nextReviewAt: today,
          }),
        ),
        problem({ id: "new_1", title: "New 1" }),
      ]),
      settings: {
        dailyTarget: 5,
        reservedNewStartsPerDay: 1,
        extraDailyCapacity: {},
      },
    };

    const staleToday = getUpcomingPlan(staleData, { now, days: 1 })[0];
    expect(staleToday?.reviews).toHaveLength(8);
    expect(staleToday?.capacity).toBe(5);

    const replanned = planNewProblemStarts(staleData, { now });
    const upcoming = getUpcomingPlan(replanned, { now, days: 2 });

    expect(upcoming[0]?.load).toBe(5);
    expect(upcoming[0]?.reviews).toHaveLength(4);
    expect(upcoming[0]?.newStarts.map((item) => item.id)).toEqual(["new_1"]);
    expect(
      upcoming[0]?.reviews
        .filter((item) => item.id.startsWith("leftover_"))
        .map((item) => item.id),
    ).toHaveLength(3);
    expect(upcoming[1]?.reviews).toHaveLength(4);
  });

  it("supports reviews-first planning when the reserve is zero", () => {
    const reviews = Array.from({ length: DAILY_PLAN_CAPACITY }, (_, index) =>
      problem({
        id: `review_${index}`,
        status: "reviewing",
        nextReviewAt: "2026-05-19T00:00:00.000Z",
      }),
    );
    const planned = planNewProblemStarts(
      {
        ...data([...reviews, problem({ id: "new_1", title: "New 1" })]),
        settings: {
          ...createDefaultSettings(),
          reservedNewStartsPerDay: 0,
        },
      },
      { now },
    );
    const upcoming = getUpcomingPlan(planned, { now });

    expect(upcoming[0]?.reviews).toHaveLength(DAILY_PLAN_CAPACITY);
    expect(upcoming[0]?.newStarts).toHaveLength(0);
    expect(upcoming[1]?.newStarts.map((item) => item.id)).toEqual(["new_1"]);
  });

  it("uses the only slot for a new start when target and reserve are one", () => {
    const planned = planNewProblemStarts(
      {
        ...data([
          problem({
            id: "review_1",
            status: "reviewing",
            nextReviewAt: "2026-05-19T00:00:00.000Z",
          }),
          problem({
            id: "review_2",
            status: "reviewing",
            nextReviewAt: "2026-05-19T00:00:00.000Z",
          }),
          problem({ id: "new_1", title: "New 1" }),
        ]),
        settings: {
          dailyTarget: 1,
          reservedNewStartsPerDay: 1,
          extraDailyCapacity: {},
        },
      },
      { now },
    );
    const upcoming = getUpcomingPlan(planned, { now, days: 3 });

    expect(upcoming[0]?.reviews).toHaveLength(0);
    expect(upcoming[0]?.newStarts.map((item) => item.id)).toEqual(["new_1"]);
    expect(upcoming[1]?.reviews).toHaveLength(1);
    expect(upcoming[2]?.reviews).toHaveLength(1);
  });

  it("reserves multiple new-start slots when configured", () => {
    const reviews = Array.from({ length: DAILY_PLAN_CAPACITY }, (_, index) =>
      problem({
        id: `review_${index}`,
        status: "reviewing",
        nextReviewAt: "2026-05-19T00:00:00.000Z",
      }),
    );
    const planned = planNewProblemStarts(
      {
        ...data([
          ...reviews,
          problem({ id: "new_1", title: "New 1" }),
          problem({ id: "new_2", title: "New 2" }),
        ]),
        settings: {
          ...createDefaultSettings(),
          reservedNewStartsPerDay: 2,
        },
      },
      { now },
    );
    const upcoming = getUpcomingPlan(planned, { now });

    expect(upcoming[0]?.reviews).toHaveLength(2);
    expect(upcoming[0]?.newStarts).toHaveLength(2);
    expect(upcoming[1]?.reviews).toHaveLength(3);
  });

  it("levels a future review collision without changing ideal due dates", () => {
    const idealReviewDate = "2026-05-20T12:00:00.000Z";
    const reviews = Array.from({ length: DAILY_PLAN_CAPACITY + 1 }, (_, index) =>
      problem({
        id: `review_${index}`,
        status: "reviewing",
        nextReviewAt: idealReviewDate,
      }),
    );
    const planned = planNewProblemStarts(
      data([
        ...reviews,
        problem({
          id: "new_tomorrow",
          title: "New Tomorrow",
          nextReviewAt: idealReviewDate,
        }),
      ]),
      { now },
    );
    const upcoming = getUpcomingPlan(planned, { now, days: 3 });

    expect(upcoming[1]?.reviews).toHaveLength(3);
    expect(upcoming[1]?.newStarts.map((item) => item.id)).toEqual(["new_tomorrow"]);
    expect(upcoming[2]?.reviews).toHaveLength(3);
    expect(
      planned.problems
        .filter((item) => item.id.startsWith("review_"))
        .every((item) => item.idealReviewAt === idealReviewDate),
    ).toBe(true);
    expect(
      planned.problems
        .filter((item) => item.id.startsWith("review_"))
        .some((item) => item.nextReviewAt !== idealReviewDate),
    ).toBe(true);
  });

  it("assigns review overflow beyond the 14-day preview instead of leaving it waiting", () => {
    const planned = planNewProblemStarts(
      {
        ...data(
          Array.from({ length: 16 }, (_, index) =>
            problem({
              id: `review_${index}`,
              status: "reviewing",
              nextReviewAt: "2026-05-19T00:00:00.000Z",
            }),
          ),
        ),
        settings: {
          dailyTarget: 1,
          reservedNewStartsPerDay: 0,
          extraDailyCapacity: {},
        },
      },
      { now },
    );
    const preview = getUpcomingPlan(planned, { now });
    const plannedDateKeys = planned.problems.map((item) => item.nextReviewAt?.slice(0, 10));

    expect(preview.reduce((total, day) => total + day.reviews.length, 0)).toBe(14);
    expect(plannedDateKeys).toContain("2026-06-03");
    expect(planned.problems.every((item) => Boolean(item.nextReviewAt))).toBe(true);
  });

  it("does not let a newer ideal date leapfrog older leveled work", () => {
    const planned = planNewProblemStarts(
      {
        ...data([
          problem({
            id: "older_1",
            status: "reviewing",
            nextReviewAt: "2026-05-19T00:00:00.000Z",
          }),
          problem({
            id: "older_2",
            status: "reviewing",
            nextReviewAt: "2026-05-19T00:00:00.000Z",
          }),
          problem({
            id: "newer",
            status: "reviewing",
            nextReviewAt: "2026-05-20T00:00:00.000Z",
          }),
        ]),
        settings: {
          dailyTarget: 1,
          reservedNewStartsPerDay: 0,
          extraDailyCapacity: {},
        },
      },
      { now },
    );
    const upcoming = getUpcomingPlan(planned, { now, days: 3 });

    expect(upcoming[0]?.reviews[0]?.id).toBe("older_1");
    expect(upcoming[1]?.reviews[0]?.id).toBe("older_2");
    expect(upcoming[2]?.reviews[0]?.id).toBe("newer");
  });

  it("keeps a snoozed today's slot consumed without backfilling the queue", () => {
    const initial = {
      ...data(
        Array.from({ length: 3 }, (_, index) =>
          problem({
            id: `review_${index}`,
            status: "reviewing",
            nextReviewAt: "2026-05-19T00:00:00.000Z",
          }),
        ),
      ),
      settings: {
        dailyTarget: 2,
        reservedNewStartsPerDay: 0,
        extraDailyCapacity: {},
      },
    };
    const planned = planNewProblemStarts(initial, { now });
    const snoozedId = getUpcomingPlan(planned, { now, days: 1 })[0]?.reviews[0]?.id;
    const snoozed = snoozeProblem(planned, snoozedId ?? "review_0", {
      now,
      until: new Date("2026-05-22T00:00:00.000Z"),
      consumePlanSlot: true,
    });
    const replanned = planNewProblemStarts(snoozed, { now });
    const todayPlan = getUpcomingPlan(replanned, { now, days: 1 })[0];

    expect(todayPlan?.reviews).toHaveLength(1);
    expect(todayPlan?.deferredCount).toBe(1);
    expect(todayPlan?.load).toBe(2);
    expect(todayPlan?.reviews.some((item) => item.id === snoozedId)).toBe(false);
  });

  it("lets reviews use capacity reserved for a snoozed new problem", () => {
    const pausedNew = snoozeProblem(
      data([
        problem({
          id: "review_1",
          status: "reviewing",
          nextReviewAt: "2026-05-19T00:00:00.000Z",
        }),
        problem({ id: "new_1" }),
      ]),
      "new_1",
      { now },
    );
    const planned = planNewProblemStarts(
      {
        ...pausedNew,
        settings: {
          dailyTarget: 1,
          reservedNewStartsPerDay: 1,
          extraDailyCapacity: {},
        },
      },
      { now },
    );
    const todayPlan = getUpcomingPlan(planned, { now, days: 1 })[0];

    expect(todayPlan?.reviews.map((item) => item.id)).toEqual(["review_1"]);
    expect(todayPlan?.newStarts).toHaveLength(0);
  });

  it("automatically wakes an expired snooze and preserves its ideal date", () => {
    const idealReviewAt = "2026-05-19T00:00:00.000Z";
    const snoozed = snoozeProblem(
      data([
        problem({
          id: "review_1",
          status: "reviewing",
          idealReviewAt,
          nextReviewAt: idealReviewAt,
        }),
      ]),
      "review_1",
      {
        now,
        until: new Date("2026-05-20T00:00:00.000Z"),
      },
    );
    const wakeTime = new Date("2026-05-20T12:00:00.000Z");
    const planned = planNewProblemStarts(snoozed, { now: wakeTime });
    const review = planned.problems[0];

    expect(review?.snoozedAt).toBeUndefined();
    expect(review?.snoozedUntil).toBeUndefined();
    expect(review?.idealReviewAt).toBe(idealReviewAt);
    expect(review?.nextReviewAt?.slice(0, 10)).toBe("2026-05-20");
  });

  it("clears new problems that do not fit inside the planning window", () => {
    const planned = planNewProblemStarts(
      data(
        Array.from({ length: DAILY_PLAN_CAPACITY + 1 }, (_, index) =>
          problem({
            id: `new_${index}`,
            title: `New ${index}`,
          }),
        ),
      ),
      { now, days: 1 },
    );

    const scheduledCount = planned.problems.filter((item) => item.nextReviewAt).length;
    const unscheduledCount = planned.problems.filter((item) => !item.nextReviewAt).length;

    expect(scheduledCount).toBe(DAILY_PLAN_CAPACITY);
    expect(unscheduledCount).toBe(1);
  });

  it("does not backfill today's queue after a planned new problem is logged", () => {
    const planned = planNewProblemStarts(
      data(
        Array.from({ length: DAILY_PLAN_CAPACITY + 2 }, (_, index) =>
          problem({
            id: `new_${index}`,
            title: `New ${index}`,
            createdAt: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
          }),
        ),
      ),
      { now },
    );
    const loggedProblem = getUpcomingPlan(planned, { now })[0]?.newStarts[0];

    expect(loggedProblem).toBeDefined();

    const replanned = planNewProblemStarts(
      data(
        planned.problems.map((item) =>
          item.id === loggedProblem?.id
            ? {
                ...item,
                status: "reviewing",
                lastAttemptedAt: now.toISOString(),
                nextReviewAt: "2026-06-02T12:00:00.000Z",
                reviewCount: 1,
                cleanStreak: 1,
                lastResult: "solved_clean",
              }
            : item,
        ),
        [
          {
            id: "attempt_1",
            problemId: loggedProblem?.id ?? "new_0",
            attemptedAt: now.toISOString(),
            result: "solved_clean",
            plannedForDate: "2026-05-19",
          },
        ],
      ),
      { now },
    );
    const upcoming = getUpcomingPlan(replanned, { now });

    expect(upcoming[0]?.newStarts).toHaveLength(DAILY_PLAN_CAPACITY - 1);
    expect(upcoming[0]?.completedCount).toBe(1);
    expect(upcoming[0]?.load).toBe(DAILY_PLAN_CAPACITY);
    expect(upcoming[1]?.newStarts).toHaveLength(2);
  });

  it("does not backfill today's queue after a due review is logged", () => {
    const planned = planNewProblemStarts(
      data([
        problem({
          id: "review_1",
          status: "reviewing",
          nextReviewAt: "2026-05-19T00:00:00.000Z",
        }),
        problem({
          id: "review_2",
          status: "reviewing",
          nextReviewAt: "2026-05-19T00:00:00.000Z",
        }),
        ...Array.from({ length: 5 }, (_, index) =>
          problem({
            id: `new_${index}`,
            title: `New ${index}`,
            createdAt: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
          }),
        ),
      ]),
      { now },
    );

    const replanned = planNewProblemStarts(
      data(
        planned.problems.map((item) =>
          item.id === "review_1"
            ? {
                ...item,
                lastAttemptedAt: now.toISOString(),
                idealReviewAt: "2026-06-02T12:00:00.000Z",
                nextReviewAt: "2026-06-02T12:00:00.000Z",
                reviewCount: 1,
                cleanStreak: 1,
                lastResult: "solved_clean",
              }
            : item,
        ),
        [
          {
            id: "attempt_1",
            problemId: "review_1",
            attemptedAt: now.toISOString(),
            result: "solved_clean",
            plannedForDate: "2026-05-19",
          },
        ],
      ),
      { now },
    );
    const upcoming = getUpcomingPlan(replanned, { now });

    expect(upcoming[0]?.reviews.map((item) => item.id)).toEqual(["review_2"]);
    expect(upcoming[0]?.newStarts).toHaveLength(DAILY_PLAN_CAPACITY - 2);
    expect(upcoming[0]?.completedCount).toBe(1);
    expect(upcoming[0]?.load).toBe(DAILY_PLAN_CAPACITY);
    expect(upcoming[1]?.newStarts).toHaveLength(2);
  });

  it("keeps the remaining leveled review assignments stable after any one is logged", () => {
    const planned = planNewProblemStarts(
      {
        ...data(
          Array.from({ length: DAILY_PLAN_CAPACITY + 1 }, (_, index) =>
            problem({
              id: `review_${index}`,
              title: `Review ${index}`,
              status: "reviewing",
              idealReviewAt: "2026-05-19T00:00:00.000Z",
              nextReviewAt: "2026-05-19T00:00:00.000Z",
            }),
          ),
        ),
        settings: {
          dailyTarget: DAILY_PLAN_CAPACITY,
          reservedNewStartsPerDay: 0,
          extraDailyCapacity: {},
        },
      },
      { now },
    );
    const todayBefore = getUpcomingPlan(planned, { now, days: 1 })[0]?.reviews ?? [];

    expect(todayBefore).toHaveLength(3);

    for (const loggedProblem of todayBefore) {
      const assignmentsBefore = new Map(
        planned.problems
          .filter((item) => item.id !== loggedProblem.id)
          .map((item) => [item.id, item.nextReviewAt]),
      );
      const logged = logAttempt(
        planned,
        loggedProblem.id,
        { result: "solved_clean" },
        { now, idFactory: () => "attempt_1" },
      );
      const replanned = planNewProblemStarts(logged.data, { now });
      const todayAfter = getUpcomingPlan(replanned, { now, days: 1 })[0]?.reviews ?? [];

      expect(todayAfter.map((item) => item.id)).toEqual(
        todayBefore.filter((item) => item.id !== loggedProblem.id).map((item) => item.id),
      );
      expect(
        new Map(
          replanned.problems
            .filter((item) => item.id !== loggedProblem.id)
            .map((item) => [item.id, item.nextReviewAt]),
        ),
      ).toEqual(assignmentsBefore);
    }
  });

  it("keeps the exact remaining Today queue after a planned new start is logged", () => {
    const planned = planNewProblemStarts(
      {
        ...data([
          problem({
            id: "review_1",
            status: "reviewing",
            idealReviewAt: "2026-05-19T00:00:00.000Z",
            nextReviewAt: "2026-05-19T00:00:00.000Z",
          }),
          ...Array.from({ length: 3 }, (_, index) =>
            problem({
              id: `new_${index}`,
              title: `New ${index}`,
              createdAt: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
            }),
          ),
        ]),
        settings: {
          dailyTarget: 2,
          reservedNewStartsPerDay: 1,
          extraDailyCapacity: {},
        },
      },
      { now },
    );
    const todayBefore = getUpcomingPlan(planned, { now, days: 1 })[0];
    const loggedProblem = todayBefore?.newStarts[0];

    expect(todayBefore?.reviews.map((item) => item.id)).toEqual(["review_1"]);
    expect(todayBefore?.newStarts).toHaveLength(1);
    expect(loggedProblem).toBeDefined();

    const logged = logAttempt(
      planned,
      loggedProblem?.id ?? "new_0",
      { result: "solved_clean" },
      { now, idFactory: () => "attempt_1" },
    );
    const replanned = planNewProblemStarts(logged.data, {
      now,
      frozenTodayProblemIds: new Set(["review_1"]),
    });
    const todayAfter = getUpcomingPlan(replanned, { now, days: 1 })[0];

    expect(todayAfter?.reviews.map((item) => item.id)).toEqual(["review_1"]);
    expect(todayAfter?.newStarts).toHaveLength(0);
    expect(todayAfter?.completedCount).toBe(1);
    expect(todayAfter?.load).toBe(2);
  });

  it("keeps a completed planned new start counted toward the reserve after reload", () => {
    const dueToday = startOfLocalDay(now).toISOString();
    const initial = {
      ...data([
        problem({
          id: "review_1",
          title: "Max Consecutive Ones III",
          status: "reviewing",
          idealReviewAt: dueToday,
          nextReviewAt: dueToday,
        }),
        problem({
          id: "review_2",
          title: "Other review",
          status: "reviewing",
          idealReviewAt: dueToday,
          nextReviewAt: dueToday,
        }),
        ...Array.from({ length: 80 }, (_, index) =>
          problem({
            id: `new_${index}`,
            title: `New ${index}`,
            createdAt: "2026-05-01T00:00:00.000Z",
          }),
        ),
      ]),
      settings: {
        dailyTarget: 5,
        reservedNewStartsPerDay: 3,
        extraDailyCapacity: {},
      },
    };
    const planned = planNewProblemStarts(initial, { now });
    const todayBefore = getUpcomingPlan(planned, { now, days: 1 })[0]!;
    const loggedProblem = todayBefore.newStarts[0]!;
    const logged = logAttempt(
      planned,
      loggedProblem.id,
      { result: "solved_clean" },
      { now, idFactory: () => "attempt_1" },
    );
    const frozenTodayProblemIds = new Set(
      [...todayBefore.reviews, ...todayBefore.newStarts]
        .filter((item) => item.id !== loggedProblem.id)
        .map((item) => item.id),
    );
    const immediatelyAfterLog = planNewProblemStarts(logged.data, {
      now,
      frozenTodayProblemIds,
    });
    const todayAfterLog = getUpcomingPlan(immediatelyAfterLog, { now, days: 1 })[0]!;
    const reloaded = planNewProblemStarts(immediatelyAfterLog, { now });
    const todayAfterReload = getUpcomingPlan(reloaded, { now, days: 1 })[0]!;

    expect(todayBefore.reviews).toHaveLength(2);
    expect(todayBefore.newStarts).toHaveLength(3);
    expect(todayAfterLog.reviews.map((item) => item.id)).toEqual(
      todayBefore.reviews.map((item) => item.id),
    );
    expect(todayAfterLog.newStarts).toHaveLength(2);
    expect(todayAfterReload.reviews.map((item) => item.id)).toEqual(
      todayAfterLog.reviews.map((item) => item.id),
    );
    expect(todayAfterReload.newStarts.map((item) => item.id)).toEqual(
      todayAfterLog.newStarts.map((item) => item.id),
    );
    expect(todayAfterReload.completedCount).toBe(1);
    expect(todayAfterReload.load).toBe(5);
  });

  it("infers completed new starts conservatively from stored attempt history", () => {
    const dateKey = toLocalDateKey(now);
    const startedHere = problem({
      id: "started_here",
      status: "reviewing",
      reviewCount: 2,
    });
    const importedReview = problem({
      id: "imported_review",
      status: "reviewing",
      reviewCount: 2,
    });
    const completedNewIds = getCompletedNewProblemIdsForDate(
      data(
        [startedHere, importedReview],
        [
          {
            id: "started_first",
            problemId: startedHere.id,
            attemptedAt: "2026-05-19T10:00:00.000Z",
            result: "solved_clean",
            plannedForDate: dateKey,
          },
          {
            id: "started_second",
            problemId: startedHere.id,
            attemptedAt: "2026-05-19T11:00:00.000Z",
            result: "solved_buggy",
          },
          {
            id: "imported_first_local",
            problemId: importedReview.id,
            attemptedAt: "2026-05-19T10:30:00.000Z",
            result: "solved_clean",
            plannedForDate: dateKey,
          },
        ],
      ),
      now,
    );

    expect([...completedNewIds]).toEqual(["started_here"]);
  });

  it("does not change Today when an off-plan review is logged", () => {
    const planned = planNewProblemStarts(
      {
        ...data(
          Array.from({ length: 4 }, (_, index) =>
            problem({
              id: `review_${index}`,
              title: `Review ${index}`,
              status: "reviewing",
              idealReviewAt: "2026-05-19T00:00:00.000Z",
              nextReviewAt: "2026-05-19T00:00:00.000Z",
            }),
          ),
        ),
        settings: {
          dailyTarget: 3,
          reservedNewStartsPerDay: 0,
          extraDailyCapacity: {},
        },
      },
      { now },
    );
    const upcomingBefore = getUpcomingPlan(planned, { now, days: 2 });
    const todayIds = upcomingBefore[0]?.reviews.map((item) => item.id) ?? [];
    const offPlanProblem = upcomingBefore[1]?.reviews[0];

    expect(todayIds).toHaveLength(2);
    expect(offPlanProblem).toBeDefined();

    const logged = logAttempt(
      planned,
      offPlanProblem?.id ?? "review_1",
      { result: "solved_clean" },
      { now, idFactory: () => "attempt_1" },
    );
    const replanned = planNewProblemStarts(logged.data, {
      now,
      frozenTodayProblemIds: new Set(todayIds),
    });
    const todayAfter = getUpcomingPlan(replanned, { now, days: 1 })[0];

    expect(logged.attempt.plannedForDate).toBeUndefined();
    expect(todayAfter?.reviews.map((item) => item.id)).toEqual(todayIds);
    expect(todayAfter?.load).toBe(2);
  });

  it("keeps Today stable while an unsaved Daily is added and logged off plan", () => {
    const planned = planNewProblemStarts(
      {
        ...data([
          problem({
            id: "review_1",
            status: "reviewing",
            idealReviewAt: "2026-05-19T00:00:00.000Z",
            nextReviewAt: "2026-05-19T00:00:00.000Z",
          }),
          problem({ id: "new_1", title: "New 1" }),
        ]),
        settings: {
          dailyTarget: 2,
          reservedNewStartsPerDay: 1,
          extraDailyCapacity: {},
        },
      },
      { now },
    );
    const todayIds = ["review_1", "new_1"];
    const frozenTodayProblemIds = new Set(todayIds);
    const added = addProblem(
      planned,
      {
        title: "Daily Challenge",
        url: "https://leetcode.com/problems/daily-challenge/",
        platform: "LeetCode",
        difficulty: "Easy",
        status: "new",
        leetcodeSlug: "daily-challenge",
      },
      { now, idFactory: () => "daily_problem" },
    );
    const plannedAfterAdd = planNewProblemStarts(added.data, {
      now,
      frozenTodayProblemIds,
    });
    const afterAddToday = getUpcomingPlan(plannedAfterAdd, { now, days: 1 })[0];

    expect([
      ...(afterAddToday?.reviews ?? []),
      ...(afterAddToday?.newStarts ?? []),
    ].map((item) => item.id)).toEqual(todayIds);

    const logged = logAttempt(
      plannedAfterAdd,
      "daily_problem",
      { result: "solved_clean" },
      { now, idFactory: () => "daily_attempt" },
    );
    const plannedAfterLog = planNewProblemStarts(logged.data, {
      now,
      frozenTodayProblemIds,
    });
    const afterLogToday = getUpcomingPlan(plannedAfterLog, { now, days: 1 })[0];

    expect(logged.attempt.plannedForDate).toBeUndefined();
    expect([
      ...(afterLogToday?.reviews ?? []),
      ...(afterLogToday?.newStarts ?? []),
    ].map((item) => item.id)).toEqual(todayIds);
  });

  it("keeps existing future new-start assignments stable", () => {
    const futureStart = problem({
      id: "new_tomorrow",
      title: "New Tomorrow",
      nextReviewAt: "2026-05-20T12:00:00.000Z",
    });
    const unscheduled = problem({
      id: "new_unscheduled",
      title: "New Unscheduled",
    });
    const planned = planNewProblemStarts(data([futureStart, unscheduled]), { now });
    const upcoming = getUpcomingPlan(planned, { now });

    expect(upcoming[0]?.newStarts.map((item) => item.id)).toEqual(["new_unscheduled"]);
    expect(upcoming[1]?.newStarts.map((item) => item.id)).toEqual(["new_tomorrow"]);
  });

  it("ignores off-plan attempts when filling today's open capacity", () => {
    const planned = planNewProblemStarts(
      data(
        Array.from({ length: DAILY_PLAN_CAPACITY }, (_, index) =>
          problem({
            id: `new_${index}`,
            title: `New ${index}`,
            createdAt: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
          }),
        ),
        [
          {
            id: "attempt_1",
            problemId: "future_review",
            attemptedAt: now.toISOString(),
            result: "solved_clean",
          },
        ],
      ),
      { now },
    );
    const upcoming = getUpcomingPlan(planned, { now });

    expect(upcoming[0]?.newStarts).toHaveLength(DAILY_PLAN_CAPACITY);
    expect(upcoming[0]?.completedCount).toBe(0);
    expect(upcoming[0]?.load).toBe(DAILY_PLAN_CAPACITY);
  });

  it("uses the stored daily target when no override is provided", () => {
    const planned = planNewProblemStarts(
      {
        ...data(
          Array.from({ length: 4 }, (_, index) =>
            problem({
              id: `new_${index}`,
              title: `New ${index}`,
            }),
          ),
        ),
        settings: {
          dailyTarget: 2,
          reservedNewStartsPerDay: 1,
          extraDailyCapacity: {},
        },
      },
      { now },
    );
    const upcoming = getUpcomingPlan(planned, { now });

    expect(upcoming[0]?.capacity).toBe(2);
    expect(upcoming[0]?.newStarts).toHaveLength(2);
    expect(upcoming[1]?.newStarts).toHaveLength(2);
  });

  it("refills today with another batch after planned work is complete", () => {
    const completedAttempts: Attempt[] = Array.from({ length: DAILY_PLAN_CAPACITY }, (_, index) => ({
      id: `attempt_${index}`,
      problemId: `done_${index}`,
      attemptedAt: now.toISOString(),
      result: "solved_clean",
      plannedForDate: "2026-05-19",
    }));
    const refillCandidates = Array.from({ length: DAILY_PLAN_CAPACITY + 1 }, (_, index) =>
      problem({
        id: `new_${index}`,
        title: `New ${index}`,
        nextReviewAt: "2026-05-20T12:00:00.000Z",
      }),
    );
    const result = refillTodayPlan(data(refillCandidates, completedAttempts), { now });
    const upcoming = getUpcomingPlan(result.data, { now });

    expect(result.addedCount).toBe(DAILY_PLAN_CAPACITY);
    expect(upcoming[0]?.capacity).toBe(DAILY_PLAN_CAPACITY * 2);
    expect(upcoming[0]?.completedCount).toBe(DAILY_PLAN_CAPACITY);
    expect(upcoming[0]?.newStarts).toHaveLength(DAILY_PLAN_CAPACITY);
    expect(upcoming[1]?.newStarts).toHaveLength(1);
  });

  it("gives an explicit refill its own new-start reserve", () => {
    const todayIso = startOfLocalDay(now).toISOString();
    const tomorrowIso = addDays(startOfLocalDay(now), 1).toISOString();
    const completedProblems = Array.from({ length: DAILY_PLAN_CAPACITY }, (_, index) =>
      problem({
        id: `done_${index}`,
        title: `Done ${index}`,
        status: "reviewing",
        reviewCount: index < 3 ? 1 : 2,
      }),
    );
    const completedAttempts: Attempt[] = completedProblems.map((item, index) => ({
      id: `attempt_${index}`,
      problemId: item.id,
      attemptedAt: now.toISOString(),
      result: "solved_clean",
      plannedForDate: "2026-05-19",
    }));
    const dueReviews = Array.from({ length: 3 }, (_, index) =>
      problem({
        id: `due_review_${index}`,
        title: `Due review ${index}`,
        status: "reviewing",
        idealReviewAt: todayIso,
        nextReviewAt: tomorrowIso,
      }),
    );
    const futureReview = problem({
      id: "future_review",
      title: "Future review",
      status: "reviewing",
      idealReviewAt: tomorrowIso,
      nextReviewAt: tomorrowIso,
    });
    const newStarts = Array.from({ length: 5 }, (_, index) =>
      problem({
        id: `new_${index}`,
        title: `New ${index}`,
        nextReviewAt: tomorrowIso,
      }),
    );
    const initial: LeetLoopData = {
      ...data([...completedProblems, ...dueReviews, futureReview, ...newStarts], completedAttempts),
      settings: {
        dailyTarget: 5,
        reservedNewStartsPerDay: 3,
        extraDailyCapacity: {},
      },
    };

    const result = refillTodayPlan(initial, { now });
    const today = getUpcomingPlan(result.data, { now, days: 1 })[0]!;

    expect(result.addedCount).toBe(5);
    expect(today.reviews.map((item) => item.id)).toEqual(["due_review_0", "due_review_1"]);
    expect(today.newStarts).toHaveLength(3);
    expect(today.newStarts.every((item) => item.id.startsWith("new_"))).toBe(true);
    expect(today.reviews.some((item) => item.id === futureReview.id)).toBe(false);
    expect(today.completedCount).toBe(5);
    expect(today.load).toBe(10);
    expect(today.capacity).toBe(10);

    const completedRefillProblem = today.newStarts[0]!;
    const logged = logAttempt(
      result.data,
      completedRefillProblem.id,
      { result: "solved_clean" },
      { now, idFactory: () => "refill_attempt" },
    );
    const frozenTodayProblemIds = new Set(
      [...today.reviews, ...today.newStarts]
        .filter((item) => item.id !== completedRefillProblem.id)
        .map((item) => item.id),
    );
    const immediatelyAfterLog = planNewProblemStarts(logged.data, {
      now,
      frozenTodayProblemIds,
    });
    const todayAfterLog = getUpcomingPlan(immediatelyAfterLog, { now, days: 1 })[0]!;
    const reloaded = planNewProblemStarts(immediatelyAfterLog, { now });
    const todayAfterReload = getUpcomingPlan(reloaded, { now, days: 1 })[0]!;

    expect(todayAfterReload.reviews.map((item) => item.id)).toEqual(
      todayAfterLog.reviews.map((item) => item.id),
    );
    expect(todayAfterReload.newStarts.map((item) => item.id)).toEqual(
      todayAfterLog.newStarts.map((item) => item.id),
    );
    expect(todayAfterReload.load).toBe(10);
  });

  it("increases refill capacity by the work actually added", () => {
    const todayIso = startOfLocalDay(now).toISOString();
    const tomorrowIso = addDays(startOfLocalDay(now), 1).toISOString();
    const completedAttempts: Attempt[] = Array.from(
      { length: DAILY_PLAN_CAPACITY },
      (_, index) => ({
        id: `attempt_${index}`,
        problemId: `done_${index}`,
        attemptedAt: now.toISOString(),
        result: "solved_clean",
        plannedForDate: "2026-05-19",
      }),
    );
    const dueReview = problem({
      id: "due_review",
      title: "Due review",
      status: "reviewing",
      idealReviewAt: todayIso,
      nextReviewAt: tomorrowIso,
    });
    const newStarts = Array.from({ length: 3 }, (_, index) =>
      problem({
        id: `new_${index}`,
        title: `New ${index}`,
        nextReviewAt: tomorrowIso,
      }),
    );
    const initial: LeetLoopData = {
      ...data([dueReview, ...newStarts], completedAttempts),
      settings: {
        dailyTarget: 5,
        reservedNewStartsPerDay: 3,
        extraDailyCapacity: {},
      },
    };

    const result = refillTodayPlan(initial, { now });
    const today = getUpcomingPlan(result.data, { now, days: 1 })[0]!;

    expect(result.addedCount).toBe(4);
    expect(today.reviews.map((item) => item.id)).toEqual(["due_review"]);
    expect(new Set(today.newStarts.map((item) => item.id))).toEqual(
      new Set(["new_0", "new_1", "new_2"]),
    );
    expect(today.completedCount).toBe(5);
    expect(today.load).toBe(9);
    expect(today.capacity).toBe(9);
  });

  it("refills a full batch when a snoozed item still holds a today slot", () => {
    const completedAttempts: Attempt[] = Array.from(
      { length: DAILY_PLAN_CAPACITY - 1 },
      (_, index) => ({
        id: `attempt_${index}`,
        problemId: `done_${index}`,
        attemptedAt: now.toISOString(),
        result: "solved_clean",
        plannedForDate: "2026-05-19",
      }),
    );
    const refillCandidates = Array.from({ length: DAILY_PLAN_CAPACITY }, (_, index) =>
      problem({
        id: `new_${index}`,
        title: `New ${index}`,
        nextReviewAt: "2026-05-20T12:00:00.000Z",
      }),
    );
    const snoozed = problem({
      id: "snoozed_1",
      title: "Snoozed",
      status: "reviewing",
      nextReviewAt: "2026-05-19T00:00:00.000Z",
    });
    const snoozedData = snoozeProblem(
      data([snoozed, ...refillCandidates], completedAttempts),
      "snoozed_1",
      { consumePlanSlot: true, now, until: new Date("2026-05-22T12:00:00.000Z") },
    );
    const result = refillTodayPlan(snoozedData, { now });
    const upcoming = getUpcomingPlan(result.data, { now });

    // The consumed slot must not shrink the batch the refill grants.
    expect(upcoming[0]?.deferredCount).toBe(1);
    expect(result.addedCount).toBe(DAILY_PLAN_CAPACITY);
    expect(upcoming[0]?.newStarts).toHaveLength(DAILY_PLAN_CAPACITY);
  });
});

describe("priority category scheduling", () => {
  // createdAt order interleaves categories, so category priority and
  // randomized order are both visible.
  const mixed = [
    problem({ id: "dp1", primaryPattern: "1D DP", patterns: ["1D DP"], createdAt: "2026-05-01T00:00:00.000Z" }),
    problem({ id: "bfs-a", primaryPattern: "BFS", patterns: ["BFS"], createdAt: "2026-05-02T00:00:00.000Z" }),
    problem({ id: "arrays1", primaryPattern: "Arrays", patterns: ["Arrays"], createdAt: "2026-05-03T00:00:00.000Z" }),
    problem({ id: "bfs-b", primaryPattern: "BFS", patterns: ["BFS"], createdAt: "2026-05-04T00:00:00.000Z" }),
    problem({ id: "dp2", primaryPattern: "1D DP", patterns: ["1D DP"], createdAt: "2026-05-05T00:00:00.000Z" }),
    problem({ id: "bfs-c", primaryPattern: "BFS", patterns: ["BFS"], createdAt: "2026-05-06T00:00:00.000Z" }),
  ];

  function withSettings(problems: Problem[], settings: Partial<LeetLoopData["settings"]>): LeetLoopData {
    return {
      ...data(problems),
      settings: { ...createDefaultSettings(), dailyTarget: 6, reservedNewStartsPerDay: 6, ...settings },
    };
  }

  it("leads with the priority category and randomizes each partition", () => {
    const planned = planNewProblemStarts(withSettings(mixed, { priorityCategory: "BFS" }), { now });
    const ids = getUpcomingPlan(planned, { now }).flatMap((day) => day.newStarts).map((p) => p.id);

    expect(ids).toEqual(["bfs-c", "bfs-b", "bfs-a", "arrays1", "dp2", "dp1"]);
    expect(ids.slice(0, 3).every((id) => id.startsWith("bfs"))).toBe(true);
  });

  it("uses a stable randomized order when no priority category is set", () => {
    const planned = planNewProblemStarts(withSettings(mixed, {}), { now });
    const ids = getUpcomingPlan(planned, { now }).flatMap((day) => day.newStarts).map((p) => p.id);
    const replannedIds = getUpcomingPlan(planNewProblemStarts(planned, { now }), { now })
      .flatMap((day) => day.newStarts)
      .map((problem) => problem.id);

    expect(ids).toEqual(["bfs-a", "bfs-b", "bfs-c", "arrays1", "dp1", "dp2"]);
    expect(ids).not.toEqual(["dp1", "bfs-a", "arrays1", "bfs-b", "dp2", "bfs-c"]);
    expect(replannedIds).toEqual(ids);
  });

  it("lists available new-start categories, most-populated first", () => {
    const categories = getAvailableNewStartCategories(
      data([
        ...mixed,
        problem({ id: "retired1", status: "retired", primaryPattern: "BFS", patterns: ["BFS"] }),
        problem({ id: "untagged", primaryPattern: undefined, patterns: [] }),
      ]),
      now,
    );

    expect(categories).toEqual([
      { category: "BFS", count: 3 },
      { category: "1D DP", count: 2 },
      { category: "Arrays", count: 1 },
    ]);
  });
});
