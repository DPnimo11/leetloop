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
  updateProblem as updateProblemInData,
  updateSettings as updateSettingsInData,
} from "@/lib/storage";
import { isTemplateAdded } from "@/lib/problemSets";
import { planDailyWork, refillTodayPlan } from "@/lib/planning";
import { createClient } from "@/lib/supabase/client";
import { loadCloudData, syncCloudData } from "@/lib/cloud/repository";

type AddTemplateResult = {
  added: boolean;
  problem: Problem;
};

type LeetLoopContextValue = {
  data: LeetLoopData;
  ready: boolean;
  loadError?: string;
  syncError?: string;
  syncing: boolean;
  addProblem: (input: ProblemInput) => Problem;
  addProblemFromTemplate: (template: ProblemTemplate) => AddTemplateResult;
  updateProblem: (problemId: string, updates: Partial<ProblemInput>) => void;
  updateSettings: (updates: Partial<LeetLoopSettings>) => void;
  deleteProblem: (problemId: string) => void;
  logAttempt: (problemId: string, input: AttemptInput) => Attempt;
  repopulateToday: () => number;
  exportJson: () => string;
  importJson: (raw: string) => Promise<LeetLoopData>;
  getProblemAttempts: (problemId: string) => Attempt[];
  isTemplateInQueue: (template: ProblemTemplate) => boolean;
};

const LeetLoopContext = createContext<LeetLoopContextValue | undefined>(undefined);

function touchUpdatedAt(data: LeetLoopData): LeetLoopData {
  return { ...data, updatedAt: new Date().toISOString() };
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
          dataRef.current = emptyData;
          setData(emptyData);
          return;
        }

        userIdRef.current = user.id;
        const loaded = await loadCloudData(supabase, user.id);

        if (cancelled) {
          return;
        }

        const planned = touchUpdatedAt(planDailyWork(loaded));
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

  const commit = useCallback(
    <T,>(updater: (current: LeetLoopData) => { data: LeetLoopData; result: T }) => {
      const prev = dataRef.current;
      const next = updater(prev);

      if (next.data === prev) {
        return next.result;
      }

      const planned = touchUpdatedAt(planDailyWork(next.data));
      dataRef.current = planned;
      setData(planned);
      enqueueSync(prev, planned);
      return next.result;
    },
    [enqueueSync],
  );

  const addProblem = useCallback((input: ProblemInput) => {
    return commit<Problem>((current) => {
      const next = addProblemToData(current, input);
      return {
        data: next.data,
        result: next.problem,
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
      const next = logAttemptToData(current, problemId, input);
      return {
        data: next.data,
        result: next.attempt,
      };
    });
  }, [commit]);

  const repopulateToday = useCallback(() => {
    return commit<number>((current) => {
      const next = refillTodayPlan(current);

      return {
        data: next.data,
        result: next.addedCount,
      };
    });
  }, [commit]);

  const exportJson = useCallback(() => exportDataFromStorage(dataRef.current), []);

  const importJson = useCallback(async (raw: string) => {
    const imported = importDataFromStorage(raw);
    const prev = dataRef.current;
    const planned = touchUpdatedAt(planDailyWork(imported));
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
      repopulateToday,
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
      repopulateToday,
      ready,
      syncError,
      syncing,
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
