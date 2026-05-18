import { ProblemForm } from "@/components/ProblemForm";

export default function AddProblemPage() {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
        Add
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-normal">Add a problem</h1>
      <div className="mt-5">
        <ProblemForm />
      </div>
    </section>
  );
}
