"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Attempt, AttemptInput } from "@/types/attempt";
import type { Problem, ProblemInput } from "@/types/problem";
import type { ProblemTemplate } from "@/types/problem-set";
import type { LeetLoopData, LeetLoopSettings } from "@/types/storage";
import {
  addProblem as addProblemToData,
  addProblemFromTemplate as addProblemFromTemplateToData,
  clearLegacyLocalData,
  createEmptyData,
  deleteProblem as deleteProblemFromData,
  exportData as exportDataFromStorage,
  importData as importDataFromStorage,
  logAttempt as logAttemptToData,
  resumeProblem as resumeProblemInData,
  snoozeProblem as snoozeProblemInData,
  updateProblem as updateProblemInData,
  updateSettings as updateSettingsInData,
} from "@/lib/storage";
import { isTemplateAdded } from "@/lib/problemSets";
import { millisecondsUntilNextLocalDay, toLocalDateKey } from "@/lib/dates";
import {
  getUpcomingPlan,
  planDailyWork,
  refillTodayPlan,
  swapTodayNewProblem as swapTodayNewProblemInData,
  type PlanDailyWorkOptions,
} from "@/lib/planning";
import { createClient } from "@/lib/supabase/client";
import { loadCloudData, syncCloudData } from "@/lib/cloud/repository";

type AddTemplateResult = {
  added: boolean;
  problem: Problem;
};

type AddProblemOptions = {
  preserveToday?: boolean;
};

type SwapTodayProblemResult = {
  swappedOut: Problem;
  swappedIn: Problem;
};

type CommitUpdate<T> = {
  data: LeetLoopData;
  result: T;
  planningOptions?: PlanDailyWorkOptions;
};

type LeetLoopContextValue = {
  data: LeetLoopData;
  ready: boolean;
  loadError?: string;
  syncError?: string;
  syncing: boolean;
  addProblem: (input: ProblemInput, options?: AddProblemOptions) => Problem;
  addProblemFromTemplate: (template: ProblemTemplate) => AddTemplateResult;
  updateProblem: (problemId: string, updates: Partial<ProblemInput>) => void;
  updateSettings: (updates: Partial<LeetLoopSettings>) => void;
  deleteProblem: (problemId: string) => void;
  logAttempt: (problemId: string, input: AttemptInput) => Attempt;
  snoozeProblem: (problemId: string, until?: Date) => void;
  resumeProblem: (problemId: string) => void;
  swapTodayNewProblem: (problemId: string) => SwapTodayProblemResult | undefined;
  addOneToday: () => number;
  exportJson: () => string;
  importJson: (raw: string) => Promise<LeetLoopData>;
  getProblemAttempts: (problemId: string) => Attempt[];
  isTemplateInQueue: (template: ProblemTemplate) => boolean;
};

const LeetLoopContext = createContext<LeetLoopContextValue | undefined>(undefined);

function touchUpdatedAt(data: LeetLoopData): LeetLoopData {
  return { ...data, updatedAt: new Date().toISOString() };
}

function getTodayProblemIds(data: LeetLoopData, now: Date): Set<string> {
  const todayPlan = getUpcomingPlan(data, { now, days: 1 })[0];

  return new Set(
    todayPlan
      ? [...todayPlan.reviews, ...todayPlan.newStarts].map((problem) => problem.id)
      : [],
  );
}

export function LeetLoopProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [data, setData] = useState<LeetLoopData>(() => createEmptyData());
  const dataRef = useRef(data);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [syncError, setSyncError] = useState<string>();
  const [syncing, setSyncing] = useState(false);

  const userIdRef = useRef<string | null>(null);
  // Serializes cloud writes so concurrent mutations apply in order.
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSyncRef = useRef(0);
  const lastPlannedDateKeyRef = useRef<string | undefined>(undefined);

  const enqueueSync = useCallback(
    (prev: LeetLoopData, next: LeetLoopData): Promise<void> => {
      const userId = userIdRef.current;
      if (!userId) {
        return Promise.resolve();
      }

      pendingSyncRef.current += 1;
      setSyncing(true);

      // Run after any in-flight write so mutations persist in order.
      const run = syncQueueRef.current.then(() => syncCloudData(supabase, userId, prev, next));

      // Keep the queue alive regardless of this op's outcome.
      syncQueueRef.current = run.then(
        () => undefined,
        () => undefined,
      );

      run
        .then(() => {
          setSyncError(undefined);
        })
        .catch((error: unknown) => {
          setSyncError(error instanceof Error ? error.message : "Could not sync to the cloud.");
        })
        .finally(() => {
          pendingSyncRef.current -= 1;
          if (pendingSyncRef.current === 0) {
            setSyncing(false);
          }
        });

      // Resolves/rejects for THIS op so callers (e.g. import) can await it.
      return run;
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) {
          return;
        }

        if (!user) {
          const emptyData = createEmptyData();
          lastPlannedDateKeyRef.current = toLocalDateKey(new Date());
          dataRef.current = emptyData;
          setData(emptyData);
          return;
        }

        userIdRef.current = user.id;
        const loaded = await loadCloudData(supabase, user.id);

        if (cancelled) {
          return;
        }

        const planningNow = new Date();
        const planned = touchUpdatedAt(planDailyWork(loaded, { now: planningNow }));
        lastPlannedDateKeyRef.current = toLocalDateKey(planningNow);
        dataRef.current = planned;
        setData(planned);
        // Persist any planning side effects that ran on load.
        enqueueSync(loaded, planned);
        // Cloud is now the source of truth; drop the legacy local blob.
        clearLegacyLocalData();
      } catch (error) {
        if (cancelled) {
          return;
        }
        const emptyData = createEmptyData();
        lastPlannedDateKeyRef.current = toLocalDateKey(new Date());
        setLoadError(error instanceof Error ? error.message : "Could not load your data.");
        dataRef.current = emptyData;
        setData(emptyData);
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, enqueueSync]);

  const replanForLocalDayChange = useCallback((now = new Date()) => {
    const dateKey = toLocalDateKey(now);

    if (lastPlannedDateKeyRef.current === dateKey) {
      return;
    }

    lastPlannedDateKeyRef.current = dateKey;

    if (!userIdRef.current) {
      return;
    }

    const prev = dataRef.current;
    const planned = planDailyWork(prev, { now });
    const next = touchUpdatedAt(planned);
    dataRef.current = next;
    setData(next);

    if (planned !== prev) {
      enqueueSync(prev, next);
    }
  }, [enqueueSync]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let midnightTimer: number | undefined;

    function scheduleMidnightReplan() {
      if (midnightTimer !== undefined) {
        window.clearTimeout(midnightTimer);
      }

      midnightTimer = window.setTimeout(() => {
        replanForLocalDayChange();
        scheduleMidnightReplan();
      }, millisecondsUntilNextLocalDay() + 50);
    }

    function handleFocus() {
      replanForLocalDayChange();
      scheduleMidnightReplan();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    }

    scheduleMidnightReplan();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (midnightTimer !== undefined) {
        window.clearTimeout(midnightTimer);
      }
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [ready, replanForLocalDayChange]);

  useEffect(() => {
    const now = Date.now();
    const nextWakeAt = data.problems.reduce<number | undefined>((nearest, problem) => {
      if (!problem.snoozedAt || !problem.snoozedUntil) {
        return nearest;
      }

      const wakeAt = new Date(problem.snoozedUntil).getTime();
      if (!Number.isFinite(wakeAt) || wakeAt <= now) {
        return nearest;
      }

      return nearest === undefined ? wakeAt : Math.min(nearest, wakeAt);
    }, undefined);

    if (nextWakeAt === undefined) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const prev = dataRef.current;
      const planningNow = new Date();
      const planned = planDailyWork(prev, { now: planningNow });
      lastPlannedDateKeyRef.current = toLocalDateKey(planningNow);

      if (planned === prev) {
        return;
      }

      dataRef.current = planned;
      setData(planned);
      enqueueSync(prev, planned);
    }, Math.max(0, nextWakeAt - now + 50));

    return () => window.clearTimeout(timeout);
  }, [data.problems, enqueueSync]);

  const commit = useCallback(
    <T,>(updater: (current: LeetLoopData) => CommitUpdate<T>) => {
      const prev = dataRef.current;
      const next = updater(prev);

      if (next.data === prev) {
        return next.result;
      }

      const planningNow = next.planningOptions?.now ?? new Date();
      const planningOptions = next.planningOptions
        ? { ...next.planningOptions, now: planningNow }
        : { now: planningNow };
      const planned = touchUpdatedAt(planDailyWork(next.data, planningOptions));
      lastPlannedDateKeyRef.current = toLocalDateKey(planningNow);
      dataRef.current = planned;
      setData(planned);
      enqueueSync(prev, planned);
      return next.result;
    },
    [enqueueSync],
  );

  const addProblem = useCallback((input: ProblemInput, options: AddProblemOptions = {}) => {
    return commit<Problem>((current) => {
      const now = new Date();
      const frozenTodayProblemIds = options.preserveToday
        ? getTodayProblemIds(current, now)
        : undefined;
      const next = addProblemToData(current, input, { now });
      return {
        data: next.data,
        result: next.problem,
        planningOptions: { now, frozenTodayProblemIds },
      };
    });
  }, [commit]);

  const addProblemFromTemplate = useCallback((template: ProblemTemplate): AddTemplateResult => {
    return commit<AddTemplateResult>((current) => {
      const next = addProblemFromTemplateToData(current, template);

      return {
        data: next.data,
        result: { added: next.added, problem: next.problem },
      };
    });
  }, [commit]);

  const updateProblem = useCallback((problemId: string, updates: Partial<ProblemInput>) => {
    commit<void>((current) => ({
      data: updateProblemInData(current, problemId, updates),
      result: undefined,
    }));
  }, [commit]);

  const updateSettings = useCallback((updates: Partial<LeetLoopSettings>) => {
    commit<void>((current) => ({
      data: updateSettingsInData(current, updates),
      result: undefined,
    }));
  }, [commit]);

  const deleteProblem = useCallback((problemId: string) => {
    commit<void>((current) => ({
      data: deleteProblemFromData(current, problemId),
      result: undefined,
    }));
  }, [commit]);

  const logAttempt = useCallback((problemId: string, input: AttemptInput) => {
    return commit<Attempt>((current) => {
      const now = new Date();
      const frozenTodayProblemIds = getTodayProblemIds(current, now);
      frozenTodayProblemIds.delete(problemId);
      const next = logAttemptToData(current, problemId, input, { now });
      return {
        data: next.data,
        result: next.attempt,
        planningOptions: { now, frozenTodayProblemIds },
      };
    });
  }, [commit]);

  const snoozeProblem = useCallback((problemId: string, until?: Date) => {
    commit<void>((current) => {
      const now = new Date();
      const todayPlan = getUpcomingPlan(current, { now, days: 1 })[0];
      const consumesPlanSlot = Boolean(
        todayPlan &&
          [...todayPlan.reviews, ...todayPlan.newStarts].some(
            (problem) => problem.id === problemId,
          ),
      );

      return {
        data: snoozeProblemInData(current, problemId, {
          now,
          until,
          consumePlanSlot: consumesPlanSlot,
        }),
        result: undefined,
      };
    });
  }, [commit]);

  const resumeProblem = useCallback((problemId: string) => {
    commit<void>((current) => ({
      data: resumeProblemInData(current, problemId),
      result: undefined,
    }));
  }, [commit]);

  const swapTodayNewProblem = useCallback((problemId: string) => {
    return commit<SwapTodayProblemResult | undefined>((current) => {
      const now = new Date();
      const next = swapTodayNewProblemInData(current, problemId, { now });
      const result = next.swappedOut && next.swappedIn
        ? { swappedOut: next.swappedOut, swappedIn: next.swappedIn }
        : undefined;

      return {
        data: next.data,
        result,
        planningOptions: {
          now,
          frozenTodayProblemIds: next.frozenTodayProblemIds,
        },
      };
    });
  }, [commit]);

  const addOneToday = useCallback(() => {
    return commit<number>((current) => {
      const now = new Date();
      const next = refillTodayPlan(current, { now, count: 1 });

      return {
        data: next.data,
        result: next.addedCount,
        planningOptions: {
          now,
          frozenTodayProblemIds: next.frozenTodayProblemIds,
        },
      };
    });
  }, [commit]);

  const exportJson = useCallback(() => exportDataFromStorage(dataRef.current), []);

  const importJson = useCallback(async (raw: string) => {
    const imported = importDataFromStorage(raw);
    const prev = dataRef.current;
    const planningNow = new Date();
    const planned = touchUpdatedAt(planDailyWork(imported, { now: planningNow }));
    lastPlannedDateKeyRef.current = toLocalDateKey(planningNow);
    dataRef.current = planned;
    setData(planned);
    // Await the cloud write so the caller only reports success once it lands.
    await enqueueSync(prev, planned);
    return planned;
  }, [enqueueSync]);

  const getProblemAttempts = useCallback(
    (problemId: string) =>
      data.attempts
        .filter((attempt) => attempt.problemId === problemId)
        .sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime()),
    [data.attempts],
  );

  const isTemplateInQueue = useCallback(
    (template: ProblemTemplate) => isTemplateAdded(template, data.problems),
    [data.problems],
  );

  const value = useMemo(
    () => ({
      data,
      ready,
      loadError,
      syncError,
      syncing,
      addProblem,
      addProblemFromTemplate,
      updateProblem,
      updateSettings,
      deleteProblem,
      logAttempt,
      snoozeProblem,
      resumeProblem,
      swapTodayNewProblem,
      addOneToday,
      exportJson,
      importJson,
      getProblemAttempts,
      isTemplateInQueue,
    }),
    [
      addProblem,
      addProblemFromTemplate,
      data,
      deleteProblem,
      exportJson,
      getProblemAttempts,
      importJson,
      isTemplateInQueue,
      loadError,
      logAttempt,
      resumeProblem,
      addOneToday,
      ready,
      syncError,
      syncing,
      snoozeProblem,
      swapTodayNewProblem,
      updateProblem,
      updateSettings,
    ],
  );

  return <LeetLoopContext.Provider value={value}>{children}</LeetLoopContext.Provider>;
}

export function useLeetLoop() {
  const context = useContext(LeetLoopContext);

  if (!context) {
    throw new Error("useLeetLoop must be used inside LeetLoopProvider.");
  }

  return context;
}
