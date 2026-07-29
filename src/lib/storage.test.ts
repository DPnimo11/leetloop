import { describe, expect, it } from "vitest";
import {
  createProblemInputFromTemplate,
  getProblemSetBySlug,
  isTemplateAdded,
  leetcodeProblemUrl,
} from "./problemSets";
import {
  addProblem,
  addProblemFromTemplate,
  createEmptyData,
  exportData,
  importData,
  logAttempt,
  parseLeetLoopData,
  resumeProblem,
  snoozeProblem,
} from "./storage";
import type { ProblemTemplate } from "@/types/problem-set";

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
  it("creates data and round-trips it through parse", () => {
    const empty = createEmptyData(now);
    const { data } = addProblem(empty, createProblemInputFromTemplate(template), {
      now,
      idFactory: () => "problem_1",
    });

    const loaded = parseLeetLoopData(exportData(data));

    expect(loaded.problems).toHaveLength(1);
    expect(loaded.problems[0]?.title).toBe("Two Sum");
    expect(loaded.problems[0]?.leetcodeSlug).toBe("two-sum");
    expect(loaded.settings.dailyTarget).toBe(5);
    expect(loaded.settings.reservedNewStartsPerDay).toBe(1);
    expect(loaded.settings.hideTagsInProblemLists).toBe(false);
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
    expect(result.problem.idealReviewAt).toBe("2026-05-20T12:00:00.000Z");
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

  it("snoozes and resumes a problem without changing its review dates", () => {
    const { data, problem } = addProblem(createEmptyData(now), createProblemInputFromTemplate(template), {
      now,
      idFactory: () => "problem_1",
    });
    const reviewProblem = {
      ...problem,
      status: "reviewing" as const,
      idealReviewAt: "2026-05-18T09:00:00.000Z",
      nextReviewAt: "2026-05-18T09:00:00.000Z",
    };
    const snoozed = snoozeProblem(
      { ...data, problems: [reviewProblem] },
      problem.id,
      {
        now,
        until: new Date("2026-05-21T00:00:00.000Z"),
        consumePlanSlot: true,
      },
    );

    expect(snoozed.problems[0]).toMatchObject({
      snoozedAt: now.toISOString(),
      snoozedUntil: "2026-05-21T00:00:00.000Z",
      planSlotConsumedOn: "2026-05-18",
      idealReviewAt: reviewProblem.idealReviewAt,
      nextReviewAt: reviewProblem.nextReviewAt,
    });

    const resumed = resumeProblem(snoozed, problem.id, now);
    expect(resumed.problems[0]?.snoozedAt).toBeUndefined();
    expect(resumed.problems[0]?.snoozedUntil).toBeUndefined();
    expect(resumed.problems[0]?.planSlotConsumedOn).toBe("2026-05-18");
  });

  it("clears snooze state when a problem is attempted", () => {
    const { data, problem } = addProblem(createEmptyData(now), createProblemInputFromTemplate(template), {
      now,
      idFactory: () => "problem_1",
    });
    const snoozed = snoozeProblem(data, problem.id, {
      now,
      until: new Date("2026-05-21T00:00:00.000Z"),
    });
    const result = logAttempt(
      snoozed,
      problem.id,
      { result: "solved_clean" },
      { now, idFactory: () => "attempt_1" },
    );

    expect(result.problem.snoozedAt).toBeUndefined();
    expect(result.problem.snoozedUntil).toBeUndefined();
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
      reservedNewStartsPerDay: 1,
      extraDailyCapacity: {},
      focusMode: false,
      hideTagsInProblemLists: false,
    });
  });

  it("preserves a legacy review date as the ideal date when importing an older backup", () => {
    const parsed = parseLeetLoopData(
      JSON.stringify({
        version: 1,
        problems: [
          {
            id: "problem_1",
            title: "Two Sum",
            url: template.url,
            platform: "LeetCode",
            difficulty: "Easy",
            patterns: ["Arrays"],
            status: "reviewing",
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            nextReviewAt: "2026-05-20T12:00:00.000Z",
            reviewCount: 1,
            cleanStreak: 1,
          },
        ],
        attempts: [],
        updatedAt: now.toISOString(),
      }),
    );

    expect(parsed.problems[0]?.idealReviewAt).toBe("2026-05-20T12:00:00.000Z");
  });

  it("normalizes saved settings", () => {
    const parsed = parseLeetLoopData(
      JSON.stringify({
        version: 1,
        problems: [],
        attempts: [],
        settings: {
          dailyTarget: 99,
          reservedNewStartsPerDay: 99,
          extraDailyCapacity: {
            "2026-05-18": 3,
            nope: 4,
          },
          hideTagsInProblemLists: true,
        },
        updatedAt: now.toISOString(),
      }),
    );

    expect(parsed.settings).toEqual({
      dailyTarget: 20,
      reservedNewStartsPerDay: 20,
      extraDailyCapacity: {
        "2026-05-18": 3,
      },
      focusMode: false,
      hideTagsInProblemLists: true,
    });
  });

  it("detects template duplicates by LeetCode slug", () => {
    const { data } = addProblem(createEmptyData(now), createProblemInputFromTemplate(template), {
      now,
      idFactory: () => "problem_1",
    });

    expect(isTemplateAdded(template, data.problems)).toBe(true);
  });

  it("does not overwrite reviews when importing an existing problem from another template", () => {
    const topInterviewTwoSum = getProblemSetBySlug("top-interview-150")?.problems.find(
      (problem) => problem.titleSlug === "two-sum",
    );
    const neetcodeTwoSum = getProblemSetBySlug("neetcode-150")?.problems.find(
      (problem) => problem.titleSlug === "two-sum",
    );

    if (!topInterviewTwoSum || !neetcodeTwoSum) {
      throw new Error("Two Sum templates missing.");
    }

    const created = addProblem(createEmptyData(now), createProblemInputFromTemplate(topInterviewTwoSum), {
      now,
      idFactory: () => "problem_1",
    });
    const reviewed = logAttempt(
      created.data,
      created.problem.id,
      {
        result: "solved_clean",
        timeMinutes: 10,
      },
      { now, idFactory: () => "attempt_1" },
    );
    const imported = addProblemFromTemplate(reviewed.data, neetcodeTwoSum, {
      now,
      idFactory: () => "problem_2",
    });

    expect(imported.added).toBe(false);
    expect(imported.data).toBe(reviewed.data);
    expect(imported.data.problems).toHaveLength(1);
    expect(imported.data.attempts).toHaveLength(1);
    expect(imported.problem.id).toBe(created.problem.id);
    expect(imported.problem.reviewCount).toBe(reviewed.problem.reviewCount);
    expect(imported.problem.nextReviewAt).toBe(reviewed.problem.nextReviewAt);
    expect(imported.problem.lastResult).toBe(reviewed.problem.lastResult);
  });
});
