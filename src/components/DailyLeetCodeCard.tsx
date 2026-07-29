"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ExternalLink,
  History,
  ListPlus,
  RefreshCw,
} from "lucide-react";
import { toLocalDateKey } from "@/lib/dates";
import type { LeetCodeDailyProblem } from "@/lib/dailyLeetcode";
import { leetLoopReviewUrl } from "@/lib/leetcode";
import { getProblemLeetcodeSlug } from "@/lib/problemSets";
import { areProblemListTagsHidden } from "@/lib/settings";
import { normalizePatternTags } from "@/lib/tags";
import type { Problem } from "@/types/problem";
import { AttemptModal } from "./AttemptModal";
import { DifficultyBadge, TagPill } from "./Badges";
import { useLeetLoop } from "./LeetLoopProvider";

type DailyProblemResponse = {
  problem?: LeetCodeDailyProblem;
  error?: string;
};

type LoadState = "loading" | "ready" | "error";

function formatDailyDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return "Today";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function DailyLeetCodeCard() {
  const { addProblem, data, ready } = useLeetLoop();
  const [dailyProblem, setDailyProblem] = useState<LeetCodeDailyProblem>();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [addedProblem, setAddedProblem] = useState<{
    id: string;
    titleSlug: string;
  }>();
  const [loggingProblem, setLoggingProblem] = useState<Problem>();

  useEffect(() => {
    const controller = new AbortController();

    async function loadDailyProblem() {
      setLoadState("loading");
      setError("");

      try {
        const response = await fetch("/api/leetcode/daily", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as DailyProblemResponse;

        if (!response.ok || !payload.problem) {
          throw new Error(payload.error ?? "Could not load the LeetCode daily problem.");
        }

        setDailyProblem(payload.problem);
        setLoadState("ready");
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load the LeetCode daily problem.",
        );
        setLoadState("error");
      }
    }

    loadDailyProblem();

    return () => controller.abort();
  }, [refreshKey]);

  const existingProblem = useMemo(() => {
    if (!dailyProblem) {
      return undefined;
    }

    return data.problems.find(
      (problem) => getProblemLeetcodeSlug(problem) === dailyProblem.titleSlug,
    );
  }, [dailyProblem, data.problems]);
  const addedProblemForDaily =
    addedProblem && dailyProblem && addedProblem.titleSlug === dailyProblem.titleSlug
      ? data.problems.find((problem) => problem.id === addedProblem.id)
      : undefined;
  const queuedProblem = existingProblem ?? addedProblemForDaily;
  const topicTags = useMemo(
    () => normalizePatternTags(dailyProblem?.topicTags.map((tag) => tag.name) ?? []),
    [dailyProblem],
  );
  const hideTags = areProblemListTagsHidden(data.settings);
  const completedToday = queuedProblem
    ? data.attempts.some(
        (attempt) =>
          attempt.problemId === queuedProblem.id &&
          toLocalDateKey(new Date(attempt.attemptedAt)) === toLocalDateKey(new Date()),
      )
    : false;

  function addAndLogDailyProblem() {
    if (!dailyProblem) {
      return;
    }

    if (queuedProblem) {
      setLoggingProblem(queuedProblem);
      return;
    }

    const createdProblem = addProblem(
      {
        title: dailyProblem.title,
        url: dailyProblem.url,
        platform: "LeetCode",
        difficulty: dailyProblem.difficulty,
        patterns: topicTags,
        status: "new",
        notes: `LeetCode daily challenge for ${dailyProblem.date}.`,
        leetcodeSlug: dailyProblem.titleSlug,
      },
      { preserveToday: true },
    );

    setAddedProblem({
      id: createdProblem.id,
      titleSlug: dailyProblem.titleSlug,
    });
    setLoggingProblem(createdProblem);
  }

  if (loadState === "loading") {
    return (
      <article className="rounded-lg border border-[var(--border)] bg-white p-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="animate-spin text-[var(--accent)]" size={18} />
          <h2 className="text-lg font-semibold tracking-normal">LeetCode Daily</h2>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">Loading today&apos;s challenge.</p>
      </article>
    );
  }

  if (loadState === "error" || !dailyProblem) {
    return (
      <article className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle className="text-amber-700" size={18} />
              <h2 className="text-lg font-semibold tracking-normal">LeetCode Daily</h2>
            </div>
            <p className="mt-2 text-sm text-amber-800">{error}</p>
          </div>
          <button
            className="inline-flex w-fit items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-[var(--border)] bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-strong)]">
              <CalendarDays size={16} />
              LeetCode Daily
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
              {formatDailyDate(dailyProblem.date)}
            </span>
            {dailyProblem.paidOnly ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                Premium
              </span>
            ) : null}
            {completedToday ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <Check size={12} />
                Done today
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {queuedProblem ? (
              <Link
                className="text-lg font-semibold tracking-normal text-[var(--foreground)] hover:text-[var(--accent-strong)]"
                href={`/problems/${queuedProblem.id}`}
              >
                {dailyProblem.title}
              </Link>
            ) : (
              <span className="text-lg font-semibold tracking-normal text-[var(--foreground)]">
                {dailyProblem.title}
              </span>
            )}
            <DifficultyBadge difficulty={dailyProblem.difficulty} />
          </div>

          {!hideTags && topicTags.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topicTags.slice(0, 6).map((tag) => (
                <TagPill key={tag} tag={tag} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
            href={leetLoopReviewUrl(dailyProblem.url)}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={16} />
            Open
          </a>
          {queuedProblem ? (
            <button
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
              onClick={() => setLoggingProblem(queuedProblem)}
              type="button"
            >
              <History size={16} />
              Log
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
              disabled={!ready}
              onClick={addAndLogDailyProblem}
              type="button"
            >
              <ListPlus size={16} />
              Add & Log
            </button>
          )}
        </div>
      </div>
      {loggingProblem ? (
        <AttemptModal
          onClose={() => setLoggingProblem(undefined)}
          open={Boolean(loggingProblem)}
          problem={loggingProblem}
        />
      ) : null}
    </article>
  );
}
