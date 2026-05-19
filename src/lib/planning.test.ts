import { describe, expect, it } from "vitest";
import type { Problem } from "@/types/problem";
import type { LeetLoopData } from "@/types/storage";
import { DAILY_PLAN_CAPACITY, getUpcomingPlan, planNewProblemStarts } from "./planning";

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

function data(problems: Problem[]): LeetLoopData {
  return {
    version: 1,
    problems,
    attempts: [],
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
});
