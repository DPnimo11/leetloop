"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { ATTEMPT_RESULT_LABELS, ATTEMPT_RESULTS, type AttemptResult } from "@/types/attempt";
import type { Problem } from "@/types/problem";
import { useLeetLoop } from "./LeetLoopProvider";

export function AttemptModal({
  problem,
  open,
  onClose,
}: {
  problem: Problem;
  open: boolean;
  onClose: () => void;
}) {
  const { logAttempt } = useLeetLoop();
  const [result, setResult] = useState<AttemptResult>("solved_clean");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [note, setNote] = useState("");

  if (!open) {
    return null;
  }

  function submit() {
    logAttempt(problem.id, {
      result,
      timeMinutes: timeMinutes ? Number(timeMinutes) : undefined,
      note,
    });
    setResult("solved_clean");
    setTimeMinutes("");
    setNote("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--accent-strong)]">
              Log attempt
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-normal">{problem.title}</h2>
          </div>
          <button
            aria-label="Close"
            className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {ATTEMPT_RESULTS.map((item) => (
              <button
                className={`rounded-md border px-3 py-2 text-left text-sm font-medium ${
                  result === item
                    ? "border-[var(--accent)] bg-[#e6f4f1] text-[var(--accent-strong)]"
                    : "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--surface-subtle)]"
                }`}
                key={item}
                onClick={() => setResult(item)}
                type="button"
              >
                {ATTEMPT_RESULT_LABELS[item]}
              </button>
            ))}
          </div>

          <label className="block text-sm font-medium">
            Time spent
            <input
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              min="0"
              onChange={(event) => setTimeMinutes(event.target.value)}
              placeholder="Minutes"
              type="number"
              value={timeMinutes}
            />
          </label>

          <label className="block text-sm font-medium">
            Note
            <textarea
              className="mt-1 min-h-24 w-full resize-y rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              onChange={(event) => setNote(event.target.value)}
              placeholder="Bug, pattern, edge case, or reconstruction note"
              value={note}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
          <button
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
            onClick={submit}
            type="button"
          >
            <Check size={16} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
