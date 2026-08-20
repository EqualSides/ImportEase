"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StandardChoiceGrid from "@/components/StandardChoiceGrid";
import SharedDropDownGrid from "@/components/SharedDropDownGrid";
import RefAddressTypeGroupGrid from "@/components/RefAddressTypeGroupGrid";
import FlatGrid, { type FlatGridColumnMeta } from "@/components/FlatGrid";
import {
  getStandardChoiceValueNodes,
  inferCommonAgencyId as inferCommonAgencyIdStandardChoice,
  toStandardChoiceRow,
  toStandardChoiceValueRow,
} from "@/lib/xml/standardChoice";
import {
  getSharedDropDownValueNodes,
  inferCommonAgencyId as inferCommonAgencyIdSharedDropDown,
  toSharedDropDownRow,
  toSharedDropDownValueRow,
} from "@/lib/xml/sharedDropDownList";
import {
  createOrganizationAgencyNode,
  deleteOrganizationAgency,
  findOrganizationAgencyByUid,
  inferCommonAgencyId as inferCommonAgencyIdOrgAgency,
  nextRefIdNumber as nextRefIdNumberOrgAgency,
  setOrganizationAgencyField,
  toOrganizationAgencyRow,
} from "@/lib/xml/organizationAgency";
import {
  createInspRelateInspNode,
  deleteInspRelateInsp,
  findInspRelateInspByUid,
  inferCommonAgencyId as inferCommonAgencyIdInspRelateInsp,
  nextRefIdNumber as nextRefIdNumberInspRelateInsp,
  setInspRelateInspField,
  toInspRelateInspRow,
} from "@/lib/xml/inspRelateInsp";
import {
  getRefAddressTypeNodes,
  inferCommonAgencyId as inferCommonAgencyIdRefAddressTypeGroup,
  toRefAddressTypeGroupRow,
  toRefAddressTypeRow,
} from "@/lib/xml/refAddressTypeGroup";
import { detectSensitiveEntries } from "@/lib/sensitiveFiles";
import { exportZipInWorker, parseZipInWorker } from "@/lib/worker/client";
import type {
  InspRelateInspZipEntry,
  OrganizationAgencyZipEntry,
  ParseZipResult,
  RefAddressTypeGroupZipEntry,
  SharedDropDownZipEntry,
  StandardChoiceZipEntry,
  ZipEntryData,
} from "@/lib/types";

/** Every grid component exposes exactly this shape via forwardRef — a
 * shared structural type lets page.tsx hold one ref regardless of which
 * category's grid is currently mounted. */
interface GridHandle {
  applyAgencyIdToAll: (value: string) => void;
}

type EditableZipEntry =
  | StandardChoiceZipEntry
  | SharedDropDownZipEntry
  | OrganizationAgencyZipEntry
  | InspRelateInspZipEntry
  | RefAddressTypeGroupZipEntry;

function isEditableEntry(entry: ZipEntryData): entry is EditableZipEntry {
  return (
    entry.kind === "standardChoice" ||
    entry.kind === "sharedDropDown" ||
    entry.kind === "organizationAgency" ||
    entry.kind === "inspRelateInsp" ||
    entry.kind === "refAddressTypeGroup"
  );
}

/** Dispatches to the right model's Agency ID field per entry kind — see the
 * per-model field-name-variance note in lib/xml/sharedDropDownList.ts. */
function inferAgencyIdForEntry(entry: EditableZipEntry): string {
  switch (entry.kind) {
    case "standardChoice":
      return inferCommonAgencyIdStandardChoice(entry.records.map(toStandardChoiceRow));
    case "sharedDropDown":
      return inferCommonAgencyIdSharedDropDown(entry.records.map(toSharedDropDownRow));
    case "organizationAgency":
      return inferCommonAgencyIdOrgAgency(entry.records.map(toOrganizationAgencyRow));
    case "inspRelateInsp":
      return inferCommonAgencyIdInspRelateInsp(entry.records.map(toInspRelateInspRow));
    case "refAddressTypeGroup":
      return inferCommonAgencyIdRefAddressTypeGroup(entry.records.map(toRefAddressTypeGroupRow));
  }
}

const THEME_STORAGE_KEY = "importease-theme";

// Full category catalog (see category-catalog.md) so the "start new file"
// picker shows what's coming, not just what's built — Data Manager Version
// (tooling metadata, not editable config) and Workflow (confirmed
// view/pass-through only, never editable — see architecture-and-safety-
// update.md) are intentionally excluded, since neither is ever a "start
// blank and fill in" target.
const CATEGORY_OPTIONS: { value: string; label: string; available: boolean }[] = [
  { value: "standardChoice", label: "Standard Choice", available: true },
  { value: "sharedDropDown", label: "Shared Drop-down List", available: true },
  { value: "refAddressTypeGroup", label: "Ref Address Type Group", available: true },
  { value: "organizationAgency", label: "Organization/Agency", available: true },
  { value: "inspRelateInsp", label: "Insp Relate Insp", available: true },
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

function makeBlankSharedDropDownEntry(): SharedDropDownZipEntry {
  return {
    path: "SharedDropDownListModel.xml",
    kind: "sharedDropDown",
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

function makeBlankOrganizationAgencyEntry(): OrganizationAgencyZipEntry {
  return {
    path: "OrganizationAgencyModel.xml",
    kind: "organizationAgency",
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

function makeBlankInspRelateInspEntry(): InspRelateInspZipEntry {
  return {
    path: "InspRelateInspModel.xml",
    kind: "inspRelateInsp",
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

function makeBlankRefAddressTypeGroupEntry(): RefAddressTypeGroupZipEntry {
  return {
    path: "RefAddressTypeGroupModel.xml",
    kind: "refAddressTypeGroup",
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

// Fields the schema doc marks "always" on sharedDropDownListModel/
// sharedDropDownValue — required before export, same treatment as Standard
// Choice's Name/Value requirement.
function validateSharedDropDownEntries(entries: SharedDropDownZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toSharedDropDownRow(record);
      if (!row.name.trim()) {
        return `"${entry.path}" has a Shared Drop-down List with no Name set — every list needs a Name before export.`;
      }
      for (const valueNode of getSharedDropDownValueNodes(record)) {
        const valueRow = toSharedDropDownValueRow(valueNode);
        if (!valueRow.bizdomainValue.trim()) {
          return `"${entry.path}" — "${row.name || "(unnamed)"}" has a value with no Value set — every value needs a Value before export.`;
        }
      }
    }
  }
  return null;
}

function validateOrganizationAgencyEntries(entries: OrganizationAgencyZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toOrganizationAgencyRow(record);
      if (!row.agencyCode.trim()) {
        return `"${entry.path}" has an Organization/Agency row with no Agency Code set — every row needs an Agency Code before export.`;
      }
    }
  }
  return null;
}

function validateInspRelateInspEntries(entries: InspRelateInspZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toInspRelateInspRow(record);
      if (!row.type.trim()) {
        return `"${entry.path}" has an Insp Relate Insp row with no Type set — every row needs a Type before export.`;
      }
    }
  }
  return null;
}

function validateRefAddressTypeGroupEntries(entries: RefAddressTypeGroupZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toRefAddressTypeGroupRow(record);
      if (!row.addrGroup.trim()) {
        return `"${entry.path}" has an Address Type Group with no Address Group set — every group needs a name before export.`;
      }
      for (const typeNode of getRefAddressTypeNodes(record)) {
        const typeRow = toRefAddressTypeRow(typeNode);
        if (!typeRow.addrType.trim()) {
          return `"${entry.path}" — "${row.addrGroup}" has an address type with no Address Type set — every type needs one before export.`;
        }
      }
    }
  }
  return null;
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

// FlatGrid column config for the two truly-flat categories (see
// components/FlatGrid.tsx) — kept here, not in the lib modules, since it's
// purely a UI concern, same split StandardChoiceGrid/SharedDropDownGrid use.
const ORG_AGENCY_COLUMNS: FlatGridColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "agencyCode", headerName: "Agency Code", editable: true },
  { field: "agencyName", headerName: "Agency Name", editable: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
];

const INSP_RELATE_INSP_COLUMNS: FlatGridColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "type", headerName: "Type", editable: true },
  { field: "parentInspType", headerName: "Parent Insp Type", editable: true },
  { field: "childInspType", headerName: "Child Insp Type", editable: true },
  { field: "inspResult", headerName: "Insp Result", editable: true },
  { field: "inspResultGroup", headerName: "Result Group", editable: true },
  { field: "inAdvance", headerName: "In Advance", editable: true },
  { field: "intervalDay", headerName: "Interval Day", editable: true },
  { field: "isAuto", headerName: "Auto", editable: true },
  { field: "isRelated", headerName: "Related", editable: true },
  { field: "initDateType", headerName: "Init Date Type", editable: true },
  { field: "initStatus", headerName: "Init Status", editable: true },
  { field: "servProvCode", headerName: "Agency ID", editable: true, hide: true },
];

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
  const gridRef = useRef<GridHandle>(null);
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
    const firstEditable = result.entries.find(isEditableEntry);
    setActivePath(firstEditable?.path ?? null);
    setAgencyId(firstEditable ? inferAgencyIdForEntry(firstEditable) : "");
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
      const category = e.target.value;
      e.target.value = "";
      const blankEntry =
        category === "standardChoice"
          ? makeBlankStandardChoiceEntry()
          : category === "sharedDropDown"
            ? makeBlankSharedDropDownEntry()
            : category === "organizationAgency"
              ? makeBlankOrganizationAgencyEntry()
              : category === "inspRelateInsp"
                ? makeBlankInspRelateInspEntry()
                : category === "refAddressTypeGroup"
                  ? makeBlankRefAddressTypeGroupEntry()
                  : null;
      if (!blankEntry) return;
      if (
        zipResult &&
        !window.confirm("Start a new blank file? Unsaved changes in the current file will be lost.")
      ) {
        return;
      }
      setError(null);
      loadEntries({ zipName: "new-export.zip", entries: [blankEntry] });
    },
    [zipResult, loadEntries]
  );

  // Uploads/drops now merge into the current session rather than replacing
  // it (see mergeParseResults), so there needs to be an explicit way back
  // to a clean slate.
  const handleClear = useCallback(() => {
    if (
      zipResult &&
      !window.confirm("Clear this session? All data will be cleared and cannot be recovered.")
    ) {
      return;
    }
    setZipResult(null);
    setActivePath(null);
    setExportZipName("");
    setAgencyId("");
    setSensitiveDecisions({});
    setError(null);
  }, [zipResult]);

  const editableEntries = (zipResult?.entries.filter(isEditableEntry) ?? []) as EditableZipEntry[];
  const standardChoiceEntries = editableEntries.filter(
    (en): en is StandardChoiceZipEntry => en.kind === "standardChoice"
  );
  const sharedDropDownEntries = editableEntries.filter(
    (en): en is SharedDropDownZipEntry => en.kind === "sharedDropDown"
  );
  const organizationAgencyEntries = editableEntries.filter(
    (en): en is OrganizationAgencyZipEntry => en.kind === "organizationAgency"
  );
  const inspRelateInspEntries = editableEntries.filter(
    (en): en is InspRelateInspZipEntry => en.kind === "inspRelateInsp"
  );
  const refAddressTypeGroupEntries = editableEntries.filter(
    (en): en is RefAddressTypeGroupZipEntry => en.kind === "refAddressTypeGroup"
  );

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
    const validationError =
      validateStandardChoiceEntries(standardChoiceEntries) ??
      validateSharedDropDownEntries(sharedDropDownEntries) ??
      validateOrganizationAgencyEntries(organizationAgencyEntries) ??
      validateInspRelateInspEntries(inspRelateInspEntries) ??
      validateRefAddressTypeGroupEntries(refAddressTypeGroupEntries);
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
  }, [
    zipResult,
    exportZipName,
    agencyId,
    undecidedSensitive,
    sensitiveDecisions,
    standardChoiceEntries,
    sharedDropDownEntries,
    organizationAgencyEntries,
    inspRelateInspEntries,
    refAddressTypeGroupEntries,
  ]);

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

  const activeEntry = editableEntries.find((en) => en.path === activePath) ?? null;
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
          <button className="btn icon-btn" onClick={toggleTheme} title="Toggle light/dark mode">
            {theme === "dark" ? "☀" : "☾"}
          </button>
          ImportEase
        </div>

        <div className={`saved-badge${savedVisible ? " visible" : ""}`}>
          <span className="pulse-dot" />
          Saved in session
        </div>

        {/* 1 */}
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

        {/* 2 */}
        <button className="btn btn-danger" onClick={handleClear} disabled={!zipResult}>
          Clear
        </button>

        {zipResult && (
          <>
            {/* 3 */}
            <label className="field-label">
              Export as
              <input
                className="text-input"
                style={{ width: 220 }}
                value={exportZipName}
                onChange={(e) => setExportZipName(e.target.value)}
                placeholder="export.zip"
              />
            </label>

            {/* 4 */}
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

        {/* 5 */}
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

        {editableEntries.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {editableEntries.map((en) => (
              <button
                key={en.path}
                className="btn"
                onClick={() => {
                  setActivePath(en.path);
                  setAgencyId(inferAgencyIdForEntry(en));
                }}
                style={
                  en.path === activePath
                    ? { borderColor: "var(--accent-cyan-text)", color: "var(--accent-cyan-text)" }
                    : undefined
                }
              >
                {en.path}
              </button>
            ))}
          </div>
        )}

        {/* 6 */}
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={!zipResult || exporting || undecidedSensitive.length > 0}
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
                          m.tier === "credentials"
                            ? "var(--accent-danger-text)"
                            : "var(--accent-amber-text)",
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
          activeEntry.kind === "standardChoice" ? (
            <StandardChoiceGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "sharedDropDown" ? (
            <SharedDropDownGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "refAddressTypeGroup" ? (
            <RefAddressTypeGroupGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "organizationAgency" ? (
            <FlatGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
              columnMeta={ORG_AGENCY_COLUMNS}
              toRow={toOrganizationAgencyRow}
              setField={setOrganizationAgencyField}
              agencyIdField="serviceProviderCode"
              createNode={createOrganizationAgencyNode}
              nextRefIdNumber={nextRefIdNumberOrgAgency}
              findByUid={findOrganizationAgencyByUid}
              deleteNode={deleteOrganizationAgency}
              toolbarLabel="Organization/Agency"
              addButtonLabel="+ Add Agency"
            />
          ) : (
            <FlatGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
              columnMeta={INSP_RELATE_INSP_COLUMNS}
              toRow={toInspRelateInspRow}
              setField={setInspRelateInspField}
              agencyIdField="servProvCode"
              createNode={createInspRelateInspNode}
              nextRefIdNumber={nextRefIdNumberInspRelateInsp}
              findByUid={findInspRelateInspByUid}
              deleteNode={deleteInspRelateInsp}
              toolbarLabel="Insp Relate Insp"
              addButtonLabel="+ Add Rule"
            />
          )
        ) : (
          <div className="main-empty">
            {zipResult
              ? "No recognized editable file was found in this zip. Everything else will still be passed through untouched on export."
              : "Upload or drag in a Configuration Manager export .zip, or start a blank file above, to begin."}
          </div>
        )}
      </div>
    </div>
  );
}
