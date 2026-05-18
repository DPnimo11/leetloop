import { AnalyticsClient } from "@/components/AnalyticsClient";

export default function AnalyticsPage() {
  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
          Analytics
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal">Pattern signal</h1>
      </section>
      <AnalyticsClient />
    </div>
  );
}
