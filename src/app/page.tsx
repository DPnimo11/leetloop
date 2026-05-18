import Link from "next/link";

const sections = [
  {
    title: "Overdue",
    copy: "Problems that slipped past their review date will land here first.",
  },
  {
    title: "Due Today",
    copy: "The daily queue will prioritize what needs another pass today.",
  },
  {
    title: "Suggested New",
    copy: "Unadded LeetCode 75 and Top Interview 150 problems will appear as light suggestions.",
  },
  {
    title: "Recently Attempted",
    copy: "Your latest logs will stay visible so the next review date feels obvious.",
  },
];

export default function TodayPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
            Today
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-[var(--foreground)]">
            Your review queue is warming up.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            The app shell is ready. The next checkpoint adds local data, scheduling,
            and tests before the real queue UI comes online.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/add"
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
          >
            Add problem
          </Link>
          <Link
            href="/problem-sets"
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-subtle)]"
          >
            Browse sets
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
            key={section.title}
          >
            <h2 className="text-lg font-semibold tracking-normal">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{section.copy}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
