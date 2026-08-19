"use client";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface Props {
  records: PNode[];
  onChange: () => void;
  gridThemeClass: string;
}

// `hide: true` (not omitting the column) keeps these fields selectable/
// restorable later while matching Round 1's "hide, don't remove" ask — the
// underlying data (still required for re-serialization + the round-trip
// test) is untouched either way.
const PARENT_COLUMNS: ColDef<StandardChoiceRow>[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "name", headerName: "Name", editable: true, minWidth: 160 },
  // Renamed for display only — the underlying/XML field stays
  // `serviceProviderCode`, since that's Accela's actual schema tag name.
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, minWidth: 130 },
  { field: "defaultValue", headerName: "Default Value", editable: true, minWidth: 130 },
  { field: "description", headerName: "Description", editable: true, minWidth: 160 },
  { field: "type", headerName: "Type", editable: true, minWidth: 110 },
  { field: "valueSize", headerName: "Value Size", editable: true, hide: true },
  { field: "valueCount", headerName: "# Values", editable: false, minWidth: 90 },
];

const PARENT_EDITABLE_FIELDS = PARENT_COLUMNS.filter((c) => c.editable).map(
  (c) => c.field as string
);

const CHILD_COLUMNS: ColDef<StandardChoiceValueRow>[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "value", headerName: "Value", editable: true, minWidth: 160 },
  { field: "description", headerName: "Description", editable: true, minWidth: 160 },
  { field: "sortOrder", headerName: "Sort Order", editable: true, minWidth: 110 },
  { field: "sequenceNBR", headerName: "Sequence #", editable: true, hide: true },
  { field: "standardChoiceName", headerName: "Parent Name", editable: false, hide: true },
];

const CHILD_EDITABLE_FIELDS = CHILD_COLUMNS.filter((c) => c.editable).map(
  (c) => c.field as string
);

/** Most common non-empty Agency ID among existing rows — used to auto-populate new rows. */
function inferCommonAgencyId(rows: StandardChoiceRow[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r.serviceProviderCode.trim();
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

/**
 * AG Grid Community edition does not include the Range Selection / Clipboard
 * modules (those are Enterprise-only), so bulk Excel-style paste is
 * implemented by hand here instead of relying on a built-in grid feature.
 * A cell must be focused (not necessarily selected as a range) for a paste
 * to be picked up; pasting extends the grid with new rows if the pasted
 * block runs past the current row count.
 */
// Not a React hook (no "use" prefix on purpose) — a plain factory called fresh
// on every render so it always closes over the latest row-state/callbacks.
// Wrapping this in useCallback with a shallow dep array would let it go stale
// across renders (e.g. after the selected parent row changes) since several
// of the closures below (getRows/applyEdit/createRow) are themselves
// recreated every render.
function createPasteHandler<T extends { uid: string }>(opts: {
  gridApiRef: React.RefObject<any>;
  editableFields: string[];
  getRows: () => T[];
  setRows: (rows: T[]) => void;
  applyEdit: (uid: string, field: string, value: string) => T;
  createRow: () => T;
}) {
  return (e: React.ClipboardEvent<HTMLDivElement>) => {
    const api = opts.gridApiRef.current?.api;
    if (!api) return;
    if (api.getEditingCells().length > 0) return; // let native single-cell paste happen

    const focused = api.getFocusedCell();
    if (!focused) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const startFieldIndex = opts.editableFields.indexOf(focused.column.getColId());
    if (startFieldIndex === -1) return;

    e.preventDefault();

    const lines = text.replace(/\r/g, "").split("\n");
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    if (!lines.length) return;

    let currentRows = [...opts.getRows()];
    const startRowIndex = focused.rowIndex ?? 0;

    lines.forEach((line, i) => {
      const cells = line.split("\t");
      const targetRowIndex = startRowIndex + i;
      let targetRow = currentRows[targetRowIndex];
      if (!targetRow) {
        targetRow = opts.createRow();
        currentRows = [...currentRows, targetRow];
      }
      cells.forEach((cellValue, j) => {
        const field = opts.editableFields[startFieldIndex + j];
        if (!field) return;
        targetRow = opts.applyEdit(targetRow.uid, field, cellValue);
        currentRows = currentRows.map((r) => (r.uid === targetRow.uid ? targetRow : r));
      });
    });

    opts.setRows(currentRows);
  };
}

export default function StandardChoiceGrid({ records, onChange, gridThemeClass }: Props) {
  const [parentRows, setParentRows] = useState<StandardChoiceRow[]>(() =>
    records.map(toStandardChoiceRow)
  );
  const [selectedUid, setSelectedUid] = useState<string | null>(
    parentRows[0]?.uid ?? null
  );

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

  useEffect(() => {
    parentGridRef.current?.api?.autoSizeAllColumns();
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
    childGridRef.current?.api?.autoSizeAllColumns();
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
    const node = createStandardChoiceNode(num, inferCommonAgencyId(parentRows));
    records.push(node);
    const row = toStandardChoiceRow(node);
    pendingParentFocusUid.current = row.uid;
    setParentRows((prev) => [...prev, row]);
    onChange();
  }, [records, parentRows, onChange]);

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
    const node = createStandardChoiceNode(num, inferCommonAgencyId(parentRows));
    records.push(node);
    return toStandardChoiceRow(node);
  }, [records, parentRows]);

  const handleParentPaste = createPasteHandler<StandardChoiceRow>({
    gridApiRef: parentGridRef,
    editableFields: PARENT_EDITABLE_FIELDS,
    getRows: () => parentRows,
    setRows: (rows) => {
      setParentRows(rows);
      onChange();
    },
    applyEdit: parentApplyEdit,
    createRow: parentCreateRow,
  });

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

  const handleChildPaste = createPasteHandler<StandardChoiceValueRow>({
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
  });

  return (
    <div className="grid-stack">
      <div className="grid-panel">
        <div className="grid-toolbar">
          <button className="btn" onClick={addParentRow}>
            + Add Standard Choice
          </button>
          <button className="btn btn-danger" onClick={deleteSelectedParentRows}>
            Delete Selected
          </button>
          <span className="grid-toolbar-label">Standard Choices ({parentRows.length})</span>
        </div>
        <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }} onPaste={handleParentPaste}>
          <AgGridReact<StandardChoiceRow>
            ref={parentGridRef}
            rowData={parentRows}
            columnDefs={PARENT_COLUMNS}
            getRowId={(p) => p.data.uid}
            rowSelection="single"
            onSelectionChanged={onSelectionChanged}
            onCellValueChanged={onParentCellValueChanged}
            onFirstDataRendered={(e) => e.api.autoSizeAllColumns()}
            stopEditingWhenCellsLoseFocus
          />
        </div>
      </div>

      <div className="grid-panel">
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
        <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }} onPaste={handleChildPaste}>
          <AgGridReact<StandardChoiceValueRow>
            ref={childGridRef}
            rowData={childRows}
            columnDefs={CHILD_COLUMNS}
            getRowId={(p) => p.data.uid}
            rowSelection="multiple"
            onCellValueChanged={onChildCellValueChanged}
            onFirstDataRendered={(e) => e.api.autoSizeAllColumns()}
            stopEditingWhenCellsLoseFocus
          />
        </div>
      </div>
    </div>
  );
}
