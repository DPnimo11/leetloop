import type { Difficulty, ProblemStatus } from "@/types/problem";
import { DIFFICULTY_STYLES, STATUS_LABELS, STATUS_STYLES } from "@/lib/format";

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

export function TagPill({ tag }: { tag: string }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-xs font-medium text-[#475467]">
      {tag}
    </span>
  );
}
