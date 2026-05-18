import Link from "next/link";

export function EmptyState({
  title,
  copy,
  actionHref,
  actionLabel,
}: {
  title: string;
  copy: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-white p-6 text-center">
      <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">{copy}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
