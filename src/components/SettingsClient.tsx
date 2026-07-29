"use client";

import { useState } from "react";
import { Check, Minus, Plus, Save, ShieldCheck, UserCircle } from "lucide-react";
import {
  MAX_DAILY_TARGET,
  MIN_DAILY_TARGET,
  clampDailyTarget,
  clampReservedNewStarts,
} from "@/lib/settings";
import type { LeetLoopSettings } from "@/types/storage";
import { BackupControls } from "./BackupControls";
import { EmptyState } from "./EmptyState";
import { useLeetLoop } from "./LeetLoopProvider";

type AccountInfo = {
  avatarUrl?: string;
  createdAt?: string;
  email?: string;
  name?: string;
  providers: string[];
};

export function SettingsClient({ account }: { account: AccountInfo }) {
  const { data, ready, updateSettings } = useLeetLoop();

  if (!ready) {
    return <EmptyState title="Loading settings" copy="Your data is loading." />;
  }

  // Mount the form only once data is loaded so its state seeds from saved settings, not defaults.
  return (
    <SettingsPanels
      account={account}
      initialDailyTarget={data.settings.dailyTarget}
      initialFocusMode={data.settings.focusMode ?? false}
      initialHideTagsInProblemLists={data.settings.hideTagsInProblemLists ?? false}
      initialReservedNewStarts={data.settings.reservedNewStartsPerDay}
      updateSettings={updateSettings}
    />
  );
}

function SettingsPanels({
  account,
  initialDailyTarget,
  initialFocusMode,
  initialHideTagsInProblemLists,
  initialReservedNewStarts,
  updateSettings,
}: {
  account: AccountInfo;
  initialDailyTarget: number;
  initialFocusMode: boolean;
  initialHideTagsInProblemLists: boolean;
  initialReservedNewStarts: number;
  updateSettings: (updates: Partial<LeetLoopSettings>) => void;
}) {
  const [dailyTarget, setDailyTarget] = useState(initialDailyTarget);
  const [savedDailyTarget, setSavedDailyTarget] = useState(initialDailyTarget);
  const [reservedNewStarts, setReservedNewStarts] = useState(initialReservedNewStarts);
  const [savedReservedNewStarts, setSavedReservedNewStarts] = useState(initialReservedNewStarts);
  const [focusMode, setFocusMode] = useState(initialFocusMode);
  const [savedFocusMode, setSavedFocusMode] = useState(initialFocusMode);
  const [hideTagsInProblemLists, setHideTagsInProblemLists] = useState(
    initialHideTagsInProblemLists,
  );
  const [savedHideTagsInProblemLists, setSavedHideTagsInProblemLists] = useState(
    initialHideTagsInProblemLists,
  );
  const [message, setMessage] = useState("");
  const dirty =
    dailyTarget !== savedDailyTarget ||
    reservedNewStarts !== savedReservedNewStarts ||
    focusMode !== savedFocusMode ||
    hideTagsInProblemLists !== savedHideTagsInProblemLists;

  function changeDailyTarget(nextValue: number) {
    const nextTarget = clampDailyTarget(nextValue);
    setDailyTarget(nextTarget);
    setReservedNewStarts((current) => clampReservedNewStarts(current, nextTarget));
    setMessage("");
  }

  function changeReservedNewStarts(nextValue: number) {
    setReservedNewStarts(clampReservedNewStarts(nextValue, dailyTarget));
    setMessage("");
  }

  function changeFocusMode(nextValue: boolean) {
    setFocusMode(nextValue);
    setMessage("");
  }

  function changeHideTagsInProblemLists(nextValue: boolean) {
    setHideTagsInProblemLists(nextValue);
    setMessage("");
  }

  function saveSettings() {
    updateSettings({
      dailyTarget,
      reservedNewStartsPerDay: reservedNewStarts,
      focusMode,
      hideTagsInProblemLists,
    });
    setSavedDailyTarget(dailyTarget);
    setSavedReservedNewStarts(reservedNewStarts);
    setSavedFocusMode(focusMode);
    setSavedHideTagsInProblemLists(hideTagsInProblemLists);
    setMessage("Saved");
  }

  return (
    <div className="space-y-5">
      <AccountSection account={account} />
      <SettingsForm
        changeDailyTarget={changeDailyTarget}
        changeFocusMode={changeFocusMode}
        changeReservedNewStarts={changeReservedNewStarts}
        dailyTarget={dailyTarget}
        dirty={dirty}
        focusMode={focusMode}
        reservedNewStarts={reservedNewStarts}
        saveSettings={saveSettings}
      />
      <DisplaySettings
        changeHideTagsInProblemLists={changeHideTagsInProblemLists}
        hideTagsInProblemLists={hideTagsInProblemLists}
      />
      <SaveBar dirty={dirty} message={message} saveSettings={saveSettings} />
      <BackupControls />
    </div>
  );
}

function SaveBar({
  dirty,
  message,
  saveSettings,
}: {
  dirty: boolean;
  message: string;
  saveSettings: () => void;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--muted)]">
        {message || (dirty ? "You have unsaved changes." : "Settings are up to date.")}
      </p>
      <button
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-default disabled:bg-[#98a2b3]"
        disabled={!dirty}
        onClick={saveSettings}
        type="button"
      >
        {dirty ? <Save size={15} /> : <Check size={15} />}
        {dirty ? "Save" : "Saved"}
      </button>
    </section>
  );
}

function AccountSection({ account }: { account: AccountInfo }) {
  const displayName = account.name || account.email || "Account";
  const initials = initialsFor(displayName);
  const joinedDate = formatDate(account.createdAt);

  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e6f4f1] text-sm font-bold text-[var(--accent-strong)]">
            {account.avatarUrl ? (
              <span
                aria-hidden="true"
                className="size-full bg-cover bg-center"
                style={{ backgroundImage: `url("${account.avatarUrl}")` }}
              />
            ) : (
              initials || <UserCircle size={22} />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
              Account
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal">{displayName}</h1>
            {account.email ? (
              <p className="mt-1 truncate text-sm text-[var(--muted)]">{account.email}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
          {account.providers.length ? (
            account.providers.map((provider) => (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1"
                key={provider}
              >
                <ShieldCheck size={13} />
                {providerLabel(provider)}
              </span>
            ))
          ) : null}
          {joinedDate ? (
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1">
              Joined {joinedDate}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SettingsForm({
  changeDailyTarget,
  changeFocusMode,
  changeReservedNewStarts,
  dailyTarget,
  dirty,
  focusMode,
  reservedNewStarts,
  saveSettings,
}: {
  changeDailyTarget: (nextValue: number) => void;
  changeFocusMode: (nextValue: boolean) => void;
  changeReservedNewStarts: (nextValue: number) => void;
  dailyTarget: number;
  dirty: boolean;
  focusMode: boolean;
  reservedNewStarts: number;
  saveSettings: () => void;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
            Practice targets
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-normal">Daily target</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Planned reviews and new starts count toward this number.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            onKeyDown={(event) => {
              if (event.key === "Enter" && dirty) {
                saveSettings();
              }
            }}
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
      <div className="mt-4 flex flex-col gap-4 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-normal">Reserved new-start slots</h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Reviews stay visible, but planning holds this many slots for new problems when available.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            aria-label="Decrease reserved new-start slots"
            className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-white hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
            disabled={reservedNewStarts <= 0}
            onClick={() => changeReservedNewStarts(reservedNewStarts - 1)}
            type="button"
          >
            <Minus size={16} />
          </button>
          <input
            aria-label="Reserved new-start slots"
            className="h-9 w-20 rounded-md border border-[var(--border)] bg-white px-3 text-center text-sm font-semibold outline-none focus:border-[var(--accent)]"
            max={dailyTarget}
            min={0}
            onChange={(event) => changeReservedNewStarts(Number(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && dirty) {
                saveSettings();
              }
            }}
            type="number"
            value={reservedNewStarts}
          />
          <button
            aria-label="Increase reserved new-start slots"
            className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-white hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
            disabled={reservedNewStarts >= dailyTarget}
            onClick={() => changeReservedNewStarts(reservedNewStarts + 1)}
            type="button"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      {reservedNewStarts === dailyTarget ? (
        <p className="mt-3 text-sm font-medium text-amber-700">
          No review slots will be planned while new problems are available.
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-4 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-normal">Focus mode</h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Introduce new problems one concept at a time, largest category first. Reviews are unaffected.
          </p>
        </div>
        <button
          aria-pressed={focusMode}
          className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            focusMode
              ? "border-[var(--accent)] bg-[#e6f4f1] text-[var(--accent-strong)]"
              : "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--surface-subtle)]"
          }`}
          onClick={() => changeFocusMode(!focusMode)}
          type="button"
        >
          <Check className={focusMode ? "opacity-100" : "opacity-0"} size={15} />
          {focusMode ? "On" : "Off"}
        </button>
      </div>
    </section>
  );
}

function DisplaySettings({
  changeHideTagsInProblemLists,
  hideTagsInProblemLists,
}: {
  changeHideTagsInProblemLists: (nextValue: boolean) => void;
  hideTagsInProblemLists: boolean;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
            Display
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-normal">
            Hide tags in problem lists
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Keep Today, Upcoming, All Problems, and the LeetCode Daily card compact. Tags
            remain available on problem details and in filters.
          </p>
        </div>
        <button
          aria-pressed={hideTagsInProblemLists}
          className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            hideTagsInProblemLists
              ? "border-[var(--accent)] bg-[#e6f4f1] text-[var(--accent-strong)]"
              : "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--surface-subtle)]"
          }`}
          onClick={() => changeHideTagsInProblemLists(!hideTagsInProblemLists)}
          type="button"
        >
          <Check className={hideTagsInProblemLists ? "opacity-100" : "opacity-0"} size={15} />
          {hideTagsInProblemLists ? "On" : "Off"}
        </button>
      </div>
    </section>
  );
}

function initialsFor(value: string): string {
  const parts = value
    .replace(/@.*/, "")
    .split(/\s+|[._-]/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(date);
}

function providerLabel(provider: string): string {
  if (provider.toLowerCase() === "github") {
    return "GitHub";
  }

  return provider.charAt(0).toUpperCase() + provider.slice(1);
}
