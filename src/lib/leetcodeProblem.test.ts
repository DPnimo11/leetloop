import { describe, expect, it } from "vitest";
import {
  parseLeetCodeProblemMetadata,
  parseLeetCodeProblemUrl,
} from "./leetcodeProblem";

describe("LeetCode problem metadata", () => {
  it("extracts a slug from LeetCode problem links", () => {
    expect(parseLeetCodeProblemUrl("https://leetcode.com/problems/two-sum/")).toBe("two-sum");
    expect(
      parseLeetCodeProblemUrl(
        "https://www.leetcode.com/problems/two-sum/description/?envType=study-plan",
      ),
    ).toBe("two-sum");
  });

  it("rejects non-LeetCode and non-problem links", () => {
    expect(parseLeetCodeProblemUrl("https://example.com/problems/two-sum/")).toBeUndefined();
    expect(parseLeetCodeProblemUrl("https://leetcode.com/problemset/")).toBeUndefined();
  });

  it("normalizes problem metadata returned by LeetCode", () => {
    expect(
      parseLeetCodeProblemMetadata({
        data: {
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
      }),
    ).toEqual({
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

  it("rejects malformed problem metadata", () => {
    expect(parseLeetCodeProblemMetadata({ data: { question: null } })).toBeUndefined();
    expect(
      parseLeetCodeProblemMetadata({
        data: {
          question: {
            difficulty: "Extreme",
            title: "Two Sum",
            titleSlug: "two-sum",
          },
        },
      }),
    ).toBeUndefined();
  });
});
