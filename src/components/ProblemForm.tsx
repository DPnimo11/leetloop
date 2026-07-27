"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { DEFAULT_PATTERN_TAGS, inferPrimaryPattern, normalizePatternTags } from "@/lib/tags";
import { DIFFICULTIES, PLATFORMS, type Difficulty, type Platform } from "@/types/problem";
import { useLeetLoop } from "./LeetLoopProvider";

function splitCustomTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function ProblemForm() {
  const router = useRouter();
  const { addProblem } = useLeetLoop();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [platform, setPlatform] = useState<Platform>("LeetCode");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState("");
  const [primaryOverride, setPrimaryOverride] = useState<string>();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

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

    const problem = addProblem({
      title,
      url,
      platform,
      difficulty,
      patterns: allPatterns,
      primaryPattern: primaryPattern || undefined,
      notes,
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
          URL
          <input
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://leetcode.com/problems/..."
            type="url"
            value={url}
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
        className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
        type="submit"
      >
        <Save size={16} />
        Save problem
      </button>
    </form>
  );
}
