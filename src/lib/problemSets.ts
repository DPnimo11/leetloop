import type { Problem } from "@/types/problem";
import type {
  BuiltInProblemSetSlug,
  ProblemSet,
  ProblemTemplate,
} from "@/types/problem-set";
import type { ProblemInput } from "@/types/problem";
import { normalizePatternTags } from "./tags";

export const LEETCODE_PROBLEM_BASE_URL = "https://leetcode.com/problems";

export const BUILT_IN_PROBLEM_SET_META: Omit<ProblemSet, "problems">[] = [
  {
    slug: "leetcode-75",
    name: "LeetCode 75",
    description: "Official 75-question LeetCode study plan for interview fundamentals.",
    sourceUrl: "https://leetcode.com/studyplan/leetcode-75/",
  },
  {
    slug: "top-interview-150",
    name: "Top Interview 150",
    description: "Official LeetCode list of 150 classic interview questions.",
    sourceUrl: "https://leetcode.com/studyplan/top-interview-150/",
  },
];

export const BUILT_IN_PROBLEM_SETS: ProblemSet[] = BUILT_IN_PROBLEM_SET_META.map((set) => ({
  ...set,
  problems: [],
}));

export function leetcodeProblemUrl(titleSlug: string): string {
  return `${LEETCODE_PROBLEM_BASE_URL}/${titleSlug}/`;
}

export function normalizeLeetcodeSlug(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/problems\/([^/]+)/);
    return match?.[1]?.toLowerCase();
  } catch {
    return trimmed
      .replace(/^\/?problems\//, "")
      .replace(/\/$/, "")
      .toLowerCase();
  }
}

export function getProblemLeetcodeSlug(problem: Pick<Problem, "url" | "leetcodeSlug">): string | undefined {
  return problem.leetcodeSlug ?? normalizeLeetcodeSlug(problem.url);
}

export function isTemplateAdded(template: ProblemTemplate, problems: Problem[]): boolean {
  return problems.some((problem) => getProblemLeetcodeSlug(problem) === template.titleSlug);
}

export function createProblemInputFromTemplate(template: ProblemTemplate): ProblemInput {
  return {
    title: template.title,
    url: template.url,
    platform: "LeetCode",
    difficulty: template.difficulty,
    patterns: normalizePatternTags(template.patterns),
    status: "new",
    leetcodeSlug: template.titleSlug,
    sourceSetSlugs: template.sourceSetSlugs,
  };
}

export function getProblemSetBySlug(slug: BuiltInProblemSetSlug): ProblemSet | undefined {
  return BUILT_IN_PROBLEM_SETS.find((set) => set.slug === slug);
}

export function getAllProblemTemplates(): ProblemTemplate[] {
  return BUILT_IN_PROBLEM_SETS.flatMap((set) => set.problems);
}
