import { describe, expect, it } from "vitest";
import { millisecondsUntilNextLocalDay } from "./dates";

describe("millisecondsUntilNextLocalDay", () => {
  it("returns the delay until the next local midnight", () => {
    const justBeforeMidnight = new Date(2026, 4, 19, 23, 59, 59, 500);

    expect(millisecondsUntilNextLocalDay(justBeforeMidnight)).toBe(500);
  });
});
