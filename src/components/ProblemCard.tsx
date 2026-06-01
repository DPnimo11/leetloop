"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, History } from "lucide-react";
import type { Problem } from "@/types/problem";
import { leetLoopReviewUrl } from "@/lib/leetcode";
import { formatAttemptResult, formatDate } from "@/lib/format";
import { DifficultyBadge, StatusBadge, TagPill } from "./Badges";
import { AttemptModal } from "./AttemptModal";

export function ProblemCard({ problem }: { problem: Problem }) {
  const [logging, setLogging] = useState(false);

  return (
    <article className="rounded-lg border border-[var(--border)] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            className="text-lg font-semibold tracking-normal text-[var(--foreground)] hover:text-[var(--accent-strong)]"
            href={`/problems/${problem.id}`}
          >
            {problem.title}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={problem.difficulty} />
            <StatusBadge status={problem.status} />
            <span className="text-sm text-[var(--muted)]">Next: {formatDate(problem.nextReviewAt)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {problem.patterns.slice(0, 5).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Last: {formatAttemptResult(problem.lastResult)} - Reviews: {problem.reviewCount}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
            href={leetLoopReviewUrl(problem.url)}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={16} />
            Open
          </a>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
            onClick={() => setLogging(true)}
            type="button"
          >
            <History size={16} />
            Log
          </button>
        </div>
      </div>

      <AttemptModal onClose={() => setLogging(false)} open={logging} problem={problem} />
    </article>
  );
}
