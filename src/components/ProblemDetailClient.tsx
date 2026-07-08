"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, History, Save, Trash2 } from "lucide-react";
import { formatAttemptResult, formatDate, formatDateTime, STATUS_LABELS } from "@/lib/format";
import { leetLoopReviewUrl } from "@/lib/leetcode";
import { getProblemSetName } from "@/lib/problemSets";
import { DifficultyBadge, StatusBadge, TagPill } from "./Badges";
import { EmptyState } from "./EmptyState";
import { AttemptModal } from "./AttemptModal";
import { useLeetLoop } from "./LeetLoopProvider";

export function ProblemDetailClient({ problemId }: { problemId: string }) {
  const router = useRouter();
  const { data, deleteProblem, getProblemAttempts, ready, updateProblem } = useLeetLoop();
  const [logging, setLogging] = useState(false);
  const [notesDraft, setNotesDraft] = useState<{ problemId: string; value: string }>();
  const problem = data.problems.find((item) => item.id === problemId);
  const attempts = getProblemAttempts(problemId);

  if (!ready) {
    return <EmptyState title="Loading problem" copy="Your data is loading." />;
  }

  if (!problem) {
    return (
      <EmptyState
        actionHref="/problems"
        actionLabel="Back to problems"
        copy="This problem is not in local storage."
        title="Problem not found"
      />
    );
  }

  const currentProblem = problem;
  const noteValue = notesDraft?.problemId === currentProblem.id ? notesDraft.value : (currentProblem.notes ?? "");
  const sourceSets = currentProblem.sourceSetSlugs?.map(getProblemSetName) ?? [];
  const planDiffersFromIdeal =
    currentProblem.idealReviewAt &&
    formatDate(currentProblem.idealReviewAt) !== formatDate(currentProblem.nextReviewAt);

  function saveNotes() {
    updateProblem(currentProblem.id, { notes: noteValue });
  }

  function removeProblem() {
    deleteProblem(currentProblem.id);
    router.push("/problems");
  }

  return (
    <div className="space-y-5">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent-strong)]" href="/problems">
        <ArrowLeft size={16} />
        Problems
      </Link>

      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <DifficultyBadge difficulty={currentProblem.difficulty} />
              <StatusBadge status={currentProblem.status} />
              {sourceSets.map((set) => (
                <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]" key={set}>
                  {set}
                </span>
              ))}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">{currentProblem.title}</h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {currentProblem.patterns.map((tag) => (
                <TagPill key={tag} tag={tag} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
              href={leetLoopReviewUrl(currentProblem.url)}
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

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-[var(--surface-subtle)] p-3">
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--muted)]">Planned review</dt>
            <dd className="mt-1 text-sm font-semibold">{formatDate(currentProblem.nextReviewAt)}</dd>
            {planDiffersFromIdeal ? (
              <dd className="mt-1 text-xs text-[var(--muted)]">
                Ideal {formatDate(currentProblem.idealReviewAt)}
              </dd>
            ) : null}
          </div>
          <div className="rounded-md bg-[var(--surface-subtle)] p-3">
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--muted)]">Last result</dt>
            <dd className="mt-1 text-sm font-semibold">{formatAttemptResult(currentProblem.lastResult)}</dd>
          </div>
          <div className="rounded-md bg-[var(--surface-subtle)] p-3">
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--muted)]">Reviews</dt>
            <dd className="mt-1 text-sm font-semibold">{currentProblem.reviewCount}</dd>
          </div>
          <div className="rounded-md bg-[var(--surface-subtle)] p-3">
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--muted)]">Clean streak</dt>
            <dd className="mt-1 text-sm font-semibold">{currentProblem.cleanStreak}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-normal">Notes</h2>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
              onClick={saveNotes}
              type="button"
            >
              <Save size={16} />
              Save
            </button>
          </div>
          <textarea
            className="mt-3 min-h-56 w-full resize-y rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--accent)]"
            onChange={(event) => setNotesDraft({ problemId: currentProblem.id, value: event.target.value })}
            placeholder="Pattern, trigger, invariant, bug, edge case"
            value={noteValue}
          />
        </div>

        <aside className="rounded-lg border border-[var(--border)] bg-white p-5">
          <h2 className="text-lg font-semibold tracking-normal">Details</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-[var(--muted)]">Status</dt>
              <dd>{STATUS_LABELS[currentProblem.status]}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--muted)]">Created</dt>
              <dd>{formatDate(currentProblem.createdAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--muted)]">Updated</dt>
              <dd>{formatDateTime(currentProblem.updatedAt)}</dd>
            </div>
          </dl>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            onClick={removeProblem}
            type="button"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </aside>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
        <h2 className="text-lg font-semibold tracking-normal">Attempt history</h2>
        {attempts.length ? (
          <div className="mt-4 space-y-3">
            {attempts.map((attempt) => (
              <article className="rounded-md border border-[var(--border)] p-3" key={attempt.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{formatAttemptResult(attempt.result)}</span>
                  <span className="text-sm text-[var(--muted)]">{formatDateTime(attempt.attemptedAt)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                  {attempt.timeMinutes ? <span>{attempt.timeMinutes} min</span> : null}
                  {attempt.note ? <span>{attempt.note}</span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">No attempts logged yet.</p>
        )}
      </section>

      <AttemptModal onClose={() => setLogging(false)} open={logging} problem={currentProblem} />
    </div>
  );
}
