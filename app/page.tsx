"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StandardChoiceGrid, { StandardChoiceGridHandle } from "@/components/StandardChoiceGrid";
import {
  getStandardChoiceValueNodes,
  inferCommonAgencyId,
  toStandardChoiceRow,
  toStandardChoiceValueRow,
} from "@/lib/xml/standardChoice";
import { detectSensitiveEntries } from "@/lib/sensitiveFiles";
import { exportZipInWorker, parseZipInWorker } from "@/lib/worker/client";
import type { ParseZipResult, StandardChoiceZipEntry } from "@/lib/types";

const THEME_STORAGE_KEY = "importease-theme";

// Full category catalog (see category-catalog.md) so the "start new file"
// picker shows what's coming, not just what's built — Data Manager Version
// (tooling metadata, not editable config) and Workflow (confirmed
// view/pass-through only, never editable — see architecture-and-safety-
// update.md) are intentionally excluded, since neither is ever a "start
// blank and fill in" target.
const CATEGORY_OPTIONS: { value: string; label: string; available: boolean }[] = [
  { value: "standardChoice", label: "Standard Choice", available: true },
  { value: "sharedDropDown", label: "Shared Drop-down List", available: false },
  { value: "refAddressTypeGroup", label: "Ref Address Type Group", available: false },
  { value: "orgAgency", label: "Organization/Agency", available: false },
  { value: "inspRelateInsp", label: "Insp Relate Insp", available: false },
  { value: "conditions", label: "Conditions", available: false },
  { value: "rapoTemplate", label: "RAPO Template", available: false },
  { value: "timeGroup", label: "Time Group", available: false },
  { value: "timeTypes", label: "Time Types", available: false },
  { value: "checklistGroup", label: "Checklist Group", available: false },
  { value: "referenceMask", label: "Reference Mask", available: false },
  { value: "refLookupTable", label: "Ref Lookup Table", available: false },
  { value: "emailMessage", label: "Email Message", available: false },
  { value: "userProfiles", label: "User Profiles", available: false },
  { value: "standardCommentGroup", label: "Standard Comment Group", available: false },
  { value: "departmentType", label: "Department Type", available: false },
  { value: "user", label: "User", available: false },
  { value: "refInspectionResultGroup", label: "Ref Inspection Result Group", available: false },
  { value: "commentGroup", label: "Comment Group", available: false },
  { value: "sequence", label: "Sequence", available: false },
  { value: "applicationStatusGroup", label: "Application Status Group", available: false },
  { value: "refCalendar", label: "Ref Calendar", available: false },
  { value: "inspectionGroup", label: "Inspection Group", available: false },
  { value: "refDocument", label: "Ref Document", available: false },
  { value: "guideSheet", label: "Guide Sheet", available: false },
  { value: "smartChoiceGroup", label: "Smart Choice Group", available: false },
  { value: "virtualProcess", label: "Virtual Process", available: false },
  { value: "refFeeSchedule", label: "Ref Fee Schedule", available: false },
  { value: "capType", label: "Cap Type", available: false },
  { value: "acaConfiguration", label: "ACA Configuration", available: false },
  { value: "agencyGroup", label: "Agency Group", available: false },
  { value: "formLayoutEditor", label: "Form Layout Editor", available: false },
  { value: "asiGroups", label: "ASI Groups", available: false },
];

// Fields the schema doc (docs/schema-standard-choice.md) marks "always" —
// required before export can proceed, same treatment as the required
// Agency ID field.
function validateStandardChoiceEntries(entries: StandardChoiceZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toStandardChoiceRow(record);
      if (!row.name.trim()) {
        return `"${entry.path}" has a Standard Choice with no Name set — every Standard Choice needs a Name before export.`;
      }
      for (const valueNode of getStandardChoiceValueNodes(record)) {
        const valueRow = toStandardChoiceValueRow(valueNode);
        if (!valueRow.value.trim()) {
          return `"${entry.path}" — "${row.name || "(unnamed)"}" has a value with no Value set — every value needs a Value before export.`;
        }
      }
    }
  }
  return null;
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

function withZipExtension(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "export.zip";
  return /\.zip$/i.test(trimmed) ? trimmed : `${trimmed}.zip`;
}

/**
 * Merges a newly-uploaded/dropped zip's entries into the current session so
 * multiple zips can be combined and exported as one file. If an entry path
 * collides with one already in the session, the incoming one is suffixed
 * "(2)", "(3)", etc. rather than silently overwriting the existing entry.
 */
function mergeParseResults(base: ParseZipResult | null, addition: ParseZipResult): ParseZipResult {
  if (!base) return addition;
  const existingPaths = new Set(base.entries.map((e) => e.path));
  const mergedEntries = [...base.entries];
  for (const entry of addition.entries) {
    let path = entry.path;
    if (existingPaths.has(path)) {
      const dot = path.lastIndexOf(".");
      const stem = dot === -1 ? path : path.slice(0, dot);
      const ext = dot === -1 ? "" : path.slice(dot);
      let n = 2;
      let candidate = `${stem} (${n})${ext}`;
      while (existingPaths.has(candidate)) {
        n++;
        candidate = `${stem} (${n})${ext}`;
      }
      path = candidate;
    }
    existingPaths.add(path);
    mergedEntries.push(path === entry.path ? entry : { ...entry, path });
  }
  return { zipName: base.zipName, entries: mergedEntries };
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
  const agencyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  // Everything lives in memory only (no persistence, by design — see
  // CLAUDE.md) — closing or reloading the tab loses whatever hasn't been
  // exported yet. Warn before that happens. Browsers show their own fixed
  // wording here; the returnValue/preventDefault pair is what triggers
  // that native prompt, custom text isn't supported by any modern browser.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!zipResult) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [zipResult]);

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

  // Uploading/dropping additional zip(s) while a session is already open
  // merges into it (see mergeParseResults) rather than replacing it, so
  // multiple exports can be combined and exported as one file. A fresh
  // upload with nothing loaded yet is just a merge onto an empty session.
  const processFiles = useCallback(
    async (files: File[]) => {
      const zipFiles = files.filter((f) => f.name.toLowerCase().endsWith(".zip"));
      if (zipFiles.length === 0) {
        setError("Please choose a .zip file (an Accela Configuration Manager export).");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let merged = zipResult;
        for (const file of zipFiles) {
          const parsed = await parseZipInWorker(file);
          merged = mergeParseResults(merged, parsed);
        }
        if (merged) loadEntries(merged);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [loadEntries, zipResult]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) await processFiles(files);
      e.target.value = "";
    },
    [processFiles]
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
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length) processFiles(files);
    },
    [processFiles]
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

  // Uploads/drops now merge into the current session rather than replacing
  // it (see mergeParseResults), so there needs to be an explicit way back
  // to a clean slate.
  const handleClear = useCallback(() => {
    if (zipResult && !window.confirm("Clear the current session? Unsaved changes will be lost.")) {
      return;
    }
    setZipResult(null);
    setActivePath(null);
    setExportZipName("");
    setAgencyId("");
    setSensitiveDecisions({});
    setError(null);
  }, [zipResult]);

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
    const validationError = validateStandardChoiceEntries(standardChoiceEntries);
    if (validationError) {
      setError(validationError);
      return;
    }
    setExporting(true);
    setError(null);
    try {
      // Belt-and-suspenders: guarantee every record reflects the current
      // Agency ID before building the export, regardless of whether the
      // debounce timer has fired yet or blur/Enter already committed it.
      // Idempotent if already applied.
      if (agencyDebounceRef.current) {
        clearTimeout(agencyDebounceRef.current);
        agencyDebounceRef.current = null;
      }
      gridRef.current?.applyAgencyIdToAll(agencyId);

      const zipName = withZipExtension(exportZipName);
      const entries = zipResult.entries.filter((en) => sensitiveDecisions[en.path] !== "remove");
      const bytes = await exportZipInWorker(entries, zipName);
      // TS's DOM lib types a worker-derived Uint8Array's buffer as the
      // broader ArrayBufferLike (which could in principle be a
      // SharedArrayBuffer), which BlobPart doesn't accept — it's always a
      // plain ArrayBuffer in practice here (from JSZip's generateAsync).
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/zip" });
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
  }, [zipResult, exportZipName, agencyId, undecidedSensitive, sensitiveDecisions, standardChoiceEntries]);

  // Cascading on every keystroke would be wasteful (it touches every
  // record/child in the file), but relying solely on blur/Enter to commit
  // is fragile — a browser or automation context where a programmatic
  // blur doesn't fire cleanly would silently leave existing records
  // un-cascaded even though newly-added rows (driven by the `agencyId`
  // prop, not this commit path) look right. Debounce-commit as a
  // reliability backstop; blur/Enter still commit immediately for snappy
  // feedback when they do fire, and handleExport also guarantees it as a
  // last resort right before building the zip.
  const commitAgencyId = useCallback((value: string) => {
    if (agencyDebounceRef.current) {
      clearTimeout(agencyDebounceRef.current);
      agencyDebounceRef.current = null;
    }
    setAgencyId(value);
    gridRef.current?.applyAgencyIdToAll(value);
  }, []);

  const handleAgencyIdChange = useCallback((value: string) => {
    setAgencyId(value);
    if (agencyDebounceRef.current) clearTimeout(agencyDebounceRef.current);
    agencyDebounceRef.current = setTimeout(() => {
      agencyDebounceRef.current = null;
      gridRef.current?.applyAgencyIdToAll(value);
    }, 500);
  }, []);

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

        {zipResult && (
          <>
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
                onChange={(e) => handleAgencyIdChange(e.target.value)}
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
          </>
        )}

        <label className="file-input-label">
          Upload .zip
          <input
            type="file"
            accept=".zip"
            multiple
            onChange={handleFileChange}
            disabled={loading}
          />
        </label>

        <select className="select" value="" onChange={handleNewFile} aria-label="Start a new file">
          <option value="" disabled hidden>
            Start new file
          </option>
          <optgroup label="Available now">
            {CATEGORY_OPTIONS.filter((c) => c.available).map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Coming soon">
            {CATEGORY_OPTIONS.filter((c) => !c.available).map((c) => (
              <option key={c.value} value={c.value} disabled>
                {c.label}
              </option>
            ))}
          </optgroup>
        </select>

        <button className="btn btn-danger" onClick={handleClear} disabled={!zipResult}>
          Clear
        </button>

        <button className="btn icon-btn" onClick={toggleTheme} title="Toggle light/dark mode">
          {theme === "dark" ? "☀" : "☾"}
        </button>

        {standardChoiceEntries.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={!zipResult || exporting || undecidedSensitive.length > 0}
          style={{ marginLeft: "auto" }}
        >
          {exporting ? "Building zip…" : "Export .zip"}
        </button>
      </div>

      {undecidedSensitive.length > 0 && (
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
                  <span className="sensitive-gate-reason">
                    <strong
                      style={{
                        color:
                          m.tier === "credentials" ? "var(--accent-danger)" : "var(--accent-amber)",
                      }}
                    >
                      {m.tier === "credentials" ? "Credentials/PII — " : "Embedded security reference — "}
                    </strong>
                    {m.reason}
                  </span>
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

      {loading && (
        <div className="parse-trace">
          <div className="sweep" />
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="main-area">
        {activeEntry ? (
          <>
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
