"use client";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { useCallback, useMemo, useRef, useState } from "react";
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
  getNodeRefId,
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
}

const PARENT_COLUMNS: ColDef<StandardChoiceRow>[] = [
  { field: "refId", headerName: "Ref ID", editable: false, width: 170, pinned: "left" },
  { field: "name", editable: true, flex: 1, minWidth: 200 },
  { field: "serviceProviderCode", headerName: "Service Provider", editable: true, width: 160 },
  { field: "defaultValue", headerName: "Default Value", editable: true, width: 140 },
  { field: "description", editable: true, flex: 1, minWidth: 200 },
  { field: "type", editable: true, width: 130 },
  { field: "valueSize", headerName: "Value Size", editable: true, width: 110 },
  { field: "valueCount", headerName: "# Values", editable: false, width: 100 },
];

const PARENT_EDITABLE_FIELDS = PARENT_COLUMNS.filter((c) => c.editable).map(
  (c) => c.field as string
);

const CHILD_COLUMNS: ColDef<StandardChoiceValueRow>[] = [
  { field: "refId", headerName: "Ref ID", editable: false, width: 170, pinned: "left" },
  { field: "value", editable: true, flex: 1, minWidth: 200 },
  { field: "description", editable: true, flex: 1, minWidth: 200 },
  { field: "sortOrder", headerName: "Sort Order", editable: true, width: 110 },
  { field: "sequenceNBR", headerName: "Sequence #", editable: true, width: 130 },
  { field: "standardChoiceName", headerName: "Parent Name", editable: false, flex: 1, minWidth: 160 },
];

const CHILD_EDITABLE_FIELDS = CHILD_COLUMNS.filter((c) => c.editable).map(
  (c) => c.field as string
);

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
function createPasteHandler<T extends { refId: string }>(opts: {
  gridApiRef: React.RefObject<any>;
  editableFields: string[];
  getRows: () => T[];
  setRows: (rows: T[]) => void;
  applyEdit: (refId: string, field: string, value: string) => T;
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
        targetRow = opts.applyEdit(targetRow.refId, field, cellValue);
        currentRows = currentRows.map((r) => (r.refId === targetRow.refId ? targetRow : r));
      });
    });

    opts.setRows(currentRows);
  };
}

export default function StandardChoiceGrid({ records, onChange }: Props) {
  const [parentRows, setParentRows] = useState<StandardChoiceRow[]>(() =>
    records.map(toStandardChoiceRow)
  );
  const [selectedRefId, setSelectedRefId] = useState<string | null>(
    records[0] ? getNodeRefId(records[0]) : null
  );

  const selectedNode = useMemo(
    () => records.find((r) => getNodeRefId(r) === selectedRefId) ?? null,
    [records, selectedRefId]
  );

  const [childRows, setChildRows] = useState<StandardChoiceValueRow[]>(() =>
    selectedNode ? getStandardChoiceValueNodes(selectedNode).map(toStandardChoiceValueRow) : []
  );

  const parentGridRef = useRef<AgGridReact<StandardChoiceRow>>(null);
  const childGridRef = useRef<AgGridReact<StandardChoiceValueRow>>(null);

  const refreshChildRows = useCallback((node: PNode | null) => {
    setChildRows(node ? getStandardChoiceValueNodes(node).map(toStandardChoiceValueRow) : []);
  }, []);

  const refreshParentRow = useCallback(
    (node: PNode) => {
      const updated = toStandardChoiceRow(node);
      setParentRows((prev) => prev.map((r) => (r.refId === updated.refId ? updated : r)));
    },
    []
  );

  const onSelectionChanged = useCallback(() => {
    const selected = parentGridRef.current?.api.getSelectedRows() ?? [];
    const refId = selected[0]?.refId ?? null;
    setSelectedRefId(refId);
    const node = records.find((r) => getNodeRefId(r) === refId) ?? null;
    refreshChildRows(node);
  }, [records, refreshChildRows]);

  const onParentCellValueChanged = useCallback(
    (e: CellValueChangedEvent<StandardChoiceRow>) => {
      const node = records.find((r) => getNodeRefId(r) === e.data.refId);
      if (!node) return;
      const field = e.colDef.field as string;
      setStandardChoiceField(node, field, String(e.newValue ?? ""));
      refreshParentRow(node);
      if (field === "name" && selectedRefId === e.data.refId) {
        refreshChildRows(node);
      }
      onChange();
    },
    [records, selectedRefId, refreshChildRows, refreshParentRow, onChange]
  );

  const onChildCellValueChanged = useCallback(
    (e: CellValueChangedEvent<StandardChoiceValueRow>) => {
      if (!selectedNode) return;
      const node = getStandardChoiceValueNodes(selectedNode).find(
        (n) => getNodeRefId(n) === e.data.refId
      );
      if (!node) return;
      const field = e.colDef.field as string;
      setStandardChoiceValueField(node, field, String(e.newValue ?? ""));
      const updated = toStandardChoiceValueRow(node);
      setChildRows((prev) => prev.map((r) => (r.refId === updated.refId ? updated : r)));
      onChange();
    },
    [selectedNode, onChange]
  );

  const addParentRow = useCallback(() => {
    const num = nextRefIdNumber(records, "StandardChoiceModel");
    const node = createStandardChoiceNode(num);
    records.push(node);
    setParentRows((prev) => [...prev, toStandardChoiceRow(node)]);
    onChange();
  }, [records, onChange]);

  const deleteSelectedParentRows = useCallback(() => {
    const selected = (parentGridRef.current?.api.getSelectedRows() ?? []) as StandardChoiceRow[];
    for (const row of selected) deleteStandardChoice(records, row.refId);
    const remaining = new Set(records.map(getNodeRefId));
    setParentRows((prev) => prev.filter((r) => remaining.has(r.refId)));
    if (selectedRefId && !remaining.has(selectedRefId)) {
      setSelectedRefId(null);
      setChildRows([]);
    }
    onChange();
  }, [records, selectedRefId, onChange]);

  const addChildRow = useCallback(() => {
    if (!selectedNode) return;
    const num = nextRefIdNumber(records, "StandardChoiceValueModel");
    const parentName = toStandardChoiceRow(selectedNode).name;
    const node = createStandardChoiceValueNode(num, parentName);
    getStandardChoiceValueNodes(selectedNode).push(node);
    setChildRows((prev) => [...prev, toStandardChoiceValueRow(node)]);
    refreshParentRow(selectedNode);
    onChange();
  }, [records, selectedNode, refreshParentRow, onChange]);

  const deleteSelectedChildRows = useCallback(() => {
    if (!selectedNode) return;
    const selected = (childGridRef.current?.api.getSelectedRows() ??
      []) as StandardChoiceValueRow[];
    for (const row of selected) deleteStandardChoiceValue(selectedNode, row.refId);
    refreshChildRows(selectedNode);
    refreshParentRow(selectedNode);
    onChange();
  }, [selectedNode, refreshChildRows, refreshParentRow, onChange]);

  const parentApplyEdit = useCallback(
    (refId: string, field: string, value: string) => {
      const node = records.find((r) => getNodeRefId(r) === refId);
      if (!node) throw new Error("row not found");
      setStandardChoiceField(node, field, value);
      if (field === "name" && selectedRefId === refId) refreshChildRows(node);
      return toStandardChoiceRow(node);
    },
    [records, selectedRefId, refreshChildRows]
  );

  const parentCreateRow = useCallback(() => {
    const num = nextRefIdNumber(records, "StandardChoiceModel");
    const node = createStandardChoiceNode(num);
    records.push(node);
    return toStandardChoiceRow(node);
  }, [records]);

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
    (refId: string, field: string, value: string) => {
      if (!selectedNode) throw new Error("no parent selected");
      const node = getStandardChoiceValueNodes(selectedNode).find(
        (n) => getNodeRefId(n) === refId
      );
      if (!node) throw new Error("row not found");
      setStandardChoiceValueField(node, field, value);
      return toStandardChoiceValueRow(node);
    },
    [selectedNode]
  );

  const childCreateRow = useCallback(() => {
    if (!selectedNode) throw new Error("no parent selected");
    const num = nextRefIdNumber(records, "StandardChoiceValueModel");
    const parentName = toStandardChoiceRow(selectedNode).name;
    const node = createStandardChoiceValueNode(num, parentName);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={addParentRow}>+ Add Standard Choice</button>
          <button onClick={deleteSelectedParentRows}>Delete Selected</button>
          <span style={{ alignSelf: "center", color: "#666", fontSize: 13 }}>
            Standard Choices ({parentRows.length})
          </span>
        </div>
        <div
          className="ag-theme-quartz"
          style={{ height: 320, width: "100%" }}
          onPaste={handleParentPaste}
        >
          <AgGridReact<StandardChoiceRow>
            ref={parentGridRef}
            rowData={parentRows}
            columnDefs={PARENT_COLUMNS}
            getRowId={(p) => p.data.refId}
            rowSelection="single"
            onSelectionChanged={onSelectionChanged}
            onCellValueChanged={onParentCellValueChanged}
            stopEditingWhenCellsLoseFocus
          />
        </div>
      </div>

      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={addChildRow} disabled={!selectedNode}>
            + Add Value
          </button>
          <button onClick={deleteSelectedChildRows} disabled={!selectedNode}>
            Delete Selected
          </button>
          <span style={{ alignSelf: "center", color: "#666", fontSize: 13 }}>
            {selectedNode
              ? `Values for "${toStandardChoiceRow(selectedNode).name}" (${childRows.length})`
              : "Select a Standard Choice above to see its values"}
          </span>
        </div>
        <div
          className="ag-theme-quartz"
          style={{ height: 320, width: "100%" }}
          onPaste={handleChildPaste}
        >
          <AgGridReact<StandardChoiceValueRow>
            ref={childGridRef}
            rowData={childRows}
            columnDefs={CHILD_COLUMNS}
            getRowId={(p) => p.data.refId}
            rowSelection="multiple"
            onCellValueChanged={onChildCellValueChanged}
            stopEditingWhenCellsLoseFocus
          />
        </div>
      </div>
    </div>
  );
}
