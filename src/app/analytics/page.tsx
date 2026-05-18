export default function AnalyticsPage() {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
        Analytics
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-normal">Pattern signal</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        Totals, weakest patterns, and due counts will appear here once attempts are stored.
      </p>
    </section>
  );
}
