import { describe, expect, it } from "vitest";
import { createProblemInputFromTemplate, isTemplateAdded, leetcodeProblemUrl } from "./problemSets";
import {
  addProblem,
  createEmptyData,
  exportData,
  importData,
  loadData,
  logAttempt,
  parseLeetLoopData,
  saveData,
} from "./storage";
import type { ProblemTemplate } from "@/types/problem-set";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const now = new Date("2026-05-18T12:00:00.000Z");

const template: ProblemTemplate = {
  id: "leetcode-75:two-sum",
  title: "Two Sum",
  titleSlug: "two-sum",
  url: leetcodeProblemUrl("two-sum"),
  platform: "LeetCode",
  difficulty: "Easy",
  patterns: ["Arrays", "Hashing"],
  sourceSetSlugs: ["leetcode-75"],
  sourceGroups: ["Array / String"],
  questionFrontendId: "1",
};

describe("storage helpers", () => {
  it("creates, saves, and loads data from injected storage", () => {
    const storage = new MemoryStorage();
    const empty = createEmptyData(now);
    const { data } = addProblem(empty, createProblemInputFromTemplate(template), {
      now,
      idFactory: () => "problem_1",
    });

    saveData(data, storage);
    const loaded = loadData(storage);

    expect(loaded.problems).toHaveLength(1);
    expect(loaded.problems[0]?.title).toBe("Two Sum");
    expect(loaded.problems[0]?.leetcodeSlug).toBe("two-sum");
    expect(loaded.settings.dailyTarget).toBe(5);
  });

  it("logs attempts and updates the linked problem schedule", () => {
    const { data, problem } = addProblem(createEmptyData(now), createProblemInputFromTemplate(template), {
      now,
      idFactory: () => "problem_1",
    });

    const result = logAttempt(
      data,
      problem.id,
      {
        result: "looked_solution",
        timeMinutes: 22,
        note: "Forgot the hash map complement.",
      },
      { now, idFactory: () => "attempt_1" },
    );

    expect(result.data.attempts).toHaveLength(1);
    expect(result.attempt.timeMinutes).toBe(22);
    expect(result.problem.status).toBe("learning");
    expect(result.problem.nextReviewAt).toBe("2026-05-20T12:00:00.000Z");
    expect(result.problem.reviewCount).toBe(1);
  });

  it("marks a due problem attempt as completed daily work", () => {
    const { data, problem } = addProblem(createEmptyData(now), createProblemInputFromTemplate(template), {
      now,
      idFactory: () => "problem_1",
    });
    const dueProblem = {
      ...problem,
      nextReviewAt: "2026-05-18T09:00:00.000Z",
    };

    const result = logAttempt(
      {
        ...data,
        problems: [dueProblem],
      },
      problem.id,
      {
        result: "solved_clean",
      },
      { now, idFactory: () => "attempt_1" },
    );

    expect(result.attempt.plannedForDate).toBe("2026-05-18");
  });

  it("does not mark an off-plan future problem attempt as completed daily work", () => {
    const { data, problem } = addProblem(createEmptyData(now), createProblemInputFromTemplate(template), {
      now,
      idFactory: () => "problem_1",
    });
    const futureProblem = {
      ...problem,
      status: "reviewing" as const,
      nextReviewAt: "2026-05-21T12:00:00.000Z",
    };

    const result = logAttempt(
      {
        ...data,
        problems: [futureProblem],
      },
      problem.id,
      {
        result: "solved_clean",
      },
      { now, idFactory: () => "attempt_1" },
    );

    expect(result.attempt.plannedForDate).toBeUndefined();
  });

  it("round-trips JSON export/import", () => {
    const { data } = addProblem(createEmptyData(now), createProblemInputFromTemplate(template), {
      now,
      idFactory: () => "problem_1",
    });

    const imported = importData(exportData(data));

    expect(imported).toEqual(data);
  });

  it("adds default settings when parsing older backups", () => {
    const parsed = parseLeetLoopData(
      JSON.stringify({
        version: 1,
        problems: [],
        attempts: [],
        updatedAt: now.toISOString(),
      }),
    );

    expect(parsed.settings).toEqual({
      dailyTarget: 5,
      extraDailyCapacity: {},
    });
  });

  it("normalizes saved settings", () => {
    const parsed = parseLeetLoopData(
      JSON.stringify({
        version: 1,
        problems: [],
        attempts: [],
        settings: {
          dailyTarget: 99,
          extraDailyCapacity: {
            "2026-05-18": 3,
            nope: 4,
          },
        },
        updatedAt: now.toISOString(),
      }),
    );

    expect(parsed.settings).toEqual({
      dailyTarget: 20,
      extraDailyCapacity: {
        "2026-05-18": 3,
      },
    });
  });

  it("detects template duplicates by LeetCode slug", () => {
    const { data } = addProblem(createEmptyData(now), createProblemInputFromTemplate(template), {
      now,
      idFactory: () => "problem_1",
    });

    expect(isTemplateAdded(template, data.problems)).toBe(true);
  });
});
