"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ExternalLink, ListPlus, Plus, RefreshCw } from "lucide-react";
import { getAllProblemTemplates, getProblemSetName } from "@/lib/problemSets";
import { toLocalDateKey } from "@/lib/dates";
import { formatAttemptResult, formatDateTime } from "@/lib/format";
import { leetLoopReviewUrl } from "@/lib/leetcode";
import {
  countRefillCandidateProblems,
  countUnscheduledNewProblems,
  getPlannedDateKey,
  getUpcomingPlan,
} from "@/lib/planning";
import { getDailyCapacityForDate, getReservedNewStarts, isFocusModeEnabled } from "@/lib/settings";
import type { Attempt } from "@/types/attempt";
import type { Problem } from "@/types/problem";
import type { ProblemTemplate } from "@/types/problem-set";
import { DifficultyBadge, PrimaryPatternBadge, StatusBadge, TagPill } from "./Badges";
import { DailyLeetCodeCard } from "./DailyLeetCodeCard";
import { EmptyState } from "./EmptyState";
import { useLeetLoop } from "./LeetLoopProvider";
import { ProblemCard } from "./ProblemCard";

function SuggestedProblemCard({ template }: { template: ProblemTemplate }) {
  const { addProblemFromTemplate, ready } = useLeetLoop();
  const sourceLabel = template.sourceSetSlugs.map(getProblemSetName).join(", ");

  return (
    <article className="rounded-lg border border-[var(--border)] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              className="text-base font-semibold tracking-normal hover:text-[var(--accent-strong)]"
              href={leetLoopReviewUrl(template.url)}
              rel="noreferrer"
              target="_blank"
            >
              {template.title}
            </a>
            <DifficultyBadge difficulty={template.difficulty} />
            <PrimaryPatternBadge pattern={template.primaryPattern} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {template.patterns.slice(0, 5).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">{sourceLabel}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
            href={leetLoopReviewUrl(template.url)}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={16} />
            Open
          </a>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
            disabled={!ready}
            onClick={() => addProblemFromTemplate(template)}
            type="button"
          >
            <ListPlus size={16} />
            Add
          </button>
        </div>
      </div>
    </article>
  );
}

// The concept most of today's new starts share, for the focus-mode label.
function mostCommonPrimaryPattern(problems: Problem[]): string | undefined {
  const counts = new Map<string, number>();
  for (const problem of problems) {
    if (problem.primaryPattern) {
      counts.set(problem.primaryPattern, (counts.get(problem.primaryPattern) ?? 0) + 1);
    }
  }

  let best: string | undefined;
  let bestCount = 0;
  for (const [pattern, count] of counts) {
    if (count > bestCount) {
      best = pattern;
      bestCount = count;
    }
  }

  return best;
}

function getCompletedDailyAttempts(attempts: Attempt[], today: Date): Attempt[] {
  const todayKey = toLocalDateKey(today);
  const latestByProblem = new Map<string, Attempt>();
  const matchingAttempts = [...attempts]
    .filter((attempt) => attempt.plannedForDate === todayKey)
    .sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime());

  for (const attempt of matchingAttempts) {
    if (latestByProblem.has(attempt.problemId)) {
      continue;
    }

    latestByProblem.set(attempt.problemId, attempt);
  }

  return [...latestByProblem.values()];
}

function CompletedProblemCard({ attempt, problem }: { attempt: Attempt; problem?: Problem }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {problem ? (
              <Link
                className="text-base font-semibold tracking-normal text-[var(--foreground)] hover:text-[var(--accent-strong)]"
                href={`/problems/${problem.id}`}
              >
                {problem.title}
              </Link>
            ) : (
              <span className="text-base font-semibold tracking-normal">Deleted problem</span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <Check size={12} />
              Done
            </span>
            {problem ? <DifficultyBadge difficulty={problem.difficulty} /> : null}
            {problem ? <StatusBadge status={problem.status} /> : null}
            {problem ? <PrimaryPatternBadge pattern={problem.primaryPattern} /> : null}
          </div>
          {problem ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {problem.patterns.slice(0, 5).map((tag) => (
                <TagPill key={tag} tag={tag} />
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-sm text-[var(--muted)]">
            {formatAttemptResult(attempt.result)}
            {attempt.timeMinutes ? ` - ${attempt.timeMinutes} min` : ""} - {formatDateTime(attempt.attemptedAt)}
          </p>
        </div>
        {problem ? (
          <a
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
            href={leetLoopReviewUrl(problem.url)}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={16} />
            Open
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function TodayClient() {
  const { data, isTemplateInQueue, ready, repopulateToday } = useLeetLoop();
  const [refillMessage, setRefillMessage] = useState("");
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const dailyCapacity = getDailyCapacityForDate(data, today);
  const reservedNewStarts = getReservedNewStarts(data.settings);
  const todayPlanDay = getUpcomingPlan(data, { now: today, days: 1 })[0];
  const plannedReviews = todayPlanDay?.reviews ?? [];
  const plannedNewToday = todayPlanDay?.newStarts ?? [];
  const focusConcept = isFocusModeEnabled(data.settings)
    ? mostCommonPrimaryPattern(plannedNewToday)
    : undefined;
  const deferredTodayCount = todayPlanDay?.deferredCount ?? 0;
  const activeProblems = data.problems.filter((problem) => problem.status !== "retired");
  const futurePlannedNewCount = activeProblems.filter(
    (problem) =>
      problem.status === "new" &&
      Boolean(getPlannedDateKey(problem) && getPlannedDateKey(problem)! > todayKey),
  ).length;
  const unscheduledNewCount = countUnscheduledNewProblems(data);
  const suggestedTemplates: ProblemTemplate[] = [];

  for (const template of getAllProblemTemplates()) {
    const alreadySuggested = suggestedTemplates.some((item) => item.titleSlug === template.titleSlug);

    if (!alreadySuggested && !isTemplateInQueue(template)) {
      suggestedTemplates.push(template);
    }

    if (suggestedTemplates.length >= 5) {
      break;
    }
  }
  const recentAttempts = [...data.attempts]
    .sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime())
    .slice(0, 5);
  const readyCount = plannedReviews.length + plannedNewToday.length;
  const todayPlan = [...plannedReviews, ...plannedNewToday];
  const completedToday = getCompletedDailyAttempts(data.attempts, today);
  const completedTodayCount = completedToday.length;
  const refillCandidateCount = countRefillCandidateProblems(data, today);
  const canRefillToday = readyCount === 0 && refillCandidateCount > 0;
  const dailyPlanTotal = Math.max(dailyCapacity, readyCount + completedTodayCount);
  const remainingNewProblemCount = activeProblems.filter((problem) => problem.status === "new").length;
  const clearedNewProblemCount = activeProblems.length - remainingNewProblemCount;
  const newProblemProgress =
    activeProblems.length > 0
      ? Math.round((clearedNewProblemCount / activeProblems.length) * 100)
      : 100;
  const heroText = readyCount
    ? `${readyCount} of ${dailyPlanTotal} left today`
    : completedTodayCount || deferredTodayCount
      ? "Daily plan complete"
      : "No reviews due today";
  const heroCopy = (() => {
    if (completedTodayCount && readyCount) {
      return `${completedTodayCount} done. Keep clearing the remaining planned work.`;
    }

    if (completedTodayCount) {
      return "Nice. Today's planned queue is clear, and completed items stay visible below.";
    }

    if (deferredTodayCount) {
      return "Snoozed work keeps its slot today, so the rest of the plan stays put.";
    }

    if (plannedReviews.length) {
      return "Start with the oldest review, then clear today's queue.";
    }

    if (plannedNewToday.length) {
      return "Start today's planned new problem.";
    }

    return "Nice. Add a new problem or pull one from a built-in list.";
  })();
  const emptyTodayCopy = completedTodayCount
    ? "Completed planned work stays visible in Done Today."
    : deferredTodayCount
      ? "Snoozed work keeps its slot today, so nothing backfills unexpectedly."
      : futurePlannedNewCount
        ? "Your new starts are planned for upcoming days."
        : "Add a new problem or review a weak pattern.";

  if (!ready) {
    return <EmptyState title="Loading queue" copy="Your data is loading." />;
  }

  function addMoreToday() {
    const addedCount = repopulateToday();
    setRefillMessage(
      addedCount
        ? `Added ${addedCount} more to today.`
        : "No queued new problems are available.",
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
              Today
            </p>
            {focusConcept ? (
              <span className="inline-flex rounded-full border border-[var(--accent)] bg-[#e6f4f1] px-2 py-0.5 text-xs font-semibold text-[var(--accent-strong)]">
                Focus: {focusConcept}
              </span>
            ) : null}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-[var(--foreground)]">
            {heroText}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{heroCopy}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRefillToday ? (
            <button
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
              onClick={addMoreToday}
              type="button"
            >
              <RefreshCw size={16} />
              Add more today
            </button>
          ) : null}
          <Link
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-subtle)]"
            href="/add"
          >
            <Plus size={16} />
            Add problem
          </Link>
          <Link
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-subtle)]"
            href="/problem-sets"
          >
            Browse sets
          </Link>
        </div>
        {refillMessage ? (
          <p className="text-sm font-medium text-emerald-700 sm:basis-full">{refillMessage}</p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">Remaining today</p>
          <p className="mt-1 text-2xl font-semibold">{readyCount}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">Done today</p>
          <p className="mt-1 text-2xl font-semibold">{completedTodayCount}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">Reviews left</p>
          <p className="mt-1 text-2xl font-semibold">{plannedReviews.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">New left</p>
          <p className="mt-1 text-2xl font-semibold">{plannedNewToday.length}</p>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">New problem queue</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {remainingNewProblemCount
                ? `${remainingNewProblemCount} more problem${remainingNewProblemCount === 1 ? "" : "s"} to solve before there are no new problems left.`
                : "No new problems left."}
            </p>
          </div>
          <p className="text-sm font-semibold text-[var(--accent-strong)]">
            {newProblemProgress}% clear
          </p>
        </div>
        <div
          aria-label={`${remainingNewProblemCount} new problems left`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={newProblemProgress}
          className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--surface-subtle)]"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${newProblemProgress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-medium text-[var(--muted)]">
          <span>{clearedNewProblemCount} cleared</span>
          <span>{activeProblems.length} active</span>
        </div>
      </section>

      <DailyLeetCodeCard />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-normal">Today&apos;s Plan</h2>
        {todayPlan.length ? (
          todayPlan.map((problem) => <ProblemCard key={problem.id} problem={problem} />)
        ) : (
          <EmptyState
            title={completedTodayCount || deferredTodayCount ? "Daily plan complete" : "No work due today"}
            copy={emptyTodayCopy}
          />
        )}
      </section>

      {completedToday.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-normal">Done Today</h2>
          {completedToday.map((attempt) => (
            <CompletedProblemCard
              attempt={attempt}
              key={`${attempt.problemId}-${attempt.id}`}
              problem={data.problems.find((problem) => problem.id === attempt.problemId)}
            />
          ))}
        </section>
      ) : null}

      {todayPlan.length || completedToday.length || deferredTodayCount ? (
        <section className="rounded-lg border border-[var(--border)] bg-white p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              {reservedNewStarts
                ? `Planning reserves up to ${reservedNewStarts} new-start slot${reservedNewStarts === 1 ? "" : "s"} when available. Review collisions are leveled across upcoming days.`
                : `Reviews fill the ${dailyCapacity}-item plan before new starts. Review collisions are leveled across upcoming days.`}
            </p>
            <Link className="text-sm font-semibold text-[var(--accent-strong)] hover:underline" href="/upcoming">
              View upcoming
            </Link>
          </div>
        </section>
      ) : null}

      {!todayPlan.length && !completedToday.length && !deferredTodayCount && suggestedTemplates.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-normal">Suggested New</h2>
          {suggestedTemplates.map((template) => (
            <SuggestedProblemCard key={template.id} template={template} />
          ))}
        </section>
      ) : null}

      {!todayPlan.length && !completedToday.length && !deferredTodayCount && !suggestedTemplates.length && unscheduledNewCount ? (
        <EmptyState
          title="Upcoming plan is full"
          copy="More new problems will be scheduled as space opens."
        />
      ) : null}

      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
        <div className="flex items-center gap-2">
          <Check className="text-[var(--accent)]" size={18} />
          <h2 className="text-xl font-semibold tracking-normal">Recently Attempted</h2>
        </div>
        {recentAttempts.length ? (
          <div className="mt-4 space-y-3">
            {recentAttempts.map((attempt) => {
              const problem = data.problems.find((item) => item.id === attempt.problemId);

              return (
                <article className="rounded-md border border-[var(--border)] p-3" key={attempt.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {problem ? (
                      <Link
                        className="font-semibold hover:text-[var(--accent-strong)]"
                        href={`/problems/${problem.id}`}
                      >
                        {problem.title}
                      </Link>
                    ) : (
                      <span className="font-semibold">Deleted problem</span>
                    )}
                    <span className="text-sm text-[var(--muted)]">{formatDateTime(attempt.attemptedAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {formatAttemptResult(attempt.result)}
                    {attempt.timeMinutes ? ` - ${attempt.timeMinutes} min` : ""}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">No attempts logged yet.</p>
        )}
      </section>
    </div>
  );
}
