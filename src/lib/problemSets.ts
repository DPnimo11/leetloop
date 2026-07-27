import type { Problem } from "@/types/problem";
import type {
  BuiltInProblemSetSlug,
  ProblemSet,
  ProblemTemplate,
} from "@/types/problem-set";
import type { ProblemInput } from "@/types/problem";
import { RAW_PROBLEM_SET_ENTRIES } from "./problemSetData";
import { inferPrimaryPattern, normalizePatternTags } from "./tags";

export const LEETCODE_PROBLEM_BASE_URL = "https://leetcode.com/problems";

export type RawProblemSetEntry = readonly [
  setSlug: BuiltInProblemSetSlug,
  sourceGroup: string,
  questionFrontendId: string,
  titleSlug: string,
  title: string,
  difficulty: "EASY" | "MEDIUM" | "HARD",
  topicTags: string,
  neetcodeSlug?: string,
];

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
  {
    slug: "neetcode-150",
    name: "NeetCode 150",
    description: "Curated NeetCode list organized by interview problem pattern.",
    sourceUrl: "https://neetcode.io/practice/practice/neetcode150",
  },
];

const DIFFICULTY_LABELS = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
} as const;

function getSetMembershipsBySlug(): Map<string, BuiltInProblemSetSlug[]> {
  const memberships = new Map<string, Set<BuiltInProblemSetSlug>>();

  for (const [setSlug, , , titleSlug] of RAW_PROBLEM_SET_ENTRIES) {
    const existing = memberships.get(titleSlug) ?? new Set<BuiltInProblemSetSlug>();
    existing.add(setSlug);
    memberships.set(titleSlug, existing);
  }

  return new Map(
    Array.from(memberships.entries()).map(([titleSlug, setSlugs]) => [titleSlug, Array.from(setSlugs)]),
  );
}

const SET_MEMBERSHIPS_BY_SLUG = getSetMembershipsBySlug();

function getNeetcodeSlugAliases(): Map<string, string> {
  const aliases = new Map<string, string>();

  for (const [, , , titleSlug, , , , neetcodeSlug] of RAW_PROBLEM_SET_ENTRIES) {
    if (neetcodeSlug) {
      aliases.set(neetcodeSlug, titleSlug);
    }
  }

  return aliases;
}

const NEETCODE_SLUG_ALIASES = getNeetcodeSlugAliases();

function normalizeSlug(value: string): string {
  return value.trim().replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
}

function canonicalizeLeetcodeSlug(slug: string): string {
  const normalized = normalizeSlug(slug);
  return NEETCODE_SLUG_ALIASES.get(normalized) ?? normalized;
}

function createTemplateFromEntry(entry: RawProblemSetEntry): ProblemTemplate {
  const [setSlug, sourceGroup, questionFrontendId, titleSlug, title, difficulty, topicTags, neetcodeSlug] = entry;
  const patterns = normalizePatternTags(topicTags.split("|").filter(Boolean));

  return {
    id: `${setSlug}:${titleSlug}`,
    title,
    titleSlug,
    url: leetcodeProblemUrl(titleSlug),
    platform: "LeetCode",
    difficulty: DIFFICULTY_LABELS[difficulty],
    patterns,
    primaryPattern: inferPrimaryPattern(patterns, [sourceGroup]),
    sourceSetSlugs: SET_MEMBERSHIPS_BY_SLUG.get(titleSlug) ?? [setSlug],
    sourceGroups: [sourceGroup],
    questionFrontendId,
    neetcodeSlug,
  };
}

export const BUILT_IN_PROBLEM_SETS: ProblemSet[] = BUILT_IN_PROBLEM_SET_META.map((set) => ({
  ...set,
  problems: RAW_PROBLEM_SET_ENTRIES.filter(([setSlug]) => setSlug === set.slug).map(createTemplateFromEntry),
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
    const hostname = url.hostname.toLowerCase();
    const leetcodeMatch = url.pathname.match(/\/problems\/([^/]+)/);
    const neetcodeMatch =
      hostname === "neetcode.io" || hostname === "www.neetcode.io"
        ? url.pathname.match(/\/(?:problems|solutions)\/([^/]+)/)
        : undefined;
    const match = neetcodeMatch ?? leetcodeMatch;

    return match?.[1] ? canonicalizeLeetcodeSlug(match[1]) : undefined;
  } catch {
    const slug = trimmed
      .replace(/^\/?(?:problems|solutions)\//, "")
      .replace(/\/question\/?$/, "")
      .replace(/\/$/, "");

    return canonicalizeLeetcodeSlug(slug);
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
    primaryPattern: template.primaryPattern,
    status: "new",
    leetcodeSlug: template.titleSlug,
    sourceSetSlugs: template.sourceSetSlugs,
  };
}

export function getProblemSetBySlug(slug: BuiltInProblemSetSlug): ProblemSet | undefined {
  return BUILT_IN_PROBLEM_SETS.find((set) => set.slug === slug);
}

export function getProblemSetName(slug: string): string {
  return BUILT_IN_PROBLEM_SET_META.find((set) => set.slug === slug)?.name ?? slug;
}

export function getAllProblemTemplates(): ProblemTemplate[] {
  return BUILT_IN_PROBLEM_SETS.flatMap((set) => set.problems);
}
