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
  RefInspectionResultGroupRow,
  InspectionResultGroupModelRow,
  createRefInspectionResultGroupNode,
  createInspectionResultGroupModelNode,
  deleteRefInspectionResultGroup,
  deleteInspectionResultGroupModel,
  findRefInspectionResultGroupByUid,
  findInspectionResultGroupModelByUid,
  getInspectionResultGroupModelNodes,
  nextRefIdNumber,
  setRefInspectionResultGroupField,
  setInspectionResultGroupModelField,
  toRefInspectionResultGroupRow,
  toInspectionResultGroupModelRow,
} from "@/lib/xml/refInspectionResultGroup";

export interface RefInspectionResultGroupGridHandle {
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
  { field: "inspResultGroup", headerName: "Result Group", editable: true },
  { field: "resultCatrgory", headerName: "Category", editable: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "resultCount", headerName: "# Results", editable: false },
];

const CHILD_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "inspResult", headerName: "Result", editable: true },
  { field: "inspResultType", headerName: "Result Type", editable: true },
  { field: "inspResultDisplayOrder", headerName: "Display Order", editable: true },
  { field: "inspResultGroup", headerName: "Result Group", editable: false, hide: true },
  { field: "resultCatrgory", headerName: "Category", editable: false, hide: true },
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

const RefInspectionResultGroupGrid = forwardRef<RefInspectionResultGroupGridHandle, Props>(
  function RefInspectionResultGroupGrid({ records, onChange, gridThemeClass, agencyId }, ref) {
    const [parentRows, setParentRows] = useState<RefInspectionResultGroupRow[]>(() =>
      records.map(toRefInspectionResultGroupRow)
    );
    const [selectedUid, setSelectedUid] = useState<string | null>(parentRows[0]?.uid ?? null);

    const selectedNode = useMemo(
      () => (selectedUid ? findRefInspectionResultGroupByUid(records, selectedUid) ?? null : null),
      [records, selectedUid]
    );

    const [childRows, setChildRows] = useState<InspectionResultGroupModelRow[]>(() =>
      selectedNode
        ? getInspectionResultGroupModelNodes(selectedNode).map(toInspectionResultGroupModelRow)
        : []
    );

    const parentGridRef = useRef<AgGridReact<RefInspectionResultGroupRow>>(null);
    const childGridRef = useRef<AgGridReact<InspectionResultGroupModelRow>>(null);
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
      () => buildColumnDefs<RefInspectionResultGroupRow>(PARENT_COLUMN_META, parentRows),
      [parentRows]
    );
    const childColumnDefs = useMemo(
      () => buildColumnDefs<InspectionResultGroupModelRow>(CHILD_COLUMN_META, childRows),
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
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "inspResultGroup");
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
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "inspResult");
      }
    }, [childRows]);

    const refreshChildRows = useCallback((node: PNode | null) => {
      setChildRows(
        node ? getInspectionResultGroupModelNodes(node).map(toInspectionResultGroupModelRow) : []
      );
    }, []);

    const refreshParentRow = useCallback((node: PNode) => {
      const updated = toRefInspectionResultGroupRow(node);
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
            setRefInspectionResultGroupField(node, "serviceProviderCode", value);
            for (const resultNode of getInspectionResultGroupModelNodes(node)) {
              setInspectionResultGroupModelField(resultNode, "serviceProviderCode", value);
            }
          }
          setParentRows(records.map(toRefInspectionResultGroupRow));
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
      const node = uid ? findRefInspectionResultGroupByUid(records, uid) : null;
      refreshChildRows(node ?? null);
    }, [records, refreshChildRows]);

    const onParentCellValueChanged = useCallback(
      (e: CellValueChangedEvent<RefInspectionResultGroupRow>) => {
        const node = findRefInspectionResultGroupByUid(records, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setRefInspectionResultGroupField(node, field, String(e.newValue ?? ""));
        refreshParentRow(node);
        if (
          (field === "inspResultGroup" || field === "resultCatrgory") &&
          selectedUid === e.data.uid
        ) {
          refreshChildRows(node);
        }
        flashRow(parentGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [records, selectedUid, refreshChildRows, refreshParentRow, flashRow, onChange]
    );

    const onChildCellValueChanged = useCallback(
      (e: CellValueChangedEvent<InspectionResultGroupModelRow>) => {
        if (!selectedNode) return;
        const node = findInspectionResultGroupModelByUid(selectedNode, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setInspectionResultGroupModelField(node, field, String(e.newValue ?? ""));
        const updated = toInspectionResultGroupModelRow(node);
        setChildRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
        flashRow(childGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [selectedNode, flashRow, onChange]
    );

    const addParentRow = useCallback(() => {
      const num = nextRefIdNumber(records, "RefInspectionResultGroupModel");
      const node = createRefInspectionResultGroupNode(num, agencyId);
      records.push(node);
      const row = toRefInspectionResultGroupRow(node);
      pendingParentFocusUid.current = row.uid;
      setParentRows((prev) => [...prev, row]);
      onChange();
    }, [records, agencyId, onChange]);

    const deleteSelectedParentRows = useCallback(() => {
      const selected = (parentGridRef.current?.api.getSelectedRows() ??
        []) as RefInspectionResultGroupRow[];
      for (const row of selected) {
        const node = findRefInspectionResultGroupByUid(records, row.uid);
        if (node) deleteRefInspectionResultGroup(records, node);
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
      const num = nextRefIdNumber(records, "InspectionResultGroupModel");
      const parentRow = toRefInspectionResultGroupRow(selectedNode);
      const node = createInspectionResultGroupModelNode(
        num,
        parentRow.inspResultGroup,
        parentRow.resultCatrgory,
        parentRow.serviceProviderCode
      );
      getInspectionResultGroupModelNodes(selectedNode).push(node);
      const row = toInspectionResultGroupModelRow(node);
      pendingChildFocusUid.current = row.uid;
      setChildRows((prev) => [...prev, row]);
      refreshParentRow(selectedNode);
      onChange();
    }, [records, selectedNode, refreshParentRow, onChange]);

    const deleteSelectedChildRows = useCallback(() => {
      if (!selectedNode) return;
      const selected = (childGridRef.current?.api.getSelectedRows() ??
        []) as InspectionResultGroupModelRow[];
      for (const row of selected) {
        const node = findInspectionResultGroupModelByUid(selectedNode, row.uid);
        if (node) deleteInspectionResultGroupModel(selectedNode, node);
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
              title={
                topPanelCollapsed
                  ? "Expand Inspection Result Groups"
                  : "Collapse Inspection Result Groups"
              }
            >
              {topPanelCollapsed ? "▸" : "▾"}
            </button>
            <button className="btn" onClick={addParentRow}>
              + Add Result Group
            </button>
            <button className="btn btn-danger" onClick={deleteSelectedParentRows}>
              Delete Selected
            </button>
            <span className="grid-toolbar-label">
              Inspection Result Groups ({parentRows.length})
              {topPanelCollapsed && selectedNode && (
                <>
                  {" — "}
                  <strong>
                    {toRefInspectionResultGroupRow(selectedNode).inspResultGroup || "(unnamed)"}
                  </strong>
                </>
              )}
            </span>
          </div>
          {!topPanelCollapsed && (
            <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
              <AgGridReact<RefInspectionResultGroupRow>
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
              + Add Result
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
                ? `Results for "${toRefInspectionResultGroupRow(selectedNode).inspResultGroup || "(unnamed)"}" (${childRows.length})`
                : "Select an Inspection Result Group above to see its results"}
            </span>
          </div>
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<InspectionResultGroupModelRow>
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
  }
);

export default RefInspectionResultGroupGrid;
