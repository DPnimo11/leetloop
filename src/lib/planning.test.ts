import { describe, expect, it } from "vitest";
import type { Attempt } from "@/types/attempt";
import type { Problem } from "@/types/problem";
import type { LeetLoopData } from "@/types/storage";
import { createDefaultSettings } from "./settings";
import { DAILY_PLAN_CAPACITY, getUpcomingPlan, planNewProblemStarts, refillTodayPlan } from "./planning";
import { snoozeProblem } from "./storage";

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
});
