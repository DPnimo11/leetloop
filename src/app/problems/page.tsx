import { ProblemsClient } from "@/components/ProblemsClient";

export default function ProblemsPage() {
  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
          Problems
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal">All problems</h1>
      </section>
      <ProblemsClient />
    </div>
  );
}
