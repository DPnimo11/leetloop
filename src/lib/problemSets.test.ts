import { describe, expect, it } from "vitest";
import {
  BUILT_IN_PROBLEM_SETS,
  getAllProblemTemplates,
  normalizeLeetcodeSlug,
} from "./problemSets";

describe("built-in problem sets", () => {
  it("includes the bundled problem-set counts", () => {
    const leetcode75 = BUILT_IN_PROBLEM_SETS.find((set) => set.slug === "leetcode-75");
    const topInterview150 = BUILT_IN_PROBLEM_SETS.find((set) => set.slug === "top-interview-150");
    const neetcode150 = BUILT_IN_PROBLEM_SETS.find((set) => set.slug === "neetcode-150");

    expect(leetcode75?.problems).toHaveLength(75);
    expect(topInterview150?.problems).toHaveLength(150);
    expect(neetcode150?.problems).toHaveLength(150);
  });

  it("preserves overlapping set memberships for duplicate LeetCode slugs", () => {
    const productExceptSelf = getAllProblemTemplates().filter(
      (template) => template.titleSlug === "product-of-array-except-self",
    );

    expect(productExceptSelf).toHaveLength(3);
    expect(productExceptSelf[0]?.sourceSetSlugs).toEqual([
      "leetcode-75",
      "top-interview-150",
      "neetcode-150",
    ]);
  });

  it("canonicalizes NeetCode problem URLs to LeetCode slugs", () => {
    expect(normalizeLeetcodeSlug("https://neetcode.io/problems/two-integer-sum/question")).toBe(
      "two-sum",
    );
    expect(normalizeLeetcodeSlug("https://neetcode.io/problems/anagram-groups/question")).toBe(
      "group-anagrams",
    );
    expect(normalizeLeetcodeSlug("two-integer-sum")).toBe("two-sum");
  });
});
