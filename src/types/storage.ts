import type { Attempt } from "./attempt";
import type { Problem } from "./problem";

export type LeetLoopStorageVersion = 1;

export type LeetLoopSettings = {
  dailyTarget: number;
  reservedNewStartsPerDay: number;
  extraDailyCapacity: Record<string, number>;
  // Optional in the type so partial settings literals stay valid; always
  // populated by createDefaultSettings / normalizeSettings in practice.
  focusMode?: boolean;
  hideTagsInProblemLists?: boolean;
};

export type LeetLoopData = {
  version: LeetLoopStorageVersion;
  problems: Problem[];
  attempts: Attempt[];
  settings: LeetLoopSettings;
  updatedAt: string;
};
