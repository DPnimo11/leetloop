import type { Difficulty, Problem, ProblemStatus } from "@/types/problem";
import { DIFFICULTY_STYLES, formatDate, STATUS_LABELS, STATUS_STYLES } from "@/lib/format";
import { getProblemAvailability } from "@/lib/availability";

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${DIFFICULTY_STYLES[difficulty]}`}>
      {difficulty}
    </span>
  );
}

export function StatusBadge({ status }: { status: ProblemStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function AvailabilityBadge({ problem }: { problem: Problem }) {
  const availability = getProblemAvailability(problem);

  if (availability === "available") {
    return null;
  }

  return (
    <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
      {availability === "paused"
        ? "Paused"
        : `Snoozed until ${formatDate(problem.snoozedUntil)}`}
    </span>
  );
}

export function PrimaryPatternBadge({ pattern }: { pattern?: string }) {
  if (!pattern) {
    return null;
  }

  return (
    <span className="inline-flex rounded-full border border-[var(--accent)] bg-[#e6f4f1] px-2 py-0.5 text-xs font-semibold text-[var(--accent-strong)]">
      {pattern}
    </span>
  );
}

export function TagPill({ tag }: { tag: string }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-xs font-medium text-[#475467]">
      {tag}
    </span>
  );
}
