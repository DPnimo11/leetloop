import type { Attempt } from "./attempt";
import type { Problem } from "./problem";

export type LeetLoopStorageVersion = 1;

export type LeetLoopSettings = {
  dailyTarget: number;
  reservedNewStartsPerDay: number;
  extraDailyCapacity: Record<string, number>;
  // Manual category focus: schedule new problems from this concept first.
  // Undefined means no preference.
  priorityCategory?: string;
};

export type LeetLoopData = {
  version: LeetLoopStorageVersion;
  problems: Problem[];
  attempts: Attempt[];
  settings: LeetLoopSettings;
  updatedAt: string;
};
