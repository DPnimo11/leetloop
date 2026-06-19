"use client";

import { SHAKY_ATTEMPT_RESULTS, type AttemptResult } from "@/types/attempt";
import { isDueToday, isOverdue } from "@/lib/dates";
import { EmptyState } from "./EmptyState";
import { BackupControls } from "./BackupControls";
import { useLeetLoop } from "./LeetLoopProvider";

type PatternStat = {
  pattern: string;
  problemCount: number;
  attemptCount: number;
  shakyCount: number;
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function AnalyticsClient() {
  const { data, ready } = useLeetLoop();
  const today = new Date();
  const attemptedProblemIds = new Set(data.attempts.map((attempt) => attempt.problemId));
  const dueToday = data.problems.filter((problem) => isDueToday(problem.nextReviewAt, today)).length;
  const overdue = data.problems.filter((problem) => isOverdue(problem.nextReviewAt, today)).length;
  const activeProblems = data.problems.filter((problem) => problem.status !== "retired");
  const shakyResults = new Set<AttemptResult>(SHAKY_ATTEMPT_RESULTS);
  const patternStats = new Map<string, PatternStat>();

  for (const problem of data.problems) {
    for (const pattern of problem.patterns) {
      const current = patternStats.get(pattern) ?? {
        pattern,
        problemCount: 0,
        attemptCount: 0,
        shakyCount: 0,
      };
      current.problemCount += 1;
      patternStats.set(pattern, current);
    }
  }

  for (const attempt of data.attempts) {
    const problem = data.problems.find((item) => item.id === attempt.problemId);

    if (!problem) {
      continue;
    }

    for (const pattern of problem.patterns) {
      const current = patternStats.get(pattern) ?? {
        pattern,
        problemCount: 0,
        attemptCount: 0,
        shakyCount: 0,
      };
      current.attemptCount += 1;
      current.shakyCount += shakyResults.has(attempt.result) ? 1 : 0;
      patternStats.set(pattern, current);
    }
  }

  const patternsByCount = Array.from(patternStats.values())
    .sort((a, b) => b.problemCount - a.problemCount || a.pattern.localeCompare(b.pattern))
    .slice(0, 10);
  const weakPatterns = Array.from(patternStats.values())
    .filter((item) => item.attemptCount > 0)
    .sort(
      (a, b) =>
        b.shakyCount / b.attemptCount - a.shakyCount / a.attemptCount ||
        b.attemptCount - a.attemptCount ||
        a.pattern.localeCompare(b.pattern),
    )
    .slice(0, 8);

  if (!ready) {
    return <EmptyState title="Loading analytics" copy="Your data is loading." />;
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Problems attempted" value={attemptedProblemIds.size} />
        <StatCard label="Active problems" value={activeProblems.length} />
        <StatCard label="Due today" value={dueToday} />
        <StatCard label="Overdue" value={overdue} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-white p-5">
          <h2 className="text-xl font-semibold tracking-normal">Problems by Pattern</h2>
          {patternsByCount.length ? (
            <div className="mt-4 space-y-3">
              {patternsByCount.map((item) => (
                <div key={item.pattern}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">{item.pattern}</span>
                    <span className="text-[var(--muted)]">{item.problemCount}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{
                        width: `${Math.max(8, (item.problemCount / Math.max(1, activeProblems.length)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">No tagged problems yet.</p>
          )}
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-white p-5">
          <h2 className="text-xl font-semibold tracking-normal">Weak Patterns</h2>
          {weakPatterns.length ? (
            <div className="mt-4 space-y-3">
              {weakPatterns.map((item) => {
                const ratio = item.shakyCount / item.attemptCount;

                return (
                  <div className="rounded-md border border-[var(--border)] p-3" key={item.pattern}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{item.pattern}</span>
                      <span className="text-sm font-semibold text-[var(--warning)]">{percent(ratio)}</span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.shakyCount} shaky of {item.attemptCount} attempts
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Log a few attempts and weak patterns will show up here.
            </p>
          )}
        </div>
      </section>

      <BackupControls />
    </div>
  );
}
