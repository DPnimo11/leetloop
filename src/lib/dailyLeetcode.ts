import type { Difficulty } from "@/types/problem";
import { leetcodeProblemUrl } from "./problemSets";

export const LEETCODE_DAILY_QUERY = `
query questionOfToday {
  activeDailyCodingChallengeQuestion {
    date
    link
    question {
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
}
`;

export type LeetCodeDailyProblem = {
  date: string;
  link: string;
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

function absoluteLeetCodeUrl(link: string | undefined, titleSlug: string): string {
  if (!link) {
    return leetcodeProblemUrl(titleSlug);
  }

  try {
    return new URL(link, "https://leetcode.com").toString();
  } catch {
    return leetcodeProblemUrl(titleSlug);
  }
}

export function parseLeetCodeDailyProblem(payload: unknown): LeetCodeDailyProblem | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return undefined;
  }

  const challenge = payload.data.activeDailyCodingChallengeQuestion;

  if (!isRecord(challenge) || !isRecord(challenge.question)) {
    return undefined;
  }

  const date = getString(challenge.date);
  const rawLink = getString(challenge.link);
  const title = getString(challenge.question.title);
  const titleSlug = getString(challenge.question.titleSlug);
  const difficulty = normalizeDifficulty(challenge.question.difficulty);

  if (!date || !title || !titleSlug || !difficulty) {
    return undefined;
  }

  const rawTopicTags = Array.isArray(challenge.question.topicTags)
    ? challenge.question.topicTags
    : [];
  const topicTags = rawTopicTags
    .filter(isRecord)
    .map((tag) => ({
      name: getString(tag.name),
      slug: getString(tag.slug),
    }))
    .filter((tag): tag is { name: string; slug: string } => Boolean(tag.name && tag.slug));
  const url = absoluteLeetCodeUrl(rawLink, titleSlug);

  return {
    date,
    link: url,
    url,
    title,
    titleSlug,
    difficulty,
    paidOnly: challenge.question.isPaidOnly === true || challenge.question.paidOnly === true,
    topicTags,
  };
}
