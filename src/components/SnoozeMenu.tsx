"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3, Play } from "lucide-react";
import type { Problem } from "@/types/problem";
import { addDays, startOfLocalDay } from "@/lib/dates";
import { getProblemAvailability } from "@/lib/availability";
import { useLeetLoop } from "./LeetLoopProvider";

const snoozeOptions = [
  { days: 1, label: "Until tomorrow" },
  { days: 3, label: "For 3 days" },
  { days: 7, label: "For 1 week" },
];

export function SnoozeMenu({ problem }: { problem: Problem }) {
  const { resumeProblem, snoozeProblem } = useLeetLoop();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const availability = getProblemAvailability(problem);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (problem.status === "retired") {
    return null;
  }

  if (availability !== "available") {
    return (
      <button
        className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
        onClick={() => resumeProblem(problem.id)}
        type="button"
      >
        <Play aria-hidden="true" size={16} />
        Resume
      </button>
    );
  }

  function snoozeForDays(days: number) {
    snoozeProblem(problem.id, addDays(startOfLocalDay(new Date()), days));
    setOpen(false);
  }

  function pauseIndefinitely() {
    snoozeProblem(problem.id);
    setOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold transition hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Clock3 aria-hidden="true" size={16} />
        Snooze
      </button>

      {open ? (
        <div
          className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[var(--border)] bg-white p-1 shadow-xl"
          role="menu"
        >
          {snoozeOptions.map((option) => (
            <button
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-subtle)]"
              key={option.days}
              onClick={() => snoozeForDays(option.days)}
              role="menuitem"
              type="button"
            >
              {option.label}
            </button>
          ))}

          <div className="my-1 border-t border-[var(--border)]" />

          <button
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-subtle)]"
            onClick={pauseIndefinitely}
            role="menuitem"
            type="button"
          >
            Pause indefinitely
          </button>
        </div>
      ) : null}
    </div>
  );
}
