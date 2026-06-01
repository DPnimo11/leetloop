import { describe, expect, it } from "vitest";
import { leetLoopReviewUrl } from "./leetcode";

describe("leetLoopReviewUrl", () => {
  it("adds the LeetLoop review marker to LeetCode problem URLs", () => {
    expect(leetLoopReviewUrl("https://leetcode.com/problems/two-sum/")).toBe(
      "https://leetcode.com/problems/two-sum/?leetloop=review",
    );
  });

  it("preserves existing query params and hashes", () => {
    expect(leetLoopReviewUrl("https://leetcode.com/problems/two-sum/?envType=study-plan#submissions")).toBe(
      "https://leetcode.com/problems/two-sum/?envType=study-plan&leetloop=review#submissions",
    );
  });

  it("leaves non-LeetCode URLs alone", () => {
    expect(leetLoopReviewUrl("https://example.com/problems/two-sum/")).toBe(
      "https://example.com/problems/two-sum/",
    );
  });
});
