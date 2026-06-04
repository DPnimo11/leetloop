import type { Attempt } from "./attempt";
import type { Problem } from "./problem";

export type LeetLoopStorageVersion = 1;

export type LeetLoopSettings = {
  dailyTarget: number;
  extraDailyCapacity: Record<string, number>;
};

export type LeetLoopData = {
  version: LeetLoopStorageVersion;
  problems: Problem[];
  attempts: Attempt[];
  settings: LeetLoopSettings;
  updatedAt: string;
};
