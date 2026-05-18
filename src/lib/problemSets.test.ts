import { describe, expect, it } from "vitest";
import { BUILT_IN_PROBLEM_SETS, getAllProblemTemplates } from "./problemSets";

describe("built-in problem sets", () => {
  it("includes the official LeetCode 75 and Top Interview 150 counts", () => {
    const leetcode75 = BUILT_IN_PROBLEM_SETS.find((set) => set.slug === "leetcode-75");
    const topInterview150 = BUILT_IN_PROBLEM_SETS.find((set) => set.slug === "top-interview-150");

    expect(leetcode75?.problems).toHaveLength(75);
    expect(topInterview150?.problems).toHaveLength(150);
  });

  it("preserves overlapping set memberships for duplicate LeetCode slugs", () => {
    const productExceptSelf = getAllProblemTemplates().filter(
      (template) => template.titleSlug === "product-of-array-except-self",
    );

    expect(productExceptSelf).toHaveLength(2);
    expect(productExceptSelf[0]?.sourceSetSlugs).toEqual(["leetcode-75", "top-interview-150"]);
  });
});
