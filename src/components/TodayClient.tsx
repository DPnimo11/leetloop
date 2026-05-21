"use client";

import Link from "next/link";
import { Check, ExternalLink, ListPlus, Plus } from "lucide-react";
import { getAllProblemTemplates } from "@/lib/problemSets";
import { isDueOnOrBefore, isDueToday, isOverdue, parseDate, toLocalDateKey } from "@/lib/dates";
import { formatAttemptResult, formatDateTime } from "@/lib/format";
import { countUnscheduledNewProblems, isReviewProblem, DAILY_PLAN_CAPACITY } from "@/lib/planning";
import type { Attempt } from "@/types/attempt";
import type { Problem } from "@/types/problem";
import type { ProblemTemplate } from "@/types/problem-set";
import { DifficultyBadge, StatusBadge, TagPill } from "./Badges";
import { EmptyState } from "./EmptyState";
import { useLeetLoop } from "./LeetLoopProvider";
import { ProblemCard } from "./ProblemCard";

function sortByReviewDate(problems: Problem[]): Problem[] {
  return [...problems].sort((a, b) => {
    const aTime = parseDate(a.nextReviewAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = parseDate(b.nextReviewAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

function SuggestedProblemCard({ template }: { template: ProblemTemplate }) {
  const { addProblemFromTemplate, ready } = useLeetLoop();
  const sourceLabel = template.sourceSetSlugs
    .map((slug) => (slug === "leetcode-75" ? "LeetCode 75" : "Top Interview 150"))
    .join(", ");

  return (
    <article className="rounded-lg border border-[var(--border)] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              className="text-base font-semibold tracking-normal hover:text-[var(--accent-strong)]"
              href={template.url}
              rel="noreferrer"
              target="_blank"
            >
              {template.title}
            </a>
            <DifficultyBadge difficulty={template.difficulty} />
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
            href={template.url}
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
            href={problem.url}
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
  const { data, isTemplateInQueue, ready } = useLeetLoop();
  const today = new Date();
  const activeProblems = data.problems.filter((problem) => problem.status !== "retired");
  const reviewProblems = activeProblems.filter(isReviewProblem);
  const overdue = sortByReviewDate(reviewProblems.filter((problem) => isOverdue(problem.nextReviewAt, today)));
  const dueToday = sortByReviewDate(reviewProblems.filter((problem) => isDueToday(problem.nextReviewAt, today)));
  const plannedNewToday = sortByReviewDate(
    activeProblems.filter(
      (problem) => problem.status === "new" && isDueOnOrBefore(problem.nextReviewAt, today),
    ),
  );
  const futurePlannedNewCount = activeProblems.filter(
    (problem) =>
      problem.status === "new" &&
      problem.nextReviewAt &&
      !isDueOnOrBefore(problem.nextReviewAt, today),
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
  const readyCount = overdue.length + dueToday.length + plannedNewToday.length;
  const todayPlan = [...dueToday, ...plannedNewToday];
  const completedToday = getCompletedDailyAttempts(data.attempts, today);
  const completedTodayCount = completedToday.length;
  const dailyPlanTotal = Math.max(DAILY_PLAN_CAPACITY, readyCount + completedTodayCount);
  const heroText = readyCount
    ? `${readyCount} of ${dailyPlanTotal} left today`
    : completedTodayCount
      ? "Daily plan complete"
      : "No reviews due today";
  const heroCopy = (() => {
    if (completedTodayCount && readyCount) {
      return `${completedTodayCount} done. Keep clearing the remaining planned work.`;
    }

    if (completedTodayCount) {
      return "Nice. Today's planned queue is clear, and completed items stay visible below.";
    }

    if (overdue.length || dueToday.length) {
      return "Start with overdue work, then clear today's queue.";
    }

    if (plannedNewToday.length) {
      return "No reviews are waiting. Start today's planned new problem.";
    }

    return "Nice. Add a new problem or pull one from a built-in list.";
  })();
  const emptyTodayCopy = completedTodayCount
    ? "Completed planned work stays visible in Done Today."
    : futurePlannedNewCount
      ? "Your new starts are planned for upcoming days."
      : "Add a new problem or review a weak pattern.";

  if (!ready) {
    return <EmptyState title="Loading queue" copy="Local data is loading." />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
            Today
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-[var(--foreground)]">
            {heroText}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{heroCopy}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
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
          <p className="mt-1 text-2xl font-semibold">{overdue.length + dueToday.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">New left</p>
          <p className="mt-1 text-2xl font-semibold">{plannedNewToday.length}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-normal">Overdue</h2>
        {overdue.length ? (
          overdue.map((problem) => <ProblemCard key={problem.id} problem={problem} />)
        ) : (
          <EmptyState title="Nothing overdue" copy="No missed reviews are waiting." />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-normal">Due Today</h2>
        {todayPlan.length ? (
          todayPlan.map((problem) => <ProblemCard key={problem.id} problem={problem} />)
        ) : (
          <EmptyState
            title={completedTodayCount ? "Daily plan complete" : "No work due today"}
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

      {todayPlan.length || completedToday.length ? (
        <section className="rounded-lg border border-[var(--border)] bg-white p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              Planned work fills the day up to {DAILY_PLAN_CAPACITY} items. Done items count toward today&apos;s slots.
            </p>
            <Link className="text-sm font-semibold text-[var(--accent-strong)] hover:underline" href="/upcoming">
              View upcoming
            </Link>
          </div>
        </section>
      ) : null}

      {!todayPlan.length && !completedToday.length && suggestedTemplates.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-normal">Suggested New</h2>
          {suggestedTemplates.map((template) => (
            <SuggestedProblemCard key={template.id} template={template} />
          ))}
        </section>
      ) : null}

      {!todayPlan.length && !completedToday.length && !suggestedTemplates.length && unscheduledNewCount ? (
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
