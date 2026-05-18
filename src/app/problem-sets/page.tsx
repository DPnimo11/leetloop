import { ProblemSetsClient } from "@/components/ProblemSetsClient";

export default function ProblemSetsPage() {
  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
          Problem sets
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal">
          LeetCode 75 and Top Interview 150
        </h1>
      </section>
      <ProblemSetsClient />
    </div>
  );
}
