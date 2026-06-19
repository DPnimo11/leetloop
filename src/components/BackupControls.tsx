"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useLeetLoop } from "./LeetLoopProvider";

export function BackupControls() {
  const { data, exportJson, importJson } = useLeetLoop();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  function exportBackup() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const dateKey = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `leetloop-backup-${dateKey}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setError("");
    setMessage("Export ready.");
  }

  async function importBackup(file?: File) {
    if (!file) {
      return;
    }

    setError("");
    setMessage("");

    const confirmed = window.confirm(
      "Importing this file will replace your LeetLoop account data in the cloud. This cannot be undone.",
    );

    if (!confirmed) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setImporting(true);

    try {
      const raw = await file.text();
      const importedData = await importJson(raw);
      setMessage(
        `Imported and synced ${importedData.problems.length} problems and ${importedData.attempts.length} attempts.`,
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import that backup.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-[var(--accent-strong)]">
            Backup
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal">JSON import/export</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Current account data: {data.problems.length} problems, {data.attempts.length} attempts.
            Import replaces everything in your cloud account.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={exportBackup}
            disabled={importing}
            type="button"
          >
            <Download size={16} />
            Export JSON
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            type="button"
          >
            <Upload size={16} />
            {importing ? "Importing…" : "Import JSON"}
          </button>
          <input
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void importBackup(event.target.files?.[0])}
            ref={fileInputRef}
            type="file"
          />
        </div>
      </div>
      {message ? <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}
    </section>
  );
}
