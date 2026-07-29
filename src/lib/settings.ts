import type { LeetLoopData, LeetLoopSettings } from "@/types/storage";
import { toLocalDateKey } from "./dates";

export const DEFAULT_DAILY_TARGET = 5;
export const MIN_DAILY_TARGET = 1;
export const MAX_DAILY_TARGET = 20;
export const DEFAULT_RESERVED_NEW_STARTS = 1;

const MAX_EXTRA_DAILY_CAPACITY = 100;

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

export function clampDailyTarget(value: number): number {
  return clampInteger(value, MIN_DAILY_TARGET, MAX_DAILY_TARGET);
}

export function clampReservedNewStarts(value: number, dailyTarget = DEFAULT_DAILY_TARGET): number {
  return clampInteger(value, 0, clampDailyTarget(dailyTarget));
}

function normalizeExtraDailyCapacity(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([dateKey]) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
    .map(([dateKey, capacity]) => [
      dateKey,
      clampInteger(Number(capacity), 0, MAX_EXTRA_DAILY_CAPACITY),
    ] as const)
    .filter(([, capacity]) => capacity > 0);

  return Object.fromEntries(entries);
}

export function createDefaultSettings(): LeetLoopSettings {
  return {
    dailyTarget: DEFAULT_DAILY_TARGET,
    reservedNewStartsPerDay: DEFAULT_RESERVED_NEW_STARTS,
    extraDailyCapacity: {},
    focusMode: false,
    hideTagsInProblemLists: false,
  };
}

export function normalizeSettings(value: unknown): LeetLoopSettings {
  if (!value || typeof value !== "object") {
    return createDefaultSettings();
  }

  const candidate = value as Partial<LeetLoopSettings>;

  const dailyTarget = clampDailyTarget(Number(candidate.dailyTarget ?? DEFAULT_DAILY_TARGET));

  return {
    dailyTarget,
    reservedNewStartsPerDay: clampReservedNewStarts(
      Number(candidate.reservedNewStartsPerDay ?? DEFAULT_RESERVED_NEW_STARTS),
      dailyTarget,
    ),
    extraDailyCapacity: normalizeExtraDailyCapacity(candidate.extraDailyCapacity),
    focusMode: Boolean(candidate.focusMode),
    hideTagsInProblemLists: Boolean(candidate.hideTagsInProblemLists),
  };
}

export function isFocusModeEnabled(settings?: Partial<LeetLoopSettings>): boolean {
  return Boolean(settings?.focusMode);
}

export function areProblemListTagsHidden(settings?: Partial<LeetLoopSettings>): boolean {
  return Boolean(settings?.hideTagsInProblemLists);
}

export function getDailyTarget(settings?: Partial<LeetLoopSettings>): number {
  return clampDailyTarget(Number(settings?.dailyTarget ?? DEFAULT_DAILY_TARGET));
}

export function getReservedNewStarts(settings?: Partial<LeetLoopSettings>): number {
  return clampReservedNewStarts(
    Number(settings?.reservedNewStartsPerDay ?? DEFAULT_RESERVED_NEW_STARTS),
    getDailyTarget(settings),
  );
}

export function getExtraDailyCapacity(settings: Partial<LeetLoopSettings> | undefined, dateKey: string): number {
  const rawValue = settings?.extraDailyCapacity?.[dateKey];
  return clampInteger(Number(rawValue ?? 0), 0, MAX_EXTRA_DAILY_CAPACITY);
}

export function getDailyCapacityForDate(data: Pick<LeetLoopData, "settings">, date: Date): number {
  const dateKey = toLocalDateKey(date);
  return getDailyTarget(data.settings) + getExtraDailyCapacity(data.settings, dateKey);
}

export function updateSettings(
  data: LeetLoopData,
  updates: Partial<LeetLoopSettings>,
  now = new Date(),
): LeetLoopData {
  return {
    ...data,
    settings: normalizeSettings({
      ...data.settings,
      ...updates,
      extraDailyCapacity: updates.extraDailyCapacity ?? data.settings.extraDailyCapacity,
    }),
    updatedAt: now.toISOString(),
  };
}
