"use client";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { AgGridReact } from "ag-grid-react";
import type { CellValueChangedEvent, ColDef } from "ag-grid-community";
import {
  PNode,
  StandardChoiceRow,
  StandardChoiceValueRow,
  createStandardChoiceNode,
  createStandardChoiceValueNode,
  deleteStandardChoice,
  deleteStandardChoiceValue,
  findStandardChoiceByUid,
  findStandardChoiceValueByUid,
  getStandardChoiceValueNodes,
  nextRefIdNumber,
  setStandardChoiceField,
  setStandardChoiceValueField,
  toStandardChoiceRow,
  toStandardChoiceValueRow,
} from "@/lib/xml/standardChoice";

export interface StandardChoiceGridHandle {
  /** Cascades a new Agency ID to every standardChoice record (and their child values) in this file. */
  applyAgencyIdToAll: (value: string) => void;
}

interface Props {
  records: PNode[];
  onChange: () => void;
  gridThemeClass: string;
  agencyId: string;
}

interface ColumnMeta {
  field: string;
  headerName: string;
  editable: boolean;
  hide?: boolean;
}

// `hide: true` (not omitting the column) keeps these fields selectable/
// restorable later while matching Round 1's "hide, don't remove" ask — the
// underlying data (still required for re-serialization + the round-trip
// test) is untouched either way. Agency ID moved to a header-level field
// (see StandardChoiceGridHandle) so it's hidden here too.
const PARENT_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "name", headerName: "Name", editable: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "defaultValue", headerName: "Default Value", editable: true },
  { field: "description", headerName: "Description", editable: true },
  { field: "type", headerName: "Type", editable: true },
  { field: "valueSize", headerName: "Value Size", editable: true, hide: true },
  { field: "valueCount", headerName: "# Values", editable: false },
];

const PARENT_EDITABLE_FIELDS = PARENT_COLUMN_META.filter((c) => c.editable).map((c) => c.field);

const CHILD_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "value", headerName: "Value", editable: true },
  { field: "description", headerName: "Description", editable: true },
  { field: "sortOrder", headerName: "Sort Order", editable: true },
  { field: "sequenceNBR", headerName: "Sequence #", editable: true, hide: true },
  { field: "standardChoiceName", headerName: "Parent Name", editable: false, hide: true },
];

const CHILD_EDITABLE_FIELDS = CHILD_COLUMN_META.filter((c) => c.editable).map((c) => c.field);

// Column sizing is computed over the *entire* row dataset, not just what AG
// Grid currently has rendered — its own autoSizeAllColumns() only measures
// rendered rows, which under virtualization can leave a column too narrow
// for a longer value that scrolls into view later (visible truncation).
const CHAR_PX = 7.4;
const COL_PADDING = 34;
const COL_MIN = 70;
const COL_MAX = 640;

function widthForColumn(rows: any[], field: string, headerName: string): number {
  let maxLen = headerName.length;
  for (const r of rows) {
    const v = r[field];
    const len = v == null ? 0 : String(v).length;
    if (len > maxLen) maxLen = len;
  }
  return Math.min(COL_MAX, Math.max(COL_MIN, Math.round(maxLen * CHAR_PX) + COL_PADDING));
}

function buildColumnDefs<T extends { uid: string }>(meta: ColumnMeta[], rows: T[]): ColDef<T>[] {
  return meta.map((c) => ({
    field: c.field,
    headerName: c.headerName,
    editable: c.editable,
    hide: c.hide,
    resizable: true,
    width: c.hide ? undefined : widthForColumn(rows, c.field, c.headerName),
  })) as ColDef<T>[];
}

/**
 * AG Grid Community edition does not include the Range Selection / Clipboard
 * modules (those are Enterprise-only), so bulk Excel-style paste is
 * implemented by hand here instead of relying on a built-in grid feature.
 * Excel's own clipboard format for a copied range is tab-separated text,
 * which is what this parses — copying real cells from Excel and pasting
 * here works without any extra conversion step.
 */
interface PasteHandlerOpts<T extends { uid: string }> {
  gridApiRef: React.RefObject<any>;
  editableFields: string[];
  getRows: () => T[];
  setRows: (rows: T[]) => void;
  applyEdit: (uid: string, field: string, value: string) => T;
  createRow: () => T;
}

/** Splits pasted/dropped text into a grid of cells and writes it starting at (startRowIndex, startFieldIndex). */
function applyBlockToRows<T extends { uid: string }>(
  opts: PasteHandlerOpts<T>,
  text: string,
  startRowIndex: number,
  startFieldIndex: number
) {
  const lines = text.replace(/\r/g, "").split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  if (!lines.length) return;

  let currentRows = [...opts.getRows()];

  lines.forEach((line, i) => {
    // Tab-separated (Excel clipboard); fall back to comma-separated for a dropped .csv.
    const cells = line.includes("\t") ? line.split("\t") : line.split(",");
    const targetRowIndex = startRowIndex + i;
    let targetRow = currentRows[targetRowIndex];
    if (!targetRow) {
      targetRow = opts.createRow();
      currentRows = [...currentRows, targetRow];
    }
    cells.forEach((cellValue, j) => {
      const field = opts.editableFields[startFieldIndex + j];
      if (!field) return;
      targetRow = opts.applyEdit(targetRow.uid, field, cellValue.trim());
      currentRows = currentRows.map((r) => (r.uid === targetRow.uid ? targetRow : r));
    });
  });

  opts.setRows(currentRows);
}

// Not a React hook (no "use" prefix on purpose) — a plain factory called fresh
// on every render so it always closes over the latest row-state/callbacks.
// Wrapping this in useCallback with a shallow dep array would let it go stale
// across renders (e.g. after the selected parent row changes) since several
// of the closures below (getRows/applyEdit/createRow) are themselves
// recreated every render.
//
// A focused cell (if any) sets the paste target; with nothing focused —
// including an empty grid, or a click that landed outside any cell — it
// appends starting at the first editable column, so paste always does
// something useful rather than silently no-op'ing.
function createPasteHandler<T extends { uid: string }>(opts: PasteHandlerOpts<T>) {
  return (e: React.ClipboardEvent<HTMLDivElement>) => {
    const api = opts.gridApiRef.current?.api;
    if (api?.getEditingCells().length > 0) return; // let native single-cell paste happen

    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const focused = api?.getFocusedCell();
    const startFieldIndex = focused
      ? Math.max(0, opts.editableFields.indexOf(focused.column.getColId()))
      : 0;
    const startRowIndex = focused ? focused.rowIndex ?? 0 : opts.getRows().length;

    e.preventDefault();
    try {
      applyBlockToRows(opts, text, startRowIndex, startFieldIndex);
    } catch {
      window.alert("Select (or add) a Standard Choice row above before pasting values here.");
    }
  };
}

/**
 * Dropping a plain-text/CSV/TSV file onto the grid section appends its rows
 * the same way a paste would. A real .xlsx is a binary zip container, not
 * text — reading it as text would silently corrupt the data, so that case
 * is rejected with a message rather than attempted (parsing it properly
 * would need a new xlsx library, which isn't wired up yet).
 */
function createDropHandler<T extends { uid: string }>(opts: PasteHandlerOpts<T>) {
  return (e: React.DragEvent<HTMLDivElement>) => {
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    e.preventDefault();

    const looksBinaryExcel = /\.xlsx$|\.xls$/i.test(file.name);
    if (looksBinaryExcel) {
      window.alert(
        `"${file.name}" is an Excel workbook file — this only reads plain text/CSV drops. Open it in Excel, copy the cells, and paste them into the grid instead.`
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (!text.trim()) return;
      try {
        applyBlockToRows(opts, text, opts.getRows().length, 0);
      } catch {
        window.alert("Select (or add) a Standard Choice row above before dropping values here.");
      }
    };
    reader.readAsText(file);
  };
}

// Panel sizing constants — kept explicit (rather than reading Quartz theme
// defaults) so the "fit the last row" math is exact rather than guessed.
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 38;
const PANEL_CHROME = 74; // toolbar + panel padding/border
const MIN_PANEL_PX = 160;
const HANDLE_PX = 14;

function naturalPanelHeight(rowCount: number): number {
  return PANEL_CHROME + HEADER_HEIGHT + Math.max(rowCount, 1) * ROW_HEIGHT;
}

const StandardChoiceGrid = forwardRef<StandardChoiceGridHandle, Props>(function StandardChoiceGrid(
  { records, onChange, gridThemeClass, agencyId },
  ref
) {
  const [parentRows, setParentRows] = useState<StandardChoiceRow[]>(() =>
    records.map(toStandardChoiceRow)
  );
  const [selectedUid, setSelectedUid] = useState<string | null>(parentRows[0]?.uid ?? null);

  const selectedNode = useMemo(
    () => (selectedUid ? findStandardChoiceByUid(records, selectedUid) ?? null : null),
    [records, selectedUid]
  );

  const [childRows, setChildRows] = useState<StandardChoiceValueRow[]>(() =>
    selectedNode ? getStandardChoiceValueNodes(selectedNode).map(toStandardChoiceValueRow) : []
  );

  const parentGridRef = useRef<AgGridReact<StandardChoiceRow>>(null);
  const childGridRef = useRef<AgGridReact<StandardChoiceValueRow>>(null);
  const pendingParentFocusUid = useRef<string | null>(null);
  const pendingChildFocusUid = useRef<string | null>(null);

  // --- Top-panel auto-fit + drag-resize -------------------------------
  const stackRef = useRef<HTMLDivElement>(null);
  const [topPanelHeight, setTopPanelHeight] = useState<number | null>(null);
  const userResizedRef = useRef(false);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const recomputeTopHeight = useCallback(() => {
    if (userResizedRef.current) return;
    const stack = stackRef.current;
    const available = stack ? stack.clientHeight : 700;
    const cap = Math.max(MIN_PANEL_PX, available - HANDLE_PX - MIN_PANEL_PX);
    const soft = Math.max(MIN_PANEL_PX, available * 0.7);
    setTopPanelHeight(Math.min(naturalPanelHeight(parentRows.length), soft, cap));
  }, [parentRows.length]);

  useEffect(() => {
    recomputeTopHeight();
  }, [recomputeTopHeight]);

  useEffect(() => {
    const onResize = () => recomputeTopHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recomputeTopHeight]);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: topPanelHeight ?? 240 };
    document.body.classList.add("resizing-panels");

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      const stack = stackRef.current;
      if (!drag || !stack) return;
      const available = stack.clientHeight;
      const delta = ev.clientY - drag.startY;
      const next = Math.min(
        Math.max(drag.startHeight + delta, MIN_PANEL_PX),
        Math.max(MIN_PANEL_PX, available - HANDLE_PX - MIN_PANEL_PX)
      );
      userResizedRef.current = true;
      setTopPanelHeight(next);
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.classList.remove("resizing-panels");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [topPanelHeight]);

  // --- Column defs (recomputed over the full dataset, not just what's rendered) ---
  const parentColumnDefs = useMemo(
    () => buildColumnDefs<StandardChoiceRow>(PARENT_COLUMN_META, parentRows),
    [parentRows]
  );
  const childColumnDefs = useMemo(
    () => buildColumnDefs<StandardChoiceValueRow>(CHILD_COLUMN_META, childRows),
    [childRows]
  );

  useEffect(() => {
    const uid = pendingParentFocusUid.current;
    pendingParentFocusUid.current = null;
    if (!uid) return;
    const api = parentGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "name");
    }
  }, [parentRows]);

  useEffect(() => {
    const uid = pendingChildFocusUid.current;
    pendingChildFocusUid.current = null;
    if (!uid) return;
    const api = childGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "value");
    }
  }, [childRows]);

  const refreshChildRows = useCallback((node: PNode | null) => {
    setChildRows(node ? getStandardChoiceValueNodes(node).map(toStandardChoiceValueRow) : []);
  }, []);

  const refreshParentRow = useCallback((node: PNode) => {
    const updated = toStandardChoiceRow(node);
    setParentRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
  }, []);

  const flashRow = useCallback((api: any, uid: string, field: string) => {
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) api.flashCells({ rowNodes: [rowNode], columns: [field] });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      applyAgencyIdToAll: (value: string) => {
        for (const node of records) {
          setStandardChoiceField(node, "serviceProviderCode", value);
          for (const valueNode of getStandardChoiceValueNodes(node)) {
            setStandardChoiceValueField(valueNode, "serviceProviderCode", value);
          }
        }
        setParentRows(records.map(toStandardChoiceRow));
        if (selectedNode) refreshChildRows(selectedNode);
        onChange();
      },
    }),
    [records, selectedNode, refreshChildRows, onChange]
  );

  const onSelectionChanged = useCallback(() => {
    const selected = parentGridRef.current?.api.getSelectedRows() ?? [];
    const uid = selected[0]?.uid ?? null;
    setSelectedUid(uid);
    const node = uid ? findStandardChoiceByUid(records, uid) : null;
    refreshChildRows(node ?? null);
  }, [records, refreshChildRows]);

  const onParentCellValueChanged = useCallback(
    (e: CellValueChangedEvent<StandardChoiceRow>) => {
      const node = findStandardChoiceByUid(records, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setStandardChoiceField(node, field, String(e.newValue ?? ""));
      refreshParentRow(node);
      if (field === "name" && selectedUid === e.data.uid) {
        refreshChildRows(node);
      }
      flashRow(parentGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [records, selectedUid, refreshChildRows, refreshParentRow, flashRow, onChange]
  );

  const onChildCellValueChanged = useCallback(
    (e: CellValueChangedEvent<StandardChoiceValueRow>) => {
      if (!selectedNode) return;
      const node = findStandardChoiceValueByUid(selectedNode, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setStandardChoiceValueField(node, field, String(e.newValue ?? ""));
      const updated = toStandardChoiceValueRow(node);
      setChildRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
      flashRow(childGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [selectedNode, flashRow, onChange]
  );

  const addParentRow = useCallback(() => {
    const num = nextRefIdNumber(records, "StandardChoiceModel");
    const node = createStandardChoiceNode(num, agencyId);
    records.push(node);
    const row = toStandardChoiceRow(node);
    pendingParentFocusUid.current = row.uid;
    setParentRows((prev) => [...prev, row]);
    onChange();
  }, [records, agencyId, onChange]);

  const deleteSelectedParentRows = useCallback(() => {
    const selected = (parentGridRef.current?.api.getSelectedRows() ?? []) as StandardChoiceRow[];
    for (const row of selected) {
      const node = findStandardChoiceByUid(records, row.uid);
      if (node) deleteStandardChoice(records, node);
    }
    const deletedUids = new Set(selected.map((r) => r.uid));
    setParentRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
    if (selectedUid && deletedUids.has(selectedUid)) {
      setSelectedUid(null);
      setChildRows([]);
    }
    onChange();
  }, [records, selectedUid, onChange]);

  const addChildRow = useCallback(() => {
    if (!selectedNode) return;
    const num = nextRefIdNumber(records, "StandardChoiceValueModel");
    const parentRow = toStandardChoiceRow(selectedNode);
    const node = createStandardChoiceValueNode(num, parentRow.name, parentRow.serviceProviderCode);
    getStandardChoiceValueNodes(selectedNode).push(node);
    const row = toStandardChoiceValueRow(node);
    pendingChildFocusUid.current = row.uid;
    setChildRows((prev) => [...prev, row]);
    refreshParentRow(selectedNode);
    onChange();
  }, [records, selectedNode, refreshParentRow, onChange]);

  const deleteSelectedChildRows = useCallback(() => {
    if (!selectedNode) return;
    const selected = (childGridRef.current?.api.getSelectedRows() ??
      []) as StandardChoiceValueRow[];
    for (const row of selected) {
      const node = findStandardChoiceValueByUid(selectedNode, row.uid);
      if (node) deleteStandardChoiceValue(selectedNode, node);
    }
    refreshChildRows(selectedNode);
    refreshParentRow(selectedNode);
    onChange();
  }, [selectedNode, refreshChildRows, refreshParentRow, onChange]);

  const parentApplyEdit = useCallback(
    (uid: string, field: string, value: string) => {
      const node = findStandardChoiceByUid(records, uid);
      if (!node) throw new Error("row not found");
      setStandardChoiceField(node, field, value);
      if (field === "name" && selectedUid === uid) refreshChildRows(node);
      return toStandardChoiceRow(node);
    },
    [records, selectedUid, refreshChildRows]
  );

  const parentCreateRow = useCallback(() => {
    const num = nextRefIdNumber(records, "StandardChoiceModel");
    const node = createStandardChoiceNode(num, agencyId);
    records.push(node);
    return toStandardChoiceRow(node);
  }, [records, agencyId]);

  const parentPasteOpts: PasteHandlerOpts<StandardChoiceRow> = {
    gridApiRef: parentGridRef,
    editableFields: PARENT_EDITABLE_FIELDS,
    getRows: () => parentRows,
    setRows: (rows) => {
      setParentRows(rows);
      onChange();
    },
    applyEdit: parentApplyEdit,
    createRow: parentCreateRow,
  };
  const handleParentPaste = createPasteHandler(parentPasteOpts);
  const handleParentDrop = createDropHandler(parentPasteOpts);

  const childApplyEdit = useCallback(
    (uid: string, field: string, value: string) => {
      if (!selectedNode) throw new Error("no parent selected");
      const node = findStandardChoiceValueByUid(selectedNode, uid);
      if (!node) throw new Error("row not found");
      setStandardChoiceValueField(node, field, value);
      return toStandardChoiceValueRow(node);
    },
    [selectedNode]
  );

  const childCreateRow = useCallback(() => {
    if (!selectedNode) throw new Error("no parent selected");
    const num = nextRefIdNumber(records, "StandardChoiceValueModel");
    const parentRow = toStandardChoiceRow(selectedNode);
    const node = createStandardChoiceValueNode(num, parentRow.name, parentRow.serviceProviderCode);
    getStandardChoiceValueNodes(selectedNode).push(node);
    return toStandardChoiceValueRow(node);
  }, [records, selectedNode]);

  const childPasteOpts: PasteHandlerOpts<StandardChoiceValueRow> = {
    gridApiRef: childGridRef,
    editableFields: CHILD_EDITABLE_FIELDS,
    getRows: () => childRows,
    setRows: (rows) => {
      setChildRows(rows);
      if (selectedNode) refreshParentRow(selectedNode);
      onChange();
    },
    applyEdit: childApplyEdit,
    createRow: childCreateRow,
  };
  const handleChildPaste = createPasteHandler(childPasteOpts);
  const handleChildDrop = createDropHandler(childPasteOpts);

  return (
    <div className="grid-stack" ref={stackRef}>
      <div
        className="grid-panel"
        style={{ flex: "0 0 auto", height: topPanelHeight ?? undefined, minHeight: MIN_PANEL_PX }}
      >
        <div className="grid-toolbar">
          <button className="btn" onClick={addParentRow}>
            + Add Standard Choice
          </button>
          <button className="btn btn-danger" onClick={deleteSelectedParentRows}>
            Delete Selected
          </button>
          <span className="grid-toolbar-label">Standard Choices ({parentRows.length})</span>
        </div>
        <div
          className={gridThemeClass}
          style={{ flex: 1, width: "100%", minHeight: 0 }}
          onPaste={handleParentPaste}
          onDrop={handleParentDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <AgGridReact<StandardChoiceRow>
            ref={parentGridRef}
            rowData={parentRows}
            columnDefs={parentColumnDefs}
            rowHeight={ROW_HEIGHT}
            headerHeight={HEADER_HEIGHT}
            getRowId={(p) => p.data.uid}
            rowSelection="single"
            onSelectionChanged={onSelectionChanged}
            onCellValueChanged={onParentCellValueChanged}
            stopEditingWhenCellsLoseFocus
          />
        </div>
      </div>

      <div className="resize-handle" onMouseDown={onHandleMouseDown} title="Drag to resize" />

      <div className="grid-panel" style={{ flex: 1, minHeight: MIN_PANEL_PX }}>
        <div className="grid-toolbar">
          <button className="btn" onClick={addChildRow} disabled={!selectedNode}>
            + Add Value
          </button>
          <button className="btn btn-danger" onClick={deleteSelectedChildRows} disabled={!selectedNode}>
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {selectedNode
              ? `Values for "${toStandardChoiceRow(selectedNode).name || "(unnamed)"}" (${childRows.length})`
              : "Select a Standard Choice above to see its values"}
          </span>
        </div>
        <div
          className={gridThemeClass}
          style={{ flex: 1, width: "100%", minHeight: 0 }}
          onPaste={handleChildPaste}
          onDrop={handleChildDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <AgGridReact<StandardChoiceValueRow>
            ref={childGridRef}
            rowData={childRows}
            columnDefs={childColumnDefs}
            rowHeight={ROW_HEIGHT}
            headerHeight={HEADER_HEIGHT}
            getRowId={(p) => p.data.uid}
            rowSelection="multiple"
            onCellValueChanged={onChildCellValueChanged}
            stopEditingWhenCellsLoseFocus
          />
        </div>
      </div>
    </div>
  );
});

export default StandardChoiceGrid;
