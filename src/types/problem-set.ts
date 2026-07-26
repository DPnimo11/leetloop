import type { Difficulty } from "./problem";

export const BUILT_IN_PROBLEM_SET_SLUGS = ["leetcode-75", "top-interview-150", "neetcode-150"] as const;

export type BuiltInProblemSetSlug = (typeof BUILT_IN_PROBLEM_SET_SLUGS)[number];

export type ProblemTemplate = {
  id: string;
  title: string;
  titleSlug: string;
  url: string;
  platform: "LeetCode";
  difficulty: Difficulty;
  patterns: string[];
  primaryPattern?: string;
  sourceSetSlugs: BuiltInProblemSetSlug[];
  sourceGroups: string[];
  questionFrontendId?: string;
  neetcodeSlug?: string;
};

export type ProblemSet = {
  slug: BuiltInProblemSetSlug;
  name: string;
  description: string;
  sourceUrl: string;
  problems: ProblemTemplate[];
};
