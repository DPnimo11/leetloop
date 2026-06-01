const LEETLOOP_REVIEW_PARAM = "leetloop";
const LEETLOOP_REVIEW_VALUE = "review";

export function leetLoopReviewUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const isLeetCodeProblem =
      (parsed.hostname === "leetcode.com" || parsed.hostname === "www.leetcode.com") &&
      /^\/problems\/[^/]+\/?/.test(parsed.pathname);

    if (!isLeetCodeProblem) {
      return url;
    }

    parsed.searchParams.set(LEETLOOP_REVIEW_PARAM, LEETLOOP_REVIEW_VALUE);
    return parsed.toString();
  } catch {
    return url;
  }
}
