"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { isDueOnOrBefore, isOverdue } from "@/lib/dates";
import { DIFFICULTIES, PROBLEM_STATUSES, type Difficulty, type ProblemStatus } from "@/types/problem";
import { DEFAULT_PATTERN_TAGS } from "@/lib/tags";
import { EmptyState } from "./EmptyState";
import { ProblemCard } from "./ProblemCard";
import { useLeetLoop } from "./LeetLoopProvider";

type DueFilter = "all" | "due" | "overdue" | "not-due";

export function ProblemsClient() {
  const { data, ready } = useLeetLoop();
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const [status, setStatus] = useState<"all" | ProblemStatus>("all");
  const [pattern, setPattern] = useState("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");

  const availablePatterns = useMemo(
    () =>
      Array.from(
        new Set([...DEFAULT_PATTERN_TAGS, ...data.problems.flatMap((problem) => problem.patterns)]),
      ).sort((a, b) => a.localeCompare(b)),
    [data.problems],
  );

  const filteredProblems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = new Date();

    return data.problems.filter((problem) => {
      const matchesSearch =
        !query ||
        problem.title.toLowerCase().includes(query) ||
        problem.patterns.some((tag) => tag.toLowerCase().includes(query));
      const matchesDifficulty = difficulty === "all" || problem.difficulty === difficulty;
      const matchesStatus = status === "all" || problem.status === status;
      const matchesPattern = pattern === "all" || problem.patterns.includes(pattern);
      const due = isDueOnOrBefore(problem.nextReviewAt, today);
      const overdue = isOverdue(problem.nextReviewAt, today);
      const matchesDue =
        dueFilter === "all" ||
        (dueFilter === "due" && due) ||
        (dueFilter === "overdue" && overdue) ||
        (dueFilter === "not-due" && !due);

      return matchesSearch && matchesDifficulty && matchesStatus && matchesPattern && matchesDue;
    });
  }, [data.problems, difficulty, dueFilter, pattern, search, status]);

  if (!ready) {
    return <EmptyState title="Loading problems" copy="Your data is loading." />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--border)] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_170px_220px_160px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-[var(--muted)]" size={16} />
            <input
              className="w-full rounded-md border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search problems"
              value={search}
            />
          </label>

          <select
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            onChange={(event) => setDifficulty(event.target.value as "all" | Difficulty)}
            value={difficulty}
          >
            <option value="all">All difficulties</option>
            {DIFFICULTIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            onChange={(event) => setStatus(event.target.value as "all" | ProblemStatus)}
            value={status}
          >
            <option value="all">All statuses</option>
            {PROBLEM_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            onChange={(event) => setPattern(event.target.value)}
            value={pattern}
          >
            <option value="all">All patterns</option>
            {availablePatterns.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            onChange={(event) => setDueFilter(event.target.value as DueFilter)}
            value={dueFilter}
          >
            <option value="all">All reviews</option>
            <option value="due">Due</option>
            <option value="overdue">Overdue</option>
            <option value="not-due">Not due</option>
          </select>

          <Link
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
            href="/add"
          >
            <Plus size={16} />
            Add
          </Link>
        </div>
      </section>

      {filteredProblems.length ? (
        <div className="space-y-3">
          {filteredProblems.map((problem) => (
            <ProblemCard key={problem.id} problem={problem} />
          ))}
        </div>
      ) : (
        <EmptyState
          actionHref="/problem-sets"
          actionLabel="Browse sets"
          copy="Add one manually or pull a few from the built-in LeetCode sets."
          title={data.problems.length ? "No matches" : "No problems yet"}
        />
      )}
    </div>
  );
}
