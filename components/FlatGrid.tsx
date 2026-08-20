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
import type { PNode } from "@/lib/xml/pnode";

export interface FlatGridHandle {
  applyAgencyIdToAll: (value: string) => void;
}

export interface FlatGridColumnMeta {
  field: string;
  headerName: string;
  editable: boolean;
  hide?: boolean;
}

/** Row shape every flat category's projection satisfies — see toStandardChoiceRow-
 * style functions in each lib/xml/*.ts module. Kept as a plain (non-generic)
 * interface rather than a type parameter on the component: forwardRef +
 * generics needs a manual cast that's easy to get subtly wrong without a
 * local TS compiler to check it against, and every real field this grid
 * displays is a plain string anyway. */
export interface FlatGridRow {
  uid: string;
  refId: string;
  [field: string]: string;
}

/**
 * Reusable single-grid editor for the "flat" categories — one record per
 * row, no repeating child list (Organization/Agency, Insp Relate Insp; see
 * full-schema-reference.md for which categories fit this shape vs. the
 * parent/child shape StandardChoiceGrid/SharedDropDownGrid use). Two data
 * points (StandardChoice, SharedDropDown) weren't enough to justify
 * generalizing the parent/child grids yet, but two *flat* categories
 * sharing the exact same UI shape — one grid, add/delete/paste, an Agency
 * ID cascade — is exactly the "three similar lines" threshold, so this one
 * is parameterized instead of copy-pasted a second time.
 */
interface Props {
  records: PNode[];
  onChange: () => void;
  gridThemeClass: string;
  agencyId: string;
  columnMeta: FlatGridColumnMeta[];
  toRow: (node: PNode) => FlatGridRow;
  setField: (node: PNode, field: string, value: string) => void;
  agencyIdField: string;
  createNode: (refIdNum: number, agencyId: string) => PNode;
  nextRefIdNumber: (records: PNode[]) => number;
  findByUid: (records: PNode[], uid: string) => PNode | undefined;
  deleteNode: (records: PNode[], node: PNode) => void;
  toolbarLabel: string;
  addButtonLabel: string;
}

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

function buildColumnDefs(meta: FlatGridColumnMeta[], rows: FlatGridRow[]): ColDef<FlatGridRow>[] {
  return meta.map((c) => ({
    field: c.field,
    headerName: c.headerName,
    editable: c.editable,
    hide: c.hide,
    resizable: true,
    width: c.hide ? undefined : widthForColumn(rows, c.field, c.headerName),
  })) as ColDef<FlatGridRow>[];
}

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 38;

const FlatGrid = forwardRef<FlatGridHandle, Props>(function FlatGrid(
  {
    records,
    onChange,
    gridThemeClass,
    agencyId,
    columnMeta,
    toRow,
    setField,
    agencyIdField,
    createNode,
    nextRefIdNumber,
    findByUid,
    deleteNode,
    toolbarLabel,
    addButtonLabel,
  },
  ref
) {
  const [rows, setRows] = useState<FlatGridRow[]>(() => records.map(toRow));
  const gridRef = useRef<AgGridReact<FlatGridRow>>(null);
  const pendingFocusUid = useRef<string | null>(null);

  const columnDefs = useMemo(() => buildColumnDefs(columnMeta, rows), [columnMeta, rows]);
  const editableFields = useMemo(() => columnMeta.filter((c) => c.editable).map((c) => c.field), [
    columnMeta,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      applyAgencyIdToAll: (value: string) => {
        for (const node of records) {
          setField(node, agencyIdField, value);
        }
        setRows(records.map(toRow));
        onChange();
      },
    }),
    [records, setField, agencyIdField, toRow, onChange]
  );

  useEffect(() => {
    const uid = pendingFocusUid.current;
    pendingFocusUid.current = null;
    if (!uid) return;
    const api = gridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      const firstEditable = columnMeta.find((c) => c.editable)?.field;
      if (rowNode.rowIndex != null && firstEditable) {
        api.setFocusedCell(rowNode.rowIndex, firstEditable);
      }
    }
  }, [rows, columnMeta]);

  const flashRow = useCallback((uid: string, field: string) => {
    const api = gridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) api.flashCells({ rowNodes: [rowNode], columns: [field] });
  }, []);

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<FlatGridRow>) => {
      const node = findByUid(records, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setField(node, field, String(e.newValue ?? ""));
      setRows((prev) => prev.map((r) => (r.uid === e.data.uid ? toRow(node) : r)));
      flashRow(e.data.uid, field);
      onChange();
    },
    [records, findByUid, setField, toRow, flashRow, onChange]
  );

  const addRow = useCallback(() => {
    const num = nextRefIdNumber(records);
    const node = createNode(num, agencyId);
    records.push(node);
    const row = toRow(node);
    pendingFocusUid.current = row.uid;
    setRows((prev) => [...prev, row]);
    onChange();
  }, [records, agencyId, createNode, nextRefIdNumber, toRow, onChange]);

  const deleteSelected = useCallback(() => {
    const selected = (gridRef.current?.api.getSelectedRows() ?? []) as FlatGridRow[];
    for (const row of selected) {
      const node = findByUid(records, row.uid);
      if (node) deleteNode(records, node);
    }
    const deletedUids = new Set(selected.map((r) => r.uid));
    setRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
    onChange();
  }, [records, findByUid, deleteNode, onChange]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const api = gridRef.current?.api;
      if (api?.getEditingCells().length && api.getEditingCells().length > 0) return;
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;

      const focused = api?.getFocusedCell();
      const startFieldIndex = focused
        ? Math.max(0, editableFields.indexOf(focused.column.getColId()))
        : 0;
      const startRowIndex = focused ? focused.rowIndex ?? 0 : rows.length;

      e.preventDefault();
      const lines = text.replace(/\r/g, "").split("\n");
      while (lines.length && lines[lines.length - 1] === "") lines.pop();
      if (!lines.length) return;

      let currentRows = [...rows];
      lines.forEach((line, i) => {
        const cells = line.includes("\t") ? line.split("\t") : line.split(",");
        const targetRowIndex = startRowIndex + i;
        let targetRow = currentRows[targetRowIndex];
        let targetNode: PNode;
        if (!targetRow) {
          const num = nextRefIdNumber(records);
          targetNode = createNode(num, agencyId);
          records.push(targetNode);
          targetRow = toRow(targetNode);
          currentRows = [...currentRows, targetRow];
        } else {
          targetNode = findByUid(records, targetRow.uid) as PNode;
        }
        cells.forEach((cellValue, j) => {
          const field = editableFields[startFieldIndex + j];
          if (!field) return;
          setField(targetNode, field, cellValue.trim());
        });
        const updated = toRow(targetNode);
        currentRows = currentRows.map((r) => (r.uid === updated.uid ? updated : r));
      });
      setRows(currentRows);
      onChange();
    },
    [rows, records, editableFields, nextRefIdNumber, createNode, agencyId, toRow, findByUid, setField, onChange]
  );

  return (
    <div className="grid-stack">
      <div className="grid-panel" style={{ flex: 1, minHeight: 160 }}>
        <div className="grid-toolbar">
          <button className="btn" onClick={addRow}>
            {addButtonLabel}
          </button>
          <button className="btn btn-danger" onClick={deleteSelected}>
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {toolbarLabel} ({rows.length})
          </span>
        </div>
        <div
          className={gridThemeClass}
          style={{ flex: 1, width: "100%", minHeight: 0 }}
          onPaste={handlePaste}
        >
          <AgGridReact<FlatGridRow>
            ref={gridRef}
            rowData={rows}
            columnDefs={columnDefs}
            rowHeight={ROW_HEIGHT}
            headerHeight={HEADER_HEIGHT}
            getRowId={(p) => p.data.uid}
            rowSelection="multiple"
            onCellValueChanged={onCellValueChanged}
            stopEditingWhenCellsLoseFocus
          />
        </div>
      </div>
    </div>
  );
});

export default FlatGrid;
