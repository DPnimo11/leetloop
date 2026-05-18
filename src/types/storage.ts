import type { Attempt } from "./attempt";
import type { Problem } from "./problem";

export type LeetLoopStorageVersion = 1;

export type LeetLoopData = {
  version: LeetLoopStorageVersion;
  problems: Problem[];
  attempts: Attempt[];
  updatedAt: string;
};
