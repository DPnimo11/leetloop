import { describe, expect, it } from "vitest";
import type { Problem } from "@/types/problem";
import { scheduleNextReview } from "./scheduling";

const attemptedAt = new Date("2026-05-18T12:00:00.000Z");

function problem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: "problem_1",
    title: "Two Sum",
    url: "https://leetcode.com/problems/two-sum/",
    platform: "LeetCode",
    difficulty: "Easy",
    patterns: ["Arrays", "Hashing"],
    status: "new",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    reviewCount: 0,
    cleanStreak: 0,
    ...overrides,
  };
}

describe("scheduleNextReview", () => {
  it.each([
    ["failed_reconstruct", 1, "learning"],
    ["looked_solution", 2, "learning"],
    ["needed_hint", 3, "learning"],
    ["solved_buggy", 7, "reviewing"],
  ] as const)("schedules %s after %i days", (result, days, status) => {
    const scheduled = scheduleNextReview(problem({ cleanStreak: 2 }), result, attemptedAt);
    const expectedDate = new Date(attemptedAt);
    expectedDate.setDate(expectedDate.getDate() + days);

    expect(scheduled.nextReviewAt).toBe(expectedDate.toISOString());
    expect(scheduled.status).toBe(status);
    expect(scheduled.cleanStreak).toBe(0);
    expect(scheduled.reviewCount).toBe(1);
    expect(scheduled.lastResult).toBe(result);
  });

  it.each([
    [0, 1, 14, "2026-06-01T12:00:00.000Z"],
    [1, 2, 30, "2026-06-17T12:00:00.000Z"],
    [2, 3, 60, "2026-07-17T12:00:00.000Z"],
    [5, 6, 60, "2026-07-17T12:00:00.000Z"],
  ])(
    "uses clean streak interval from %i to %i",
    (initialStreak, expectedStreak, _days, expectedDate) => {
      const scheduled = scheduleNextReview(
        problem({ cleanStreak: initialStreak }),
        "solved_clean",
        attemptedAt,
      );

      expect(scheduled.status).toBe("reviewing");
      expect(scheduled.cleanStreak).toBe(expectedStreak);
      expect(scheduled.nextReviewAt).toBe(expectedDate);
      expect(scheduled.lastAttemptedAt).toBe(attemptedAt.toISOString());
    },
  );

  it("resets a clean streak after a shaky result", () => {
    const scheduled = scheduleNextReview(
      problem({ cleanStreak: 3, reviewCount: 9, status: "reviewing" }),
      "needed_hint",
      attemptedAt,
    );

    expect(scheduled.cleanStreak).toBe(0);
    expect(scheduled.status).toBe("learning");
    expect(scheduled.reviewCount).toBe(10);
  });
});
