export default function ProblemSetsPage() {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
        Problem sets
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-normal">
        LeetCode 75 and Top Interview 150
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        Built-in templates will be browseable here and can be added to your queue without
        duplicating overlapping problems.
      </p>
    </section>
  );
}
