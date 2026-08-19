"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StandardChoiceGrid, { StandardChoiceGridHandle } from "@/components/StandardChoiceGrid";
import { inferCommonAgencyId, toStandardChoiceRow } from "@/lib/xml/standardChoice";
import { detectSensitiveEntries } from "@/lib/sensitiveFiles";
import { exportZipInWorker, parseZipInWorker } from "@/lib/worker/client";
import type { ParseZipResult, StandardChoiceZipEntry } from "@/lib/types";

const THEME_STORAGE_KEY = "importease-theme";

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

function withZipExtension(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "export.zip";
  return /\.zip$/i.test(trimmed) ? trimmed : `${trimmed}.zip`;
}

export default function Home() {
  const [zipResult, setZipResult] = useState<ParseZipResult | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [savedVisible, setSavedVisible] = useState(false);
  const [exportZipName, setExportZipName] = useState("");
  const [agencyId, setAgencyId] = useState("");
  // Per-file Keep/Remove choice for detected sensitive files (User/Group/
  // Security data) — required before export, see architecture-and-safety-
  // update.md. Keyed by entry path; re-derived fresh from zipResult.entries
  // on every render (not a one-time flag from parse) so it also applies if
  // a blank-file session somehow ends up including one of these files.
  const [sensitiveDecisions, setSensitiveDecisions] = useState<Record<string, "keep" | "remove">>({});
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<StandardChoiceGridHandle>(null);

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
    setSavedVisible(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedVisible(false), 1200);
  }, []);

  const loadEntries = useCallback((result: ParseZipResult) => {
    setZipResult(result);
    setExportZipName(result.zipName);
    setSensitiveDecisions({});
    const firstStandardChoice = result.entries.find((en) => en.kind === "standardChoice") as
      | StandardChoiceZipEntry
      | undefined;
    setActivePath(firstStandardChoice?.path ?? null);
    setAgencyId(
      firstStandardChoice ? inferCommonAgencyId(firstStandardChoice.records.map(toStandardChoiceRow)) : ""
    );
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        setError("Please drop a .zip file (an Accela Configuration Manager export).");
        return;
      }
      setLoading(true);
      setError(null);
      setZipResult(null);
      setActivePath(null);
      try {
        loadEntries(await parseZipInWorker(file));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [loadEntries]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  // Page-wide drag-and-drop, in addition to the Upload button. dragDepth
  // (rather than a plain boolean) survives dragenter/dragleave firing on
  // nested children as the cursor moves across the page.
  const [dragDepth, setDragDepth] = useState(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragDepth((d) => d + 1);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragDepth((d) => Math.max(0, d - 1));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setDragDepth(0);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

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
      setError(null);
      loadEntries({ zipName: "new-export.zip", entries: [makeBlankStandardChoiceEntry()] });
    },
    [zipResult, loadEntries]
  );

  const standardChoiceEntries = (zipResult?.entries.filter(
    (en) => en.kind === "standardChoice"
  ) ?? []) as StandardChoiceZipEntry[];

  const sensitiveMatches = zipResult
    ? detectSensitiveEntries(zipResult.entries.map((en) => en.path))
    : [];
  const undecidedSensitive = sensitiveMatches.filter((m) => !sensitiveDecisions[m.path]);

  const decideSensitive = useCallback((path: string, decision: "keep" | "remove") => {
    setSensitiveDecisions((prev) => ({ ...prev, [path]: decision }));
  }, []);

  const handleExport = useCallback(async () => {
    if (!zipResult) return;
    if (!agencyId.trim()) {
      setError("Agency ID is required before export — set it in the field above the grid.");
      return;
    }
    if (undecidedSensitive.length > 0) {
      setError("Decide Keep or Remove for every flagged file below before export.");
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const zipName = withZipExtension(exportZipName);
      const entries = zipResult.entries.filter((en) => sensitiveDecisions[en.path] !== "remove");
      const bytes = await exportZipInWorker(entries, zipName);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [zipResult, exportZipName, agencyId, undecidedSensitive, sensitiveDecisions]);

  const commitAgencyId = useCallback((value: string) => {
    setAgencyId(value);
    gridRef.current?.applyAgencyIdToAll(value);
  }, []);

  const passthroughCount = zipResult?.entries.filter((en) => en.kind === "passthrough").length ?? 0;
  const activeEntry = standardChoiceEntries.find((en) => en.path === activePath) ?? null;
  const gridThemeClass = theme === "dark" ? "ag-theme-quartz-dark" : "ag-theme-quartz";

  return (
    <div
      className="app-shell"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragDepth > 0 && (
        <div className="drop-overlay">
          <div className="drop-overlay-inner">Drop to import .zip</div>
        </div>
      )}
      <div className="topbar">
        <div className="topbar-title">
          <span className="dot" />
          ImportEase
        </div>

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
          disabled={!zipResult || exporting || undecidedSensitive.length > 0}
        >
          {exporting ? "Building zip…" : "Export .zip"}
        </button>
      </div>

      {sensitiveMatches.length > 0 && (
        <div className="sensitive-gate">
          <div className="sensitive-gate-header">
            ⚠ This zip includes files that carry user accounts or security/permission data.
            Decide what happens to each one before you can export.
          </div>
          {sensitiveMatches.map((m) => {
            const decision = sensitiveDecisions[m.path];
            return (
              <div className="sensitive-gate-row" key={m.path}>
                <div className="sensitive-gate-file">
                  <span className="sensitive-gate-path">{m.path}</span>
                  <span className="sensitive-gate-reason">{m.reason}</span>
                </div>
                <div className="sensitive-gate-actions">
                  <button
                    className={`btn${decision === "keep" ? " btn-choice-active" : ""}`}
                    onClick={() => decideSensitive(m.path, "keep")}
                  >
                    Keep
                  </button>
                  <button
                    className={`btn btn-danger${decision === "remove" ? " btn-choice-active" : ""}`}
                    onClick={() => decideSensitive(m.path, "remove")}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {zipResult && (
        <div className="meta-bar">
          <label className="field-label">
            Export as
            <input
              className="text-input"
              value={exportZipName}
              onChange={(e) => setExportZipName(e.target.value)}
              placeholder="export.zip"
            />
          </label>

          <label className="field-label">
            Agency ID
            <input
              className={`text-input${!agencyId.trim() ? " invalid" : ""}`}
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              onBlur={(e) => commitAgencyId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitAgencyId(agencyId);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="required"
            />
          </label>

          <div className="topbar-meta">
            {standardChoiceEntries.length} Standard Choice file(s), {passthroughCount} passed
            through untouched
          </div>
        </div>
      )}

      {loading && (
        <div className="parse-trace">
          <div className="sweep" />
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="main-area">
        {activeEntry ? (
          <>
            {standardChoiceEntries.length > 1 && (
              <div style={{ display: "flex", gap: 8, padding: "12px 20px 0" }}>
                {standardChoiceEntries.map((en) => (
                  <button
                    key={en.path}
                    className="btn"
                    onClick={() => {
                      setActivePath(en.path);
                      setAgencyId(inferCommonAgencyId(en.records.map(toStandardChoiceRow)));
                    }}
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
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          </>
        ) : (
          <div className="main-empty">
            {zipResult
              ? "No Standard Choices file was recognized in this zip. Everything else will still be passed through untouched on export."
              : "Upload or drag in a Configuration Manager export .zip, or start a blank file above, to begin."}
          </div>
        )}
      </div>
    </div>
  );
}
