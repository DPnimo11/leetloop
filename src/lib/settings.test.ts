import { describe, expect, it } from "vitest";
import { createDefaultSettings, normalizeSettings } from "./settings";

describe("priority category setting", () => {
  it("defaults to no priority category", () => {
    expect(createDefaultSettings().priorityCategory).toBeUndefined();
    expect(normalizeSettings({}).priorityCategory).toBeUndefined();
  });

  it("keeps and trims a chosen category", () => {
    expect(normalizeSettings({ priorityCategory: "BFS" }).priorityCategory).toBe("BFS");
    expect(normalizeSettings({ priorityCategory: "  BFS  " }).priorityCategory).toBe("BFS");
  });

  it("coerces empty or blank values to undefined", () => {
    expect(normalizeSettings({ priorityCategory: "" }).priorityCategory).toBeUndefined();
    expect(normalizeSettings({ priorityCategory: "   " }).priorityCategory).toBeUndefined();
  });
});
