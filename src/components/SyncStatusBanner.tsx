"use client";

import { useLeetLoop } from "./LeetLoopProvider";

/**
 * Surfaces cloud sync problems so a failed write is never silent. Clears
 * itself automatically once a later write succeeds.
 */
export function SyncStatusBanner() {
  const { loadError, syncError } = useLeetLoop();
  const message = loadError ?? syncError;

  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-2 text-sm text-[var(--danger)] sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        {loadError
          ? `Couldn't load your data from the cloud: ${loadError}. Try reloading.`
          : `Couldn't save your latest changes to the cloud: ${syncError}. Check your connection — recent edits may not be saved until the next successful sync.`}
      </div>
    </div>
  );
}
