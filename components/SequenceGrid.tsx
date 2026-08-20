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
  SequenceRow,
  SequenceIntervalRow,
  createSequenceNode,
  createSequenceIntervalNode,
  deleteSequence,
  deleteSequenceInterval,
  findSequenceByUid,
  findSequenceIntervalByUid,
  getSequenceIntervalNodes,
  nextRefIdNumber,
  setSequenceField,
  setSequenceIntervalField,
  toSequenceRow,
  toSequenceIntervalRow,
} from "@/lib/xml/sequence";

export interface SequenceGridHandle {
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

const PARENT_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "name", headerName: "Name", editable: true },
  { field: "type", headerName: "Type", editable: true },
  { field: "description", headerName: "Description", editable: true },
  { field: "intervalType", headerName: "Interval Type", editable: true },
  { field: "cacheSize", headerName: "Cache Size", editable: true, hide: true },
  { field: "increaseValue", headerName: "Increase By", editable: true, hide: true },
  { field: "minValue", headerName: "Min Value", editable: true, hide: true },
  { field: "resetAction", headerName: "Reset Action", editable: true, hide: true },
  { field: "resetValue", headerName: "Reset Value", editable: true, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "intervalCount", headerName: "# Intervals", editable: false },
];

const CHILD_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "intervalName", headerName: "Interval Name", editable: true },
  { field: "lastSequenceNbr", headerName: "Last Sequence #", editable: true },
  { field: "sequenceName", headerName: "Sequence Name", editable: false, hide: true },
  { field: "sequenceType", headerName: "Sequence Type", editable: false, hide: true },
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

const SequenceGrid = forwardRef<SequenceGridHandle, Props>(function SequenceGrid(
  { records, onChange, gridThemeClass, agencyId },
  ref
) {
  const [parentRows, setParentRows] = useState<SequenceRow[]>(() => records.map(toSequenceRow));
  const [selectedUid, setSelectedUid] = useState<string | null>(parentRows[0]?.uid ?? null);

  const selectedNode = useMemo(
    () => (selectedUid ? findSequenceByUid(records, selectedUid) ?? null : null),
    [records, selectedUid]
  );

  const [childRows, setChildRows] = useState<SequenceIntervalRow[]>(() =>
    selectedNode ? getSequenceIntervalNodes(selectedNode).map(toSequenceIntervalRow) : []
  );

  const parentGridRef = useRef<AgGridReact<SequenceRow>>(null);
  const childGridRef = useRef<AgGridReact<SequenceIntervalRow>>(null);
  const pendingParentFocusUid = useRef<string | null>(null);
  const pendingChildFocusUid = useRef<string | null>(null);

  const stackRef = useRef<HTMLDivElement>(null);
  const [topPanelHeight, setTopPanelHeight] = useState<number | null>(null);
  const [topPanelCollapsed, setTopPanelCollapsed] = useState(false);
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

  const onHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [topPanelHeight]
  );

  const parentColumnDefs = useMemo(
    () => buildColumnDefs<SequenceRow>(PARENT_COLUMN_META, parentRows),
    [parentRows]
  );
  const childColumnDefs = useMemo(
    () => buildColumnDefs<SequenceIntervalRow>(CHILD_COLUMN_META, childRows),
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
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "intervalName");
    }
  }, [childRows]);

  const refreshChildRows = useCallback((node: PNode | null) => {
    setChildRows(node ? getSequenceIntervalNodes(node).map(toSequenceIntervalRow) : []);
  }, []);

  const refreshParentRow = useCallback((node: PNode) => {
    const updated = toSequenceRow(node);
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
          setSequenceField(node, "serviceProviderCode", value);
          for (const intervalNode of getSequenceIntervalNodes(node)) {
            setSequenceIntervalField(intervalNode, "serviceProviderCode", value);
          }
        }
        setParentRows(records.map(toSequenceRow));
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
    const node = uid ? findSequenceByUid(records, uid) : null;
    refreshChildRows(node ?? null);
  }, [records, refreshChildRows]);

  const onParentCellValueChanged = useCallback(
    (e: CellValueChangedEvent<SequenceRow>) => {
      const node = findSequenceByUid(records, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setSequenceField(node, field, String(e.newValue ?? ""));
      refreshParentRow(node);
      if ((field === "name" || field === "type") && selectedUid === e.data.uid) {
        refreshChildRows(node);
      }
      flashRow(parentGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [records, selectedUid, refreshChildRows, refreshParentRow, flashRow, onChange]
  );

  const onChildCellValueChanged = useCallback(
    (e: CellValueChangedEvent<SequenceIntervalRow>) => {
      if (!selectedNode) return;
      const node = findSequenceIntervalByUid(selectedNode, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setSequenceIntervalField(node, field, String(e.newValue ?? ""));
      const updated = toSequenceIntervalRow(node);
      setChildRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
      flashRow(childGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [selectedNode, flashRow, onChange]
  );

  const addParentRow = useCallback(() => {
    const num = nextRefIdNumber(records, "SequenceModel");
    const node = createSequenceNode(num, agencyId);
    records.push(node);
    const row = toSequenceRow(node);
    pendingParentFocusUid.current = row.uid;
    setParentRows((prev) => [...prev, row]);
    onChange();
  }, [records, agencyId, onChange]);

  const deleteSelectedParentRows = useCallback(() => {
    const selected = (parentGridRef.current?.api.getSelectedRows() ?? []) as SequenceRow[];
    for (const row of selected) {
      const node = findSequenceByUid(records, row.uid);
      if (node) deleteSequence(records, node);
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
    const num = nextRefIdNumber(records, "SequenceIntervalModel");
    const parentRow = toSequenceRow(selectedNode);
    const node = createSequenceIntervalNode(
      num,
      parentRow.name,
      parentRow.type,
      parentRow.serviceProviderCode
    );
    getSequenceIntervalNodes(selectedNode).push(node);
    const row = toSequenceIntervalRow(node);
    pendingChildFocusUid.current = row.uid;
    setChildRows((prev) => [...prev, row]);
    refreshParentRow(selectedNode);
    onChange();
  }, [records, selectedNode, refreshParentRow, onChange]);

  const deleteSelectedChildRows = useCallback(() => {
    if (!selectedNode) return;
    const selected = (childGridRef.current?.api.getSelectedRows() ?? []) as SequenceIntervalRow[];
    for (const row of selected) {
      const node = findSequenceIntervalByUid(selectedNode, row.uid);
      if (node) deleteSequenceInterval(selectedNode, node);
    }
    refreshChildRows(selectedNode);
    refreshParentRow(selectedNode);
    onChange();
  }, [selectedNode, refreshChildRows, refreshParentRow, onChange]);

  return (
    <div className="grid-stack" ref={stackRef}>
      <div
        className="grid-panel"
        style={
          topPanelCollapsed
            ? { flex: "0 0 auto", height: "auto", minHeight: 0 }
            : { flex: "0 0 auto", height: topPanelHeight ?? undefined, minHeight: MIN_PANEL_PX }
        }
      >
        <div className="grid-toolbar">
          <button
            className="btn icon-btn"
            onClick={() => setTopPanelCollapsed((c) => !c)}
            title={topPanelCollapsed ? "Expand Sequences" : "Collapse Sequences"}
          >
            {topPanelCollapsed ? "▸" : "▾"}
          </button>
          <button className="btn" onClick={addParentRow}>
            + Add Sequence
          </button>
          <button className="btn btn-danger" onClick={deleteSelectedParentRows}>
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            Sequences ({parentRows.length})
            {topPanelCollapsed && selectedNode && (
              <>
                {" — "}
                <strong>{toSequenceRow(selectedNode).name || "(unnamed)"}</strong>
              </>
            )}
          </span>
        </div>
        {!topPanelCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<SequenceRow>
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
        )}
      </div>

      {!topPanelCollapsed && (
        <div className="resize-handle" onMouseDown={onHandleMouseDown} title="Drag to resize" />
      )}

      <div className="grid-panel" style={{ flex: 1, minHeight: MIN_PANEL_PX }}>
        <div className="grid-toolbar">
          <button className="btn" onClick={addChildRow} disabled={!selectedNode}>
            + Add Interval
          </button>
          <button
            className="btn btn-danger"
            onClick={deleteSelectedChildRows}
            disabled={!selectedNode}
          >
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {selectedNode
              ? `Intervals for "${toSequenceRow(selectedNode).name || "(unnamed)"}" (${childRows.length})`
              : "Select a Sequence above to see its intervals"}
          </span>
        </div>
        <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
          <AgGridReact<SequenceIntervalRow>
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

export default SequenceGrid;
