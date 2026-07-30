import { NextResponse } from "next/server";
import {
  LEETCODE_PROBLEM_QUERY,
  parseLeetCodeProblemMetadata,
  parseLeetCodeProblemUrl,
} from "@/lib/leetcodeProblem";

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A LeetCode problem link is required." }, { status: 400 });
  }

  const submittedUrl = isRecord(body) && typeof body.url === "string" ? body.url : "";
  const titleSlug = parseLeetCodeProblemUrl(submittedUrl);

  if (!titleSlug) {
    return NextResponse.json(
      { error: "Paste a valid LeetCode problem link." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: `https://leetcode.com/problems/${titleSlug}/`,
        "User-Agent": "LeetLoop problem metadata fetcher",
      },
      body: JSON.stringify({
        operationName: "questionData",
        query: LEETCODE_PROBLEM_QUERY,
        variables: { titleSlug },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "LeetCode problem details are temporarily unavailable." },
        { status: 502 },
      );
    }

    const payload: unknown = await response.json();
    const problem = parseLeetCodeProblemMetadata(payload);

    if (!problem) {
      return NextResponse.json(
        { error: "LeetCode could not find that problem." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { problem },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not load details from LeetCode. You can still enter them manually." },
      { status: 502 },
    );
  }
}
