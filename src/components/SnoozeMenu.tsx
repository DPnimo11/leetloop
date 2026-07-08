"use client";

import { useRef } from "react";
import { Clock3, Play } from "lucide-react";
import type { Problem } from "@/types/problem";
import { addDays, startOfLocalDay } from "@/lib/dates";
import { getProblemAvailability } from "@/lib/availability";
import { useLeetLoop } from "./LeetLoopProvider";

export function SnoozeMenu({ problem }: { problem: Problem }) {
  const { resumeProblem, snoozeProblem } = useLeetLoop();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const availability = getProblemAvailability(problem);

  if (problem.status === "retired") {
    return null;
  }

  if (availability !== "available") {
    return (
      <button
        className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
        onClick={() => resumeProblem(problem.id)}
        type="button"
      >
        <Play size={16} />
        Resume
      </button>
    );
  }

  function snoozeForDays(days: number) {
    snoozeProblem(problem.id, addDays(startOfLocalDay(new Date()), days));
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  function pauseIndefinitely() {
    snoozeProblem(problem.id);
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  return (
    <details className="relative" ref={detailsRef}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-subtle)]">
        <Clock3 size={16} />
        Snooze
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-[var(--border)] bg-white p-1 shadow-lg">
        <button
          className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-[var(--surface-subtle)]"
          onClick={() => snoozeForDays(1)}
          type="button"
        >
          Until tomorrow
        </button>
        <button
          className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-[var(--surface-subtle)]"
          onClick={() => snoozeForDays(3)}
          type="button"
        >
          For 3 days
        </button>
        <button
          className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-[var(--surface-subtle)]"
          onClick={() => snoozeForDays(7)}
          type="button"
        >
          For 1 week
        </button>
        <button
          className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-[var(--surface-subtle)]"
          onClick={pauseIndefinitely}
          type="button"
        >
          Pause indefinitely
        </button>
      </div>
    </details>
  );
}
