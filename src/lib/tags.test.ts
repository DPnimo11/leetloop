import { describe, expect, it } from "vitest";
import { DEFAULT_PATTERN_TAGS, normalizePatternTags } from "./tags";

describe("pattern tags", () => {
  it("keeps the default tag bank alphabetized", () => {
    const sortedTags = [...DEFAULT_PATTERN_TAGS].sort((a, b) => a.localeCompare(b));

    expect([...DEFAULT_PATTERN_TAGS]).toEqual(sortedTags);
  });

  it("includes common LeetCode topic tags in the default bank", () => {
    expect(DEFAULT_PATTERN_TAGS).toEqual(
      expect.arrayContaining(["Enumeration", "Hash Table", "Sorting", "Union Find"]),
    );
  });

  it("normalizes equivalent tags to the bank names", () => {
    expect(normalizePatternTags(["Hashing", "Hash Table", "Union-Find"])).toEqual([
      "Hash Table",
      "Union Find",
    ]);
  });
});
