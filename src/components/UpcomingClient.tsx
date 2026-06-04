"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { countUnscheduledNewProblems, getUpcomingPlan } from "@/lib/planning";
import { formatDate } from "@/lib/format";
import { leetLoopReviewUrl } from "@/lib/leetcode";
import { getDailyTarget } from "@/lib/settings";
import type { Problem } from "@/types/problem";
import { DifficultyBadge, StatusBadge, TagPill } from "./Badges";
import { EmptyState } from "./EmptyState";
import { useLeetLoop } from "./LeetLoopProvider";

function ProblemRow({ problem, kind }: { problem: Problem; kind: "review" | "new" }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="font-semibold hover:text-[var(--accent-strong)]"
              href={`/problems/${problem.id}`}
            >
              {problem.title}
            </Link>
            <DifficultyBadge difficulty={problem.difficulty} />
            <StatusBadge status={problem.status} />
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
              {kind === "review" ? "Review" : "Start"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {problem.patterns.slice(0, 4).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        </div>
        <a
          className="text-sm font-semibold text-[var(--accent-strong)] hover:underline"
          href={leetLoopReviewUrl(problem.url)}
          rel="noreferrer"
          target="_blank"
        >
          Open
        </a>
      </div>
    </div>
  );
}

export function UpcomingClient() {
  const { data, ready } = useLeetLoop();
  const plan = getUpcomingPlan(data);
  const unscheduledNewCount = countUnscheduledNewProblems(data);
  const dailyTarget = getDailyTarget(data.settings);

  if (!ready) {
    return <EmptyState title="Loading upcoming plan" copy="Local data is loading." />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
              Upcoming
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Next 14 days</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Daily target: {dailyTarget}. Reviews take priority; new starts fill open space.
            </p>
          </div>
          <div className="rounded-md bg-[var(--surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--muted)]">
            {unscheduledNewCount} unscheduled new
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {plan.map((day, index) => {
          const dateLabel = index === 0 ? "Today" : formatDate(day.date.toISOString());
          const openSlots = Math.max(0, day.capacity - day.load);

          return (
            <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4" key={day.dateKey}>
              <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="text-[var(--accent)]" size={18} />
                  <div>
                    <h2 className="text-lg font-semibold tracking-normal">{dateLabel}</h2>
                    <p className="text-sm text-[var(--muted)]">{day.dateKey}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full border border-[var(--border)] bg-white px-2 py-1">
                    {day.load}/{day.capacity} planned
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-white px-2 py-1">
                    {day.reviews.length} reviews
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-white px-2 py-1">
                    {day.newStarts.length} new
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-white px-2 py-1">
                    {day.completedCount} done
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-white px-2 py-1">
                    {openSlots} open
                  </span>
                </div>
              </div>

              {day.reviews.length || day.newStarts.length ? (
                <div className="mt-3 space-y-3">
                  {day.reviews.map((problem) => (
                    <ProblemRow key={problem.id} kind="review" problem={problem} />
                  ))}
                  {day.newStarts.map((problem) => (
                    <ProblemRow key={problem.id} kind="new" problem={problem} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--muted)]">Nothing planned.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
