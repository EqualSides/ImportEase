"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StandardChoiceGrid from "@/components/StandardChoiceGrid";
import { toStandardChoiceRow } from "@/lib/xml/standardChoice";
import type { ParseZipResult, StandardChoiceZipEntry } from "@/lib/types";

const THEME_STORAGE_KEY = "importease-theme";

function countMissingAgencyIds(entries: StandardChoiceZipEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    for (const record of entry.records) {
      if (!toStandardChoiceRow(record).serviceProviderCode.trim()) count++;
    }
  }
  return count;
}

function makeBlankStandardChoiceEntry(): StandardChoiceZipEntry {
  return {
    path: "StandardChoiceModel.xml",
    kind: "standardChoice",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

export default function Home() {
  const [zipResult, setZipResult] = useState<ParseZipResult | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [savedVisible, setSavedVisible] = useState(false);
  // Bumped on every grid edit so the page re-renders and re-reads the
  // (mutated-in-place) parsed data — zipResult's own reference never
  // changes, since edits mutate the underlying PNode tree directly.
  const [, setDataVersion] = useState(0);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const handleDataChange = useCallback(() => {
    setDataVersion((v) => v + 1);
    setSavedVisible(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedVisible(false), 1200);
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setZipResult(null);
    setActivePath(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
      const result = body as ParseZipResult;
      setZipResult(result);
      const firstStandardChoice = result.entries.find((en) => en.kind === "standardChoice");
      setActivePath(firstStandardChoice?.path ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }, []);

  const handleNewFile = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const kind = e.target.value;
      e.target.value = "";
      if (kind !== "standardChoice") return;
      if (
        zipResult &&
        !window.confirm("Start a new blank file? Unsaved changes in the current file will be lost.")
      ) {
        return;
      }
      const blankEntry = makeBlankStandardChoiceEntry();
      setError(null);
      setZipResult({ zipName: "new-export.zip", entries: [blankEntry] });
      setActivePath(blankEntry.path);
    },
    [zipResult]
  );

  const standardChoiceEntries = (zipResult?.entries.filter(
    (en) => en.kind === "standardChoice"
  ) ?? []) as StandardChoiceZipEntry[];

  const handleExport = useCallback(async () => {
    if (!zipResult) return;
    const missing = countMissingAgencyIds(standardChoiceEntries);
    if (missing > 0) {
      setError(`${missing} record(s) are missing an Agency ID — it's required before export.`);
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipName: zipResult.zipName, entries: zipResult.entries }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipResult.zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [zipResult, standardChoiceEntries]);

  const passthroughCount = zipResult?.entries.filter((en) => en.kind === "passthrough").length ?? 0;
  const activeEntry = standardChoiceEntries.find((en) => en.path === activePath) ?? null;
  const missingAgencyCount = zipResult ? countMissingAgencyIds(standardChoiceEntries) : 0;
  const gridThemeClass = theme === "dark" ? "ag-theme-quartz-dark" : "ag-theme-quartz";

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-title">
          <span className="dot" />
          ImportEase
        </div>

        {zipResult && (
          <div className="topbar-meta">
            {zipResult.zipName} — {standardChoiceEntries.length} Standard Choice file(s),{" "}
            {passthroughCount} passed through untouched
          </div>
        )}

        <div className="topbar-spacer" />

        <div className={`saved-badge${savedVisible ? " visible" : ""}`}>
          <span className="pulse-dot" />
          Saved in session
        </div>

        <label className="file-input-label">
          Upload .zip
          <input type="file" accept=".zip" onChange={handleFileChange} disabled={loading} />
        </label>

        <select className="select" value="" onChange={handleNewFile} aria-label="Start a new file">
          <option value="">+ New blank file</option>
          <option value="standardChoice">Standard Choice</option>
        </select>

        <button className="btn icon-btn" onClick={toggleTheme} title="Toggle light/dark mode">
          {theme === "dark" ? "☀" : "☾"}
        </button>

        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={!zipResult || exporting}
        >
          {exporting ? "Building zip…" : "Export .zip"}
        </button>
      </div>

      {loading && (
        <div className="parse-trace">
          <div className="sweep" />
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {!error && zipResult && missingAgencyCount > 0 && (
        <div className="required-note" style={{ margin: "8px 20px 0" }}>
          {missingAgencyCount} record(s) missing an Agency ID — required before export.
        </div>
      )}

      <div className="main-area">
        {activeEntry ? (
          <>
            {standardChoiceEntries.length > 1 && (
              <div style={{ display: "flex", gap: 8, padding: "12px 20px 0" }}>
                {standardChoiceEntries.map((en) => (
                  <button
                    key={en.path}
                    className="btn"
                    onClick={() => setActivePath(en.path)}
                    style={
                      en.path === activePath
                        ? { borderColor: "var(--accent-cyan)", color: "var(--accent-cyan)" }
                        : undefined
                    }
                  >
                    {en.path}
                  </button>
                ))}
              </div>
            )}
            <StandardChoiceGrid
              key={activeEntry.path}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
            />
          </>
        ) : (
          <div className="main-empty">
            {zipResult
              ? "No Standard Choices file was recognized in this zip. Everything else will still be passed through untouched on export."
              : "Upload a Configuration Manager export .zip, or start a blank file above, to begin."}
          </div>
        )}
      </div>
    </div>
  );
}
