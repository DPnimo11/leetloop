"use client";

import { useState } from "react";
import { Minus, Plus, Save } from "lucide-react";
import { MAX_DAILY_TARGET, MIN_DAILY_TARGET, clampDailyTarget } from "@/lib/settings";
import type { LeetLoopSettings } from "@/types/storage";
import { EmptyState } from "./EmptyState";
import { useLeetLoop } from "./LeetLoopProvider";

export function SettingsClient() {
  const { data, ready, updateSettings } = useLeetLoop();

  if (!ready) {
    return <EmptyState title="Loading settings" copy="Your data is loading." />;
  }

  return (
    <SettingsForm
      initialDailyTarget={data.settings.dailyTarget}
      updateSettings={updateSettings}
    />
  );
}

function SettingsForm({
  initialDailyTarget,
  updateSettings,
}: {
  initialDailyTarget: number;
  updateSettings: (updates: Partial<LeetLoopSettings>) => void;
}) {
  const [dailyTarget, setDailyTarget] = useState(initialDailyTarget);
  const [message, setMessage] = useState("");

  function changeDailyTarget(nextValue: number) {
    setDailyTarget(clampDailyTarget(nextValue));
    setMessage("");
  }

  function saveSettings() {
    updateSettings({ dailyTarget });
    setMessage("Settings saved.");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
              Settings
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Practice targets</h1>
          </div>
          <button
            className="inline-flex w-fit items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
            onClick={saveSettings}
            type="button"
          >
            <Save size={16} />
            Save
          </button>
        </div>
        {message ? <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">Daily target</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">New starts fill around reviews up to this number.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Decrease daily target"
              className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-white hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
              disabled={dailyTarget <= MIN_DAILY_TARGET}
              onClick={() => changeDailyTarget(dailyTarget - 1)}
              type="button"
            >
              <Minus size={16} />
            </button>
            <input
              aria-label="Daily target"
              className="h-9 w-20 rounded-md border border-[var(--border)] bg-white px-3 text-center text-sm font-semibold outline-none focus:border-[var(--accent)]"
              max={MAX_DAILY_TARGET}
              min={MIN_DAILY_TARGET}
              onChange={(event) => changeDailyTarget(Number(event.target.value))}
              type="number"
              value={dailyTarget}
            />
            <button
              aria-label="Increase daily target"
              className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-white hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
              disabled={dailyTarget >= MAX_DAILY_TARGET}
              onClick={() => changeDailyTarget(dailyTarget + 1)}
              type="button"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
