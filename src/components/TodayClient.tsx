"use client";

import Link from "next/link";
import { Check, ExternalLink, ListPlus, Plus } from "lucide-react";
import { getAllProblemTemplates } from "@/lib/problemSets";
import { isDueToday, isOverdue, parseDate } from "@/lib/dates";
import { formatAttemptResult, formatDateTime } from "@/lib/format";
import type { Problem } from "@/types/problem";
import type { ProblemTemplate } from "@/types/problem-set";
import { DifficultyBadge, TagPill } from "./Badges";
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

export function TodayClient() {
  const { data, isTemplateInQueue, ready } = useLeetLoop();
  const today = new Date();
  const activeProblems = data.problems.filter((problem) => problem.status !== "retired");
  const overdue = sortByReviewDate(activeProblems.filter((problem) => isOverdue(problem.nextReviewAt, today)));
  const dueToday = sortByReviewDate(activeProblems.filter((problem) => isDueToday(problem.nextReviewAt, today)));
  const suggestedNew: ProblemTemplate[] = [];

  for (const template of getAllProblemTemplates()) {
    const alreadySuggested = suggestedNew.some((item) => item.titleSlug === template.titleSlug);

    if (!alreadySuggested && !isTemplateInQueue(template)) {
      suggestedNew.push(template);
    }

    if (suggestedNew.length >= 5) {
      break;
    }
  }
  const recentAttempts = [...data.attempts]
    .sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime())
    .slice(0, 5);
  const dueCount = overdue.length + dueToday.length;

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
            {dueCount ? `${dueCount} review${dueCount === 1 ? "" : "s"} ready` : "No reviews due today"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {dueCount
              ? "Start with overdue work, then clear today's queue."
              : "Nice. Add a new problem or pull one from a built-in list."}
          </p>
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
          <p className="text-sm text-[var(--muted)]">Overdue</p>
          <p className="mt-1 text-2xl font-semibold">{overdue.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">Due today</p>
          <p className="mt-1 text-2xl font-semibold">{dueToday.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">Active problems</p>
          <p className="mt-1 text-2xl font-semibold">{activeProblems.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">Attempts logged</p>
          <p className="mt-1 text-2xl font-semibold">{data.attempts.length}</p>
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
        {dueToday.length ? (
          dueToday.map((problem) => <ProblemCard key={problem.id} problem={problem} />)
        ) : (
          <EmptyState title="No problems due today" copy="Add a new problem or review a weak pattern." />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-normal">Suggested New</h2>
        {suggestedNew.length ? (
          suggestedNew.map((template) => <SuggestedProblemCard key={template.id} template={template} />)
        ) : (
          <EmptyState title="All templates added" copy="Every built-in template is already in your queue." />
        )}
      </section>

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
