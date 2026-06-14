import { describe, expect, it } from "vitest";
import { parseLeetCodeDailyProblem } from "./dailyLeetcode";

describe("parseLeetCodeDailyProblem", () => {
  it("normalizes the LeetCode daily challenge response", () => {
    const problem = parseLeetCodeDailyProblem({
      data: {
        activeDailyCodingChallengeQuestion: {
          date: "2026-06-14",
          link: "/problems/two-sum/",
          question: {
            difficulty: "EASY",
            isPaidOnly: false,
            title: "Two Sum",
            titleSlug: "two-sum",
            topicTags: [
              { name: "Array", slug: "array" },
              { name: "Hash Table", slug: "hash-table" },
            ],
          },
        },
      },
    });

    expect(problem).toEqual({
      date: "2026-06-14",
      link: "https://leetcode.com/problems/two-sum/",
      url: "https://leetcode.com/problems/two-sum/",
      title: "Two Sum",
      titleSlug: "two-sum",
      difficulty: "Easy",
      paidOnly: false,
      topicTags: [
        { name: "Array", slug: "array" },
        { name: "Hash Table", slug: "hash-table" },
      ],
    });
  });

  it("rejects malformed daily challenge responses", () => {
    expect(parseLeetCodeDailyProblem({ data: {} })).toBeUndefined();
    expect(
      parseLeetCodeDailyProblem({
        data: {
          activeDailyCodingChallengeQuestion: {
            date: "2026-06-14",
            question: {
              difficulty: "Extreme",
              title: "Two Sum",
              titleSlug: "two-sum",
            },
          },
        },
      }),
    ).toBeUndefined();
  });
});
