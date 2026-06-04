import { describe, expect, it } from "vitest";
import type { Attempt } from "@/types/attempt";
import type { Problem } from "@/types/problem";
import type { LeetLoopData } from "@/types/storage";
import { createDefaultSettings } from "./settings";
import { DAILY_PLAN_CAPACITY, getUpcomingPlan, planNewProblemStarts, refillTodayPlan } from "./planning";

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

  it("does not schedule new starts on a day already full of reviews", () => {
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

    expect(upcoming[0]?.reviews).toHaveLength(DAILY_PLAN_CAPACITY);
    expect(upcoming[0]?.newStarts).toHaveLength(0);
    expect(upcoming[1]?.newStarts.map((item) => item.id)).toEqual(["new_1"]);
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
