import type { Difficulty } from "@/types/problem";
import { leetcodeProblemUrl, normalizeLeetcodeSlug } from "./problemSets";

export const LEETCODE_PROBLEM_QUERY = `
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    difficulty
    isPaidOnly
    title
    titleSlug
    topicTags {
      name
      slug
    }
  }
}
`;

export type LeetCodeProblemMetadata = {
  url: string;
  title: string;
  titleSlug: string;
  difficulty: Difficulty;
  paidOnly: boolean;
  topicTags: {
    name: string;
    slug: string;
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeDifficulty(value: unknown): Difficulty | undefined {
  const normalized = getString(value)?.toLowerCase();

  if (normalized === "easy") {
    return "Easy";
  }

  if (normalized === "medium") {
    return "Medium";
  }

  if (normalized === "hard") {
    return "Hard";
  }

  return undefined;
}

export function parseLeetCodeProblemUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const supportedProtocol = url.protocol === "https:" || url.protocol === "http:";
    const supportedHost = hostname === "leetcode.com" || hostname === "www.leetcode.com";

    if (!supportedProtocol || !supportedHost) {
      return undefined;
    }

    const match = url.pathname.match(/^\/problems\/([^/]+)/);
    return match?.[1] ? normalizeLeetcodeSlug(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

export function parseLeetCodeProblemMetadata(
  payload: unknown,
): LeetCodeProblemMetadata | undefined {
  if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.question)) {
    return undefined;
  }

  const question = payload.data.question;
  const title = getString(question.title);
  const titleSlug = getString(question.titleSlug);
  const difficulty = normalizeDifficulty(question.difficulty);

  if (!title || !titleSlug || !difficulty) {
    return undefined;
  }

  const rawTopicTags = Array.isArray(question.topicTags) ? question.topicTags : [];
  const topicTags = rawTopicTags
    .filter(isRecord)
    .map((tag) => ({
      name: getString(tag.name),
      slug: getString(tag.slug),
    }))
    .filter((tag): tag is { name: string; slug: string } => Boolean(tag.name && tag.slug));

  return {
    url: leetcodeProblemUrl(titleSlug),
    title,
    titleSlug,
    difficulty,
    paidOnly: question.isPaidOnly === true || question.paidOnly === true,
    topicTags,
  };
}
