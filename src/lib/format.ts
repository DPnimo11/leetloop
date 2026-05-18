import type { AttemptResult } from "@/types/attempt";
import { ATTEMPT_RESULT_LABELS } from "@/types/attempt";
import type { Difficulty, ProblemStatus } from "@/types/problem";

export const STATUS_LABELS: Record<ProblemStatus, string> = {
  new: "New",
  learning: "Learning",
  reviewing: "Reviewing",
  retired: "Retired",
};

export const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Hard: "border-rose-200 bg-rose-50 text-rose-700",
};

export const STATUS_STYLES: Record<ProblemStatus, string> = {
  new: "border-slate-200 bg-slate-50 text-slate-700",
  learning: "border-sky-200 bg-sky-50 text-sky-700",
  reviewing: "border-teal-200 bg-teal-50 text-teal-700",
  retired: "border-violet-200 bg-violet-50 text-violet-700",
};

export function formatAttemptResult(result?: AttemptResult): string {
  return result ? ATTEMPT_RESULT_LABELS[result] : "No attempts";
}

export function formatDate(value?: string): string {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
