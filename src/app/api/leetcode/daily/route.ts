import { NextResponse } from "next/server";
import {
  LEETCODE_DAILY_QUERY,
  parseLeetCodeDailyProblem,
} from "@/lib/dailyLeetcode";

const DAILY_REVALIDATE_SECONDS = 30 * 60;
const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";

export const revalidate = 1800;

export async function GET() {
  try {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com/problemset/",
        "User-Agent": "LeetLoop daily problem fetcher",
      },
      body: JSON.stringify({
        operationName: "questionOfToday",
        query: LEETCODE_DAILY_QUERY,
      }),
      next: { revalidate: DAILY_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "LeetCode daily problem is unavailable." },
        { status: 502 },
      );
    }

    const payload: unknown = await response.json();
    const problem = parseLeetCodeDailyProblem(payload);

    if (!problem) {
      return NextResponse.json(
        { error: "LeetCode returned an unexpected daily problem response." },
        { status: 502 },
      );
    }

    return NextResponse.json({ problem });
  } catch {
    return NextResponse.json(
      { error: "Could not load the LeetCode daily problem." },
      { status: 502 },
    );
  }
}
