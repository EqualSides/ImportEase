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
  RefLookupTableRow,
  LookupTableColumnRow,
  LookupTableValueRow,
  createRefLookupTableNode,
  createLookupTableColumnNode,
  createLookupTableValueNode,
  deleteRefLookupTable,
  deleteLookupTableColumn,
  deleteLookupTableValue,
  findRefLookupTableByUid,
  findLookupTableColumnByUid,
  findLookupTableValueByUid,
  getLookupTableColumnNodes,
  getLookupTableValueNodes,
  nextRefIdNumber,
  setRefLookupTableField,
  setLookupTableColumnField,
  setLookupTableValueField,
  toRefLookupTableRow,
  toLookupTableColumnRow,
  toLookupTableValueRow,
} from "@/lib/xml/refLookupTable";

/**
 * First three-level grid in the app — a table has columns, each column has
 * values. Three stacked panels (mirrors the established two-panel
 * parent/child grids, e.g. RefAddressTypeGroupGrid), with an independent
 * resize handle between each pair of adjacent panels. Selecting a table row
 * refreshes the column list; selecting a column row refreshes the value
 * list; either selection changing resets the level(s) below it.
 */

export interface RefLookupTableGridHandle {
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

const TABLE_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "lookupTableName", headerName: "Table Name", editable: true },
  { field: "category", headerName: "Category", editable: true },
  { field: "group", headerName: "Group", editable: true },
  { field: "lookupEntityType", headerName: "Entity Type", editable: true, hide: true },
  { field: "subType", headerName: "Sub Type", editable: true, hide: true },
  { field: "type", headerName: "Type", editable: true, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "columnCount", headerName: "# Columns", editable: false },
];

const COLUMN_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "lookupColumnName", headerName: "Column Name", editable: true },
  { field: "lookupColumnNumber", headerName: "Column #", editable: true },
  { field: "lookupColumnType", headerName: "Column Type", editable: true, hide: true },
  { field: "lookupGroup", headerName: "Group", editable: true, hide: true },
  { field: "lookupSubgroup", headerName: "Subgroup", editable: true, hide: true },
  { field: "maxLength", headerName: "Max Length", editable: true, hide: true },
  { field: "lookupTableName", headerName: "Table Name", editable: false, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "valueCount", headerName: "# Values", editable: false },
];

const VALUE_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "lookupRowNumber", headerName: "Row #", editable: true },
  { field: "lookupColumnValue", headerName: "Value", editable: true },
  { field: "lookupColumnName", headerName: "Column Name", editable: false, hide: true },
  { field: "lookupColumnNumber", headerName: "Column #", editable: false, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
];

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

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 38;
const PANEL_CHROME = 74;
const MIN_PANEL_PX = 160;
const HANDLE_PX = 14;

function naturalPanelHeight(rowCount: number): number {
  return PANEL_CHROME + HEADER_HEIGHT + Math.max(rowCount, 1) * ROW_HEIGHT;
}

const RefLookupTableGrid = forwardRef<RefLookupTableGridHandle, Props>(function RefLookupTableGrid(
  { records, onChange, gridThemeClass, agencyId },
  ref
) {
  const [tableRows, setTableRows] = useState<RefLookupTableRow[]>(() =>
    records.map(toRefLookupTableRow)
  );
  const [selectedTableUid, setSelectedTableUid] = useState<string | null>(
    tableRows[0]?.uid ?? null
  );

  const selectedTableNode = useMemo(
    () => (selectedTableUid ? findRefLookupTableByUid(records, selectedTableUid) ?? null : null),
    [records, selectedTableUid]
  );

  const [columnRows, setColumnRows] = useState<LookupTableColumnRow[]>(() =>
    selectedTableNode ? getLookupTableColumnNodes(selectedTableNode).map(toLookupTableColumnRow) : []
  );
  const [selectedColumnUid, setSelectedColumnUid] = useState<string | null>(
    columnRows[0]?.uid ?? null
  );

  const selectedColumnNode = useMemo(
    () =>
      selectedTableNode && selectedColumnUid
        ? findLookupTableColumnByUid(selectedTableNode, selectedColumnUid) ?? null
        : null,
    [selectedTableNode, selectedColumnUid]
  );

  const [valueRows, setValueRows] = useState<LookupTableValueRow[]>(() =>
    selectedColumnNode ? getLookupTableValueNodes(selectedColumnNode).map(toLookupTableValueRow) : []
  );

  const tableGridRef = useRef<AgGridReact<RefLookupTableRow>>(null);
  const columnGridRef = useRef<AgGridReact<LookupTableColumnRow>>(null);
  const valueGridRef = useRef<AgGridReact<LookupTableValueRow>>(null);
  const pendingTableFocusUid = useRef<string | null>(null);
  const pendingColumnFocusUid = useRef<string | null>(null);
  const pendingValueFocusUid = useRef<string | null>(null);

  const stackRef = useRef<HTMLDivElement>(null);
  const [topHeight, setTopHeight] = useState<number | null>(null);
  const [midHeight, setMidHeight] = useState<number | null>(null);
  const [topCollapsed, setTopCollapsed] = useState(false);
  const [midCollapsed, setMidCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const userResizedRef = useRef(false);
  const dragRef = useRef<{
    which: "top" | "mid";
    startY: number;
    startTop: number;
    startMid: number;
  } | null>(null);

  const recomputeHeights = useCallback(() => {
    if (userResizedRef.current) return;
    const stack = stackRef.current;
    const available = stack ? stack.clientHeight : 900;
    const reserve = 2 * HANDLE_PX + 2 * MIN_PANEL_PX;
    const t = Math.min(naturalPanelHeight(tableRows.length), Math.max(MIN_PANEL_PX, available * 0.34));
    const m = Math.min(
      naturalPanelHeight(columnRows.length),
      Math.max(MIN_PANEL_PX, available * 0.33)
    );
    const cap = Math.max(MIN_PANEL_PX, available - reserve + 2 * MIN_PANEL_PX);
    setTopHeight(Math.min(t, cap));
    setMidHeight(Math.min(m, cap));
  }, [tableRows.length, columnRows.length]);

  useEffect(() => {
    recomputeHeights();
  }, [recomputeHeights]);

  useEffect(() => {
    const onResize = () => recomputeHeights();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recomputeHeights]);

  const onTopHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        which: "top",
        startY: e.clientY,
        startTop: topHeight ?? 220,
        startMid: midHeight ?? 220,
      };
      document.body.classList.add("resizing-panels");
      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        const stack = stackRef.current;
        if (!drag || !stack) return;
        const available = stack.clientHeight;
        const delta = ev.clientY - drag.startY;
        const maxTop = Math.max(
          MIN_PANEL_PX,
          available - 2 * HANDLE_PX - 2 * MIN_PANEL_PX - drag.startMid
        );
        const next = Math.min(Math.max(drag.startTop + delta, MIN_PANEL_PX), maxTop);
        userResizedRef.current = true;
        setTopHeight(next);
      };
      const onUp = () => {
        dragRef.current = null;
        document.body.classList.remove("resizing-panels");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [topHeight, midHeight]
  );

  const onMidHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        which: "mid",
        startY: e.clientY,
        startTop: topHeight ?? 220,
        startMid: midHeight ?? 220,
      };
      document.body.classList.add("resizing-panels");
      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        const stack = stackRef.current;
        if (!drag || !stack) return;
        const available = stack.clientHeight;
        const delta = ev.clientY - drag.startY;
        const maxMid = Math.max(
          MIN_PANEL_PX,
          available - 2 * HANDLE_PX - MIN_PANEL_PX - drag.startTop
        );
        const next = Math.min(Math.max(drag.startMid + delta, MIN_PANEL_PX), maxMid);
        userResizedRef.current = true;
        setMidHeight(next);
      };
      const onUp = () => {
        dragRef.current = null;
        document.body.classList.remove("resizing-panels");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [topHeight, midHeight]
  );

  const tableColumnDefs = useMemo(
    () => buildColumnDefs<RefLookupTableRow>(TABLE_COLUMN_META, tableRows),
    [tableRows]
  );
  const columnColumnDefs = useMemo(
    () => buildColumnDefs<LookupTableColumnRow>(COLUMN_COLUMN_META, columnRows),
    [columnRows]
  );
  const valueColumnDefs = useMemo(
    () => buildColumnDefs<LookupTableValueRow>(VALUE_COLUMN_META, valueRows),
    [valueRows]
  );

  useEffect(() => {
    const uid = pendingTableFocusUid.current;
    pendingTableFocusUid.current = null;
    if (!uid) return;
    const api = tableGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "lookupTableName");
    }
  }, [tableRows]);

  useEffect(() => {
    const uid = pendingColumnFocusUid.current;
    pendingColumnFocusUid.current = null;
    if (!uid) return;
    const api = columnGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "lookupColumnName");
    }
  }, [columnRows]);

  useEffect(() => {
    const uid = pendingValueFocusUid.current;
    pendingValueFocusUid.current = null;
    if (!uid) return;
    const api = valueGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "lookupColumnValue");
    }
  }, [valueRows]);

  const refreshColumnRows = useCallback((node: PNode | null) => {
    setColumnRows(node ? getLookupTableColumnNodes(node).map(toLookupTableColumnRow) : []);
  }, []);

  const refreshValueRows = useCallback((node: PNode | null) => {
    setValueRows(node ? getLookupTableValueNodes(node).map(toLookupTableValueRow) : []);
  }, []);

  const refreshTableRow = useCallback((node: PNode) => {
    const updated = toRefLookupTableRow(node);
    setTableRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
  }, []);

  const refreshColumnRow = useCallback((node: PNode) => {
    const updated = toLookupTableColumnRow(node);
    setColumnRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
  }, []);

  const flashRow = useCallback((api: any, uid: string, field: string) => {
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) api.flashCells({ rowNodes: [rowNode], columns: [field] });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      applyAgencyIdToAll: (value: string) => {
        for (const tableNode of records) {
          setRefLookupTableField(tableNode, "serviceProviderCode", value);
          for (const colNode of getLookupTableColumnNodes(tableNode)) {
            setLookupTableColumnField(colNode, "serviceProviderCode", value);
            for (const valNode of getLookupTableValueNodes(colNode)) {
              setLookupTableValueField(valNode, "serviceProviderCode", value);
            }
          }
        }
        setTableRows(records.map(toRefLookupTableRow));
        if (selectedTableNode) refreshColumnRows(selectedTableNode);
        if (selectedColumnNode) refreshValueRows(selectedColumnNode);
        onChange();
      },
    }),
    [records, selectedTableNode, selectedColumnNode, refreshColumnRows, refreshValueRows, onChange]
  );

  const onTableSelectionChanged = useCallback(() => {
    const selected = tableGridRef.current?.api.getSelectedRows() ?? [];
    const uid = selected[0]?.uid ?? null;
    setSelectedTableUid(uid);
    setSelectedColumnUid(null);
    const node = uid ? findRefLookupTableByUid(records, uid) : null;
    refreshColumnRows(node ?? null);
    setValueRows([]);
  }, [records, refreshColumnRows]);

  const onColumnSelectionChanged = useCallback(() => {
    const selected = columnGridRef.current?.api.getSelectedRows() ?? [];
    const uid = selected[0]?.uid ?? null;
    setSelectedColumnUid(uid);
    const node = selectedTableNode && uid ? findLookupTableColumnByUid(selectedTableNode, uid) : null;
    refreshValueRows(node ?? null);
  }, [selectedTableNode, refreshValueRows]);

  const onTableCellValueChanged = useCallback(
    (e: CellValueChangedEvent<RefLookupTableRow>) => {
      const node = findRefLookupTableByUid(records, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setRefLookupTableField(node, field, String(e.newValue ?? ""));
      refreshTableRow(node);
      if (field === "lookupTableName" && selectedTableUid === e.data.uid) {
        refreshColumnRows(node);
        if (selectedColumnNode) refreshValueRows(selectedColumnNode);
      }
      flashRow(tableGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [
      records,
      selectedTableUid,
      selectedColumnNode,
      refreshColumnRows,
      refreshValueRows,
      refreshTableRow,
      flashRow,
      onChange,
    ]
  );

  const onColumnCellValueChanged = useCallback(
    (e: CellValueChangedEvent<LookupTableColumnRow>) => {
      if (!selectedTableNode) return;
      const node = findLookupTableColumnByUid(selectedTableNode, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setLookupTableColumnField(node, field, String(e.newValue ?? ""));
      refreshColumnRow(node);
      if (
        (field === "lookupColumnName" ||
          field === "lookupColumnNumber" ||
          field === "lookupGroup" ||
          field === "lookupSubgroup") &&
        selectedColumnUid === e.data.uid
      ) {
        refreshValueRows(node);
      }
      flashRow(columnGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [selectedTableNode, selectedColumnUid, refreshColumnRow, refreshValueRows, flashRow, onChange]
  );

  const onValueCellValueChanged = useCallback(
    (e: CellValueChangedEvent<LookupTableValueRow>) => {
      if (!selectedColumnNode) return;
      const node = findLookupTableValueByUid(selectedColumnNode, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setLookupTableValueField(node, field, String(e.newValue ?? ""));
      const updated = toLookupTableValueRow(node);
      setValueRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
      flashRow(valueGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [selectedColumnNode, flashRow, onChange]
  );

  const addTableRow = useCallback(() => {
    const num = nextRefIdNumber(records, "RefLookupTableModel");
    const node = createRefLookupTableNode(num, agencyId);
    records.push(node);
    const row = toRefLookupTableRow(node);
    pendingTableFocusUid.current = row.uid;
    setTableRows((prev) => [...prev, row]);
    onChange();
  }, [records, agencyId, onChange]);

  const deleteSelectedTableRows = useCallback(() => {
    const selected = (tableGridRef.current?.api.getSelectedRows() ?? []) as RefLookupTableRow[];
    for (const row of selected) {
      const node = findRefLookupTableByUid(records, row.uid);
      if (node) deleteRefLookupTable(records, node);
    }
    const deletedUids = new Set(selected.map((r) => r.uid));
    setTableRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
    if (selectedTableUid && deletedUids.has(selectedTableUid)) {
      setSelectedTableUid(null);
      setSelectedColumnUid(null);
      setColumnRows([]);
      setValueRows([]);
    }
    onChange();
  }, [records, selectedTableUid, onChange]);

  const addColumnRow = useCallback(() => {
    if (!selectedTableNode) return;
    const num = nextRefIdNumber(records, "LookupTableColumnModel");
    const tableRow = toRefLookupTableRow(selectedTableNode);
    const node = createLookupTableColumnNode(num, tableRow.lookupTableName, tableRow.serviceProviderCode);
    getLookupTableColumnNodes(selectedTableNode).push(node);
    const row = toLookupTableColumnRow(node);
    pendingColumnFocusUid.current = row.uid;
    setColumnRows((prev) => [...prev, row]);
    refreshTableRow(selectedTableNode);
    onChange();
  }, [records, selectedTableNode, refreshTableRow, onChange]);

  const deleteSelectedColumnRows = useCallback(() => {
    if (!selectedTableNode) return;
    const selected = (columnGridRef.current?.api.getSelectedRows() ?? []) as LookupTableColumnRow[];
    for (const row of selected) {
      const node = findLookupTableColumnByUid(selectedTableNode, row.uid);
      if (node) deleteLookupTableColumn(selectedTableNode, node);
    }
    refreshColumnRows(selectedTableNode);
    refreshTableRow(selectedTableNode);
    if (selectedColumnUid && selected.some((r) => r.uid === selectedColumnUid)) {
      setSelectedColumnUid(null);
      setValueRows([]);
    }
    onChange();
  }, [selectedTableNode, selectedColumnUid, refreshColumnRows, refreshTableRow, onChange]);

  const addValueRow = useCallback(() => {
    if (!selectedColumnNode) return;
    const num = nextRefIdNumber(records, "LookupTableValueModel");
    const columnRow = toLookupTableColumnRow(selectedColumnNode);
    const node = createLookupTableValueNode(
      num,
      columnRow.lookupTableName,
      columnRow.lookupColumnName,
      columnRow.lookupColumnNumber,
      columnRow.lookupGroup,
      columnRow.lookupSubgroup,
      columnRow.serviceProviderCode
    );
    getLookupTableValueNodes(selectedColumnNode).push(node);
    const row = toLookupTableValueRow(node);
    pendingValueFocusUid.current = row.uid;
    setValueRows((prev) => [...prev, row]);
    refreshColumnRow(selectedColumnNode);
    onChange();
  }, [records, selectedColumnNode, refreshColumnRow, onChange]);

  const deleteSelectedValueRows = useCallback(() => {
    if (!selectedColumnNode) return;
    const selected = (valueGridRef.current?.api.getSelectedRows() ?? []) as LookupTableValueRow[];
    for (const row of selected) {
      const node = findLookupTableValueByUid(selectedColumnNode, row.uid);
      if (node) deleteLookupTableValue(selectedColumnNode, node);
    }
    refreshValueRows(selectedColumnNode);
    refreshColumnRow(selectedColumnNode);
    onChange();
  }, [selectedColumnNode, refreshValueRows, refreshColumnRow, onChange]);

  return (
    <div className="grid-stack" ref={stackRef}>
      <div
        className="grid-panel"
        style={
          topCollapsed
            ? { flex: "0 0 auto", height: "auto", minHeight: 0 }
            : { flex: "0 0 auto", height: topHeight ?? undefined, minHeight: MIN_PANEL_PX }
        }
      >
        <div className="grid-toolbar">
          <button
            className="btn icon-btn"
            onClick={() => setTopCollapsed((c) => !c)}
            title={topCollapsed ? "Expand Lookup Tables" : "Collapse Lookup Tables"}
          >
            {topCollapsed ? "▸" : "▾"}
          </button>
          <button className="btn" onClick={addTableRow}>
            + Add Table
          </button>
          <button className="btn btn-danger" onClick={deleteSelectedTableRows}>
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            Lookup Tables ({tableRows.length})
            {topCollapsed && selectedTableNode && (
              <>
                {" — "}
                <strong>{toRefLookupTableRow(selectedTableNode).lookupTableName || "(unnamed)"}</strong>
              </>
            )}
          </span>
        </div>
        {!topCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<RefLookupTableRow>
              ref={tableGridRef}
              rowData={tableRows}
              columnDefs={tableColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="single"
              onSelectionChanged={onTableSelectionChanged}
              onCellValueChanged={onTableCellValueChanged}
              stopEditingWhenCellsLoseFocus
            />
          </div>
        )}
      </div>

      {!topCollapsed && !midCollapsed && (
        <div className="resize-handle" onMouseDown={onTopHandleMouseDown} title="Drag to resize" />
      )}

      <div
        className="grid-panel"
        style={
          midCollapsed
            ? { flex: "0 0 auto", height: "auto", minHeight: 0 }
            : { flex: "0 0 auto", height: midHeight ?? undefined, minHeight: MIN_PANEL_PX }
        }
      >
        <div className="grid-toolbar">
          <button
            className="btn icon-btn"
            onClick={() => setMidCollapsed((c) => !c)}
            title={midCollapsed ? "Expand Columns" : "Collapse Columns"}
          >
            {midCollapsed ? "▸" : "▾"}
          </button>
          <button className="btn" onClick={addColumnRow} disabled={!selectedTableNode}>
            + Add Column
          </button>
          <button
            className="btn btn-danger"
            onClick={deleteSelectedColumnRows}
            disabled={!selectedTableNode}
          >
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {selectedTableNode
              ? `Columns for "${toRefLookupTableRow(selectedTableNode).lookupTableName || "(unnamed)"}" (${columnRows.length})`
              : "Select a Lookup Table above to see its columns"}
            {midCollapsed && selectedColumnNode && (
              <>
                {" — "}
                <strong>{toLookupTableColumnRow(selectedColumnNode).lookupColumnName || "(unnamed)"}</strong>
              </>
            )}
          </span>
        </div>
        {!midCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<LookupTableColumnRow>
              ref={columnGridRef}
              rowData={columnRows}
              columnDefs={columnColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="single"
              onSelectionChanged={onColumnSelectionChanged}
              onCellValueChanged={onColumnCellValueChanged}
              stopEditingWhenCellsLoseFocus
            />
          </div>
        )}
      </div>

      {!midCollapsed && !bottomCollapsed && (
        <div className="resize-handle" onMouseDown={onMidHandleMouseDown} title="Drag to resize" />
      )}

      <div
        className="grid-panel"
        style={
          bottomCollapsed
            ? { flex: "0 0 auto", height: "auto", minHeight: 0 }
            : { flex: 1, minHeight: MIN_PANEL_PX }
        }
      >
        <div className="grid-toolbar">
          <button
            className="btn icon-btn"
            onClick={() => setBottomCollapsed((c) => !c)}
            title={bottomCollapsed ? "Expand Values" : "Collapse Values"}
          >
            {bottomCollapsed ? "▸" : "▾"}
          </button>
          <button className="btn" onClick={addValueRow} disabled={!selectedColumnNode}>
            + Add Value
          </button>
          <button
            className="btn btn-danger"
            onClick={deleteSelectedValueRows}
            disabled={!selectedColumnNode}
          >
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {selectedColumnNode
              ? `Values for "${toLookupTableColumnRow(selectedColumnNode).lookupColumnName || "(unnamed)"}" (${valueRows.length})`
              : "Select a Column above to see its values"}
          </span>
        </div>
        {!bottomCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<LookupTableValueRow>
              ref={valueGridRef}
              rowData={valueRows}
              columnDefs={valueColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="multiple"
              onCellValueChanged={onValueCellValueChanged}
              stopEditingWhenCellsLoseFocus
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default RefLookupTableGrid;
