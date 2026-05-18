export const ATTEMPT_RESULTS = [
  "solved_clean",
  "solved_buggy",
  "needed_hint",
  "looked_solution",
  "failed_reconstruct",
] as const;

export type AttemptResult = (typeof ATTEMPT_RESULTS)[number];

export type Attempt = {
  id: string;
  problemId: string;
  attemptedAt: string;
  result: AttemptResult;
  timeMinutes?: number;
  note?: string;
};

export type AttemptInput = {
  result: AttemptResult;
  attemptedAt?: string;
  timeMinutes?: number;
  note?: string;
};

export const ATTEMPT_RESULT_LABELS: Record<AttemptResult, string> = {
  solved_clean: "Solved clean",
  solved_buggy: "Solved with bugs",
  needed_hint: "Needed hint",
  looked_solution: "Looked at solution",
  failed_reconstruct: "Couldn't reconstruct",
};

export const SHAKY_ATTEMPT_RESULTS = [
  "needed_hint",
  "looked_solution",
  "failed_reconstruct",
] as const satisfies readonly AttemptResult[];

export function isAttemptResult(value: unknown): value is AttemptResult {
  return typeof value === "string" && ATTEMPT_RESULTS.includes(value as AttemptResult);
}
