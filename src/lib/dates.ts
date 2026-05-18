export const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function isDueOnOrBefore(nextReviewAt: string | undefined, today = new Date()): boolean {
  const nextReviewDate = parseDate(nextReviewAt);

  if (!nextReviewDate) {
    return false;
  }

  return toLocalDateKey(nextReviewDate) <= toLocalDateKey(today);
}

export function isOverdue(nextReviewAt: string | undefined, today = new Date()): boolean {
  const nextReviewDate = parseDate(nextReviewAt);

  if (!nextReviewDate) {
    return false;
  }

  return toLocalDateKey(nextReviewDate) < toLocalDateKey(today);
}

export function sortByNewestDate<T>(items: T[], getDate: (item: T) => string | undefined): T[] {
  return [...items].sort((a, b) => {
    const aTime = parseDate(getDate(a))?.getTime() ?? 0;
    const bTime = parseDate(getDate(b))?.getTime() ?? 0;
    return bTime - aTime;
  });
}
