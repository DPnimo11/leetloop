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
import type { LeetLoopData } from "@/types/storage";
import {
  addProblem as addProblemToData,
  createEmptyData,
  deleteProblem as deleteProblemFromData,
  exportData as exportDataFromStorage,
  importData as importDataFromStorage,
  loadData,
  logAttempt as logAttemptToData,
  saveData,
  updateProblem as updateProblemInData,
} from "@/lib/storage";
import {
  createProblemInputFromTemplate,
  getProblemLeetcodeSlug,
  isTemplateAdded,
} from "@/lib/problemSets";
import { planNewProblemStarts } from "@/lib/planning";

type AddTemplateResult = {
  added: boolean;
  problem: Problem;
};

type LeetLoopContextValue = {
  data: LeetLoopData;
  ready: boolean;
  loadError?: string;
  addProblem: (input: ProblemInput) => Problem;
  addProblemFromTemplate: (template: ProblemTemplate) => AddTemplateResult;
  updateProblem: (problemId: string, updates: Partial<ProblemInput>) => void;
  deleteProblem: (problemId: string) => void;
  logAttempt: (problemId: string, input: AttemptInput) => Attempt;
  exportJson: () => string;
  importJson: (raw: string) => LeetLoopData;
  getProblemAttempts: (problemId: string) => Attempt[];
  isTemplateInQueue: (template: ProblemTemplate) => boolean;
};

const LeetLoopContext = createContext<LeetLoopContextValue | undefined>(undefined);

export function LeetLoopProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LeetLoopData>(() => createEmptyData());
  const dataRef = useRef(data);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const loadedData = saveData(planNewProblemStarts(loadData()));
        dataRef.current = loadedData;
        setData(loadedData);
      } catch (error) {
        const emptyData = createEmptyData();
        setLoadError(error instanceof Error ? error.message : "Could not load local data.");
        dataRef.current = emptyData;
        setData(emptyData);
      } finally {
        setReady(true);
      }
    });
  }, []);

  const commit = useCallback(<T,>(updater: (current: LeetLoopData) => { data: LeetLoopData; result: T }) => {
    const next = updater(dataRef.current);
    const savedData = saveData(planNewProblemStarts(next.data));
    dataRef.current = savedData;
    setData(savedData);
    return next.result;
  }, []);

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
      const existing = current.problems.find(
        (problem) => getProblemLeetcodeSlug(problem) === template.titleSlug,
      );

      if (existing) {
        return {
          data: current,
          result: { added: false, problem: existing },
        };
      }

      const next = addProblemToData(current, createProblemInputFromTemplate(template));
      return {
        data: next.data,
        result: { added: true, problem: next.problem },
      };
    });
  }, [commit]);

  const updateProblem = useCallback((problemId: string, updates: Partial<ProblemInput>) => {
    commit<void>((current) => ({
      data: updateProblemInData(current, problemId, updates),
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

  const exportJson = useCallback(() => exportDataFromStorage(dataRef.current), []);

  const importJson = useCallback((raw: string) => {
    const importedData = importDataFromStorage(raw);
    const savedData = saveData(planNewProblemStarts(importedData));
    dataRef.current = savedData;
    setData(savedData);
    return savedData;
  }, []);

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
      addProblem,
      addProblemFromTemplate,
      updateProblem,
      deleteProblem,
      logAttempt,
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
      ready,
      updateProblem,
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
