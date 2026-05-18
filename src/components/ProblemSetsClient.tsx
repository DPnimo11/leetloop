"use client";

import { useState } from "react";
import { Check, CheckSquare, ListPlus, Search, Square } from "lucide-react";
import { BUILT_IN_PROBLEM_SETS } from "@/lib/problemSets";
import type { BuiltInProblemSetSlug, ProblemTemplate } from "@/types/problem-set";
import type { Difficulty } from "@/types/problem";
import { DIFFICULTIES } from "@/types/problem";
import { DifficultyBadge, TagPill } from "./Badges";
import { useLeetLoop } from "./LeetLoopProvider";

function getGroups(setSlug: BuiltInProblemSetSlug): string[] {
  const set = BUILT_IN_PROBLEM_SETS.find((item) => item.slug === setSlug);
  return Array.from(new Set(set?.problems.flatMap((problem) => problem.sourceGroups) ?? []));
}

export function ProblemSetsClient() {
  const { addProblemFromTemplate, isTemplateInQueue, ready } = useLeetLoop();
  const [activeSetSlug, setActiveSetSlug] = useState<BuiltInProblemSetSlug>("leetcode-75");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const [group, setGroup] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const activeSet = BUILT_IN_PROBLEM_SETS.find((set) => set.slug === activeSetSlug) ?? BUILT_IN_PROBLEM_SETS[0];
  const groups = getGroups(activeSet.slug);

  const query = search.trim().toLowerCase();
  const filteredProblems = activeSet.problems.filter((problem) => {
    const matchesSearch =
      !query ||
      problem.title.toLowerCase().includes(query) ||
      problem.patterns.some((tag) => tag.toLowerCase().includes(query));
    const matchesDifficulty = difficulty === "all" || problem.difficulty === difficulty;
    const matchesGroup = group === "all" || problem.sourceGroups.includes(group);

    return matchesSearch && matchesDifficulty && matchesGroup;
  });

  const selectableProblems = filteredProblems.filter((problem) => !isTemplateInQueue(problem));
  const selectedVisibleCount = selectedIds.filter((id) =>
    selectableProblems.some((problem) => problem.id === id),
  ).length;
  const allVisibleSelected =
    selectableProblems.length > 0 && selectedVisibleCount === selectableProblems.length;

  function toggleSelected(problemId: string) {
    setSelectedIds((current) =>
      current.includes(problemId) ? current.filter((id) => id !== problemId) : [...current, problemId],
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = new Set(selectableProblems.map((problem) => problem.id));

    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.has(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function addOne(problem: ProblemTemplate) {
    addProblemFromTemplate(problem);
    setSelectedIds((current) => current.filter((id) => id !== problem.id));
  }

  function addSelected() {
    for (const problem of selectableProblems) {
      if (selectedIds.includes(problem.id)) {
        addProblemFromTemplate(problem);
      }
    }

    setSelectedIds([]);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        {BUILT_IN_PROBLEM_SETS.map((set) => {
          const addedCount = set.problems.filter(isTemplateInQueue).length;
          const active = activeSet.slug === set.slug;

          return (
            <button
              className={`rounded-lg border p-4 text-left ${
                active
                  ? "border-[var(--accent)] bg-[#e6f4f1]"
                  : "border-[var(--border)] bg-white hover:bg-[var(--surface-subtle)]"
              }`}
              key={set.slug}
              onClick={() => {
                setActiveSetSlug(set.slug);
                setGroup("all");
                setSelectedIds([]);
              }}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-normal">{set.name}</h2>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[var(--muted)]">
                  {addedCount}/{set.problems.length}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{set.description}</p>
            </button>
          );
        })}
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_220px] lg:min-w-[680px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-[var(--muted)]" size={16} />
              <input
                className="w-full rounded-md border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search templates"
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
              onChange={(event) => setGroup(event.target.value)}
              value={group}
            >
              <option value="all">All groups</option>
              {groups.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
              disabled={!ready || selectableProblems.length === 0}
              onClick={toggleSelectAllVisible}
              type="button"
            >
              {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              {allVisibleSelected ? "Clear visible" : "Select all"}
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
              disabled={!ready || selectedVisibleCount === 0}
              onClick={addSelected}
              type="button"
            >
              <ListPlus size={16} />
              Add selected
              {selectedVisibleCount ? ` (${selectedVisibleCount})` : ""}
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {filteredProblems.map((problem) => {
          const added = isTemplateInQueue(problem);
          const selected = selectedIds.includes(problem.id);

          return (
            <article className="rounded-lg border border-[var(--border)] bg-white p-4" key={problem.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {!added ? (
                      <input
                        aria-label={`Select ${problem.title}`}
                        checked={selected}
                        className="size-4 accent-[var(--accent)]"
                        onChange={() => toggleSelected(problem.id)}
                        type="checkbox"
                      />
                    ) : null}
                    <a
                      className="text-base font-semibold tracking-normal hover:text-[var(--accent-strong)]"
                      href={problem.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {problem.title}
                    </a>
                    <DifficultyBadge difficulty={problem.difficulty} />
                    <span className="text-xs font-medium text-[var(--muted)]">#{problem.questionFrontendId}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {problem.patterns.slice(0, 7).map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{problem.sourceGroups.join(", ")}</p>
                </div>

                <button
                  className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                    added
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
                  }`}
                  disabled={added || !ready}
                  onClick={() => addOne(problem)}
                  type="button"
                >
                  {added ? <Check size={16} /> : <ListPlus size={16} />}
                  {added ? "Added" : "Add"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
