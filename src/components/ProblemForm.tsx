"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save, Sparkles } from "lucide-react";
import type { LeetCodeProblemMetadata } from "@/lib/leetcodeProblem";
import { parseLeetCodeProblemUrl } from "@/lib/leetcodeProblem";
import {
  getAllProblemTemplates,
  getProblemLeetcodeSlug,
  normalizeLeetcodeSlug,
} from "@/lib/problemSets";
import { DEFAULT_PATTERN_TAGS, inferPrimaryPattern, normalizePatternTags } from "@/lib/tags";
import { DIFFICULTIES, PLATFORMS, type Difficulty, type Platform } from "@/types/problem";
import { useLeetLoop } from "./LeetLoopProvider";

const DEFAULT_PATTERN_TAG_SET = new Set<string>(DEFAULT_PATTERN_TAGS);

type AutofillMetadata = {
  title: string;
  url: string;
  difficulty: Difficulty;
  patterns: string[];
  primaryPattern?: string;
  titleSlug: string;
  sourceSetSlugs?: string[];
};

type ProblemMetadataResponse = {
  problem?: LeetCodeProblemMetadata;
  error?: string;
};

function splitCustomTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function ProblemForm() {
  const router = useRouter();
  const { addProblem, data } = useLeetLoop();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [platform, setPlatform] = useState<Platform>("LeetCode");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState("");
  const [primaryOverride, setPrimaryOverride] = useState<string>();
  const [notes, setNotes] = useState("");
  const [leetcodeSlug, setLeetcodeSlug] = useState<string>();
  const [sourceSetSlugs, setSourceSetSlugs] = useState<string[]>();
  const [autofilling, setAutofilling] = useState(false);
  const [autofillMessage, setAutofillMessage] = useState("");
  const [error, setError] = useState("");
  const autofillRequestId = useRef(0);

  const allPatterns = useMemo(
    () => normalizePatternTags([...selectedTags, ...splitCustomTags(customTags)]),
    [customTags, selectedTags],
  );

  // Derived, not stored: honor a manual pick while it stays in the pattern set,
  // otherwise default to inference from the current patterns.
  const primaryPattern =
    primaryOverride && allPatterns.includes(primaryOverride)
      ? primaryOverride
      : inferPrimaryPattern(allPatterns) ?? "";

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  function applyAutofillMetadata(metadata: AutofillMetadata) {
    const patterns = normalizePatternTags(metadata.patterns);

    setTitle(metadata.title);
    setUrl(metadata.url);
    setDifficulty(metadata.difficulty);
    setPlatform("LeetCode");
    setSelectedTags(patterns.filter((tag) => DEFAULT_PATTERN_TAG_SET.has(tag)));
    setCustomTags(patterns.filter((tag) => !DEFAULT_PATTERN_TAG_SET.has(tag)).join(", "));
    setPrimaryOverride(metadata.primaryPattern ?? inferPrimaryPattern(patterns));
    setLeetcodeSlug(metadata.titleSlug);
    setSourceSetSlugs(metadata.sourceSetSlugs);
  }

  function changeUrl(nextUrl: string) {
    const nextSlug = normalizeLeetcodeSlug(nextUrl);

    autofillRequestId.current += 1;
    setUrl(nextUrl);
    setAutofilling(false);
    setAutofillMessage("");
    setError("");

    if (nextSlug !== leetcodeSlug) {
      setLeetcodeSlug(undefined);
      setSourceSetSlugs(undefined);
    }
  }

  async function autofillFromLink(candidateUrl = url) {
    const requestId = autofillRequestId.current + 1;
    autofillRequestId.current = requestId;
    setError("");
    setAutofillMessage("");

    const titleSlug = parseLeetCodeProblemUrl(candidateUrl);

    if (!titleSlug) {
      setAutofilling(false);
      setError("Paste a valid LeetCode problem link.");
      return;
    }

    const existingProblem = data.problems.find(
      (problem) => getProblemLeetcodeSlug(problem) === titleSlug,
    );

    if (existingProblem) {
      setAutofilling(false);
      setError(`${existingProblem.title} is already in your problems.`);
      return;
    }

    const template = getAllProblemTemplates().find(
      (candidate) => candidate.titleSlug === titleSlug,
    );

    if (template) {
      setAutofilling(false);
      applyAutofillMetadata({
        title: template.title,
        url: template.url,
        difficulty: template.difficulty,
        patterns: template.patterns,
        primaryPattern: template.primaryPattern,
        titleSlug: template.titleSlug,
        sourceSetSlugs: template.sourceSetSlugs,
      });
      setAutofillMessage("Details filled from LeetLoop's built-in problem data.");
      return;
    }

    setAutofilling(true);

    try {
      const response = await fetch("/api/leetcode/problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: candidateUrl }),
      });
      const payload = (await response.json()) as ProblemMetadataResponse;

      if (!response.ok || !payload.problem) {
        throw new Error(payload.error ?? "Could not load details from LeetCode.");
      }

      if (autofillRequestId.current !== requestId) {
        return;
      }

      const problem = payload.problem;
      const patterns = normalizePatternTags(problem.topicTags.map((tag) => tag.name));

      applyAutofillMetadata({
        title: problem.title,
        url: problem.url,
        difficulty: problem.difficulty,
        patterns,
        primaryPattern: inferPrimaryPattern(patterns),
        titleSlug: problem.titleSlug,
      });
      setAutofillMessage("Details filled from LeetCode. Review or adjust anything below.");
    } catch (autofillError) {
      if (autofillRequestId.current !== requestId) {
        return;
      }

      setError(
        autofillError instanceof Error
          ? autofillError.message
          : "Could not load details from LeetCode.",
      );
    } finally {
      if (autofillRequestId.current === requestId) {
        setAutofilling(false);
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!url.trim()) {
      setError("URL is required.");
      return;
    }

    const submittedSlug = parseLeetCodeProblemUrl(url);
    const existingProblem = submittedSlug
      ? data.problems.find((problem) => getProblemLeetcodeSlug(problem) === submittedSlug)
      : undefined;

    if (existingProblem) {
      setError(`${existingProblem.title} is already in your problems.`);
      return;
    }

    const problem = addProblem({
      title,
      url,
      platform,
      difficulty,
      patterns: allPatterns,
      primaryPattern: primaryPattern || undefined,
      notes,
      leetcodeSlug,
      sourceSetSlugs,
    });

    router.push(`/problems/${problem.id}`);
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
        <label className="block text-sm font-medium" htmlFor="problem-url">
          Problem link
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            id="problem-url"
            onChange={(event) => changeUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void autofillFromLink();
              }
            }}
            onPaste={(event) => {
              const pastedUrl = event.clipboardData.getData("text").trim();

              if (parseLeetCodeProblemUrl(pastedUrl)) {
                event.preventDefault();
                changeUrl(pastedUrl);
                void autofillFromLink(pastedUrl);
              }
            }}
            placeholder="https://leetcode.com/problems/two-sum/"
            type="url"
            value={url}
          />
          <button
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-[var(--accent)] bg-white px-3 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[#e6f4f1] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-[#98a2b3]"
            disabled={autofilling || !url.trim()}
            onClick={() => void autofillFromLink()}
            type="button"
          >
            {autofilling ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            {autofilling ? "Loading" : "Autofill"}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Paste a LeetCode link to fill the title, difficulty, tags, and primary concept
          automatically. Other problem links can still be entered manually.
        </p>
        {autofillMessage ? (
          <p className="mt-2 text-sm font-medium text-emerald-700">{autofillMessage}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">
          Title
          <input
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Minimum Window Substring"
            value={title}
          />
        </label>

        <label className="block text-sm font-medium">
          Difficulty
          <select
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            onChange={(event) => setDifficulty(event.target.value as Difficulty)}
            value={difficulty}
          >
            {DIFFICULTIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Platform
          <select
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            onChange={(event) => setPlatform(event.target.value as Platform)}
            value={platform}
          >
            {PLATFORMS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Pattern tags</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DEFAULT_PATTERN_TAGS.map((tag) => (
            <label
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                selectedTags.includes(tag)
                  ? "border-[var(--accent)] bg-[#e6f4f1] text-[var(--accent-strong)]"
                  : "border-[var(--border)] bg-white text-[var(--foreground)]"
              }`}
              key={tag}
            >
              <input
                checked={selectedTags.includes(tag)}
                className="size-4 accent-[var(--accent)]"
                onChange={() => toggleTag(tag)}
                type="checkbox"
              />
              {tag}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm font-medium">
        Custom tags
        <input
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          onChange={(event) => setCustomTags(event.target.value)}
          placeholder="Counting, Queue"
          value={customTags}
        />
      </label>

      <label className="block text-sm font-medium">
        Primary concept
        <select
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)] disabled:bg-[var(--surface-subtle)]"
          disabled={allPatterns.length === 0}
          onChange={(event) => setPrimaryOverride(event.target.value)}
          value={primaryPattern}
        >
          {allPatterns.length === 0 ? <option value="">Select a pattern tag first</option> : null}
          {allPatterns.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
          The single concept this problem is for. Defaults from your tags.
        </span>
      </label>

      <label className="block text-sm font-medium">
        Notes
        <textarea
          className="mt-1 min-h-28 w-full resize-y rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Pattern trigger, key invariant, edge cases"
          value={notes}
        />
      </label>

      <button
        className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
        disabled={autofilling}
        type="submit"
      >
        <Save size={16} />
        Save problem
      </button>
    </form>
  );
}
