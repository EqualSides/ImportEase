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
  GuideSheetRow,
  GuideSheetItemRow,
  GuideSheetItemStatusGroupRow,
  createGuideSheetNode,
  createGuideSheetItemNode,
  createGuideSheetItemStatusGroupNode,
  deleteGuideSheet,
  deleteGuideSheetItem,
  deleteGuideSheetItemStatusGroup,
  findGuideSheetByUid,
  findGuideSheetItemByUid,
  findGuideSheetItemStatusGroupByUid,
  getGuideSheetItemNodes,
  getGuideSheetItemStatusGroupNodes,
  nextRefIdNumber,
  setGuideSheetField,
  setGuideSheetItemField,
  setGuideSheetItemStatusGroupField,
  toGuideSheetRow,
  toGuideSheetItemRow,
  toGuideSheetItemStatusGroupRow,
} from "@/lib/xml/guideSheet";

/** Second three-level grid in the app (see RefLookupTableGrid.tsx for the first) — sheet -> item -> status group. Same three-stacked-panel structure. */

export interface GuideSheetGridHandle {
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

const SHEET_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "guideType", headerName: "Guide Type", editable: true },
  { field: "guideDesc", headerName: "Description", editable: true, hide: true },
  { field: "guideStatus", headerName: "Status", editable: true, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "itemCount", headerName: "# Items", editable: false },
];

const ITEM_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "guideItemText", headerName: "Item Text", editable: true },
  { field: "guideItemSeqNbr", headerName: "Seq #", editable: true, hide: true },
  { field: "guideItemDisplay_order", headerName: "Display Order", editable: true, hide: true },
  { field: "guideItemStatus", headerName: "Status", editable: true, hide: true },
  { field: "isCritical", headerName: "Critical", editable: true, hide: true },
  { field: "isRequired", headerName: "Required", editable: true, hide: true },
  { field: "guideType", headerName: "Guide Type", editable: false, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "statusGroupCount", headerName: "# Status Groups", editable: false },
];

const STATUS_GROUP_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "ststus", headerName: "Status", editable: true },
  { field: "guideItemStatusResultType", headerName: "Result Type", editable: true },
  { field: "guideItemStatusDispOrder", headerName: "Display Order", editable: true, hide: true },
  { field: "majorViolation", headerName: "Major Violation", editable: true, hide: true },
  { field: "statusGroup", headerName: "Status Group", editable: false, hide: true },
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

const GuideSheetGrid = forwardRef<GuideSheetGridHandle, Props>(function GuideSheetGrid(
  { records, onChange, gridThemeClass, agencyId },
  ref
) {
  const [sheetRows, setSheetRows] = useState<GuideSheetRow[]>(() => records.map(toGuideSheetRow));
  const [selectedSheetUid, setSelectedSheetUid] = useState<string | null>(sheetRows[0]?.uid ?? null);

  const selectedSheetNode = useMemo(
    () => (selectedSheetUid ? findGuideSheetByUid(records, selectedSheetUid) ?? null : null),
    [records, selectedSheetUid]
  );

  const [itemRows, setItemRows] = useState<GuideSheetItemRow[]>(() =>
    selectedSheetNode ? getGuideSheetItemNodes(selectedSheetNode).map(toGuideSheetItemRow) : []
  );
  const [selectedItemUid, setSelectedItemUid] = useState<string | null>(itemRows[0]?.uid ?? null);

  const selectedItemNode = useMemo(
    () =>
      selectedSheetNode && selectedItemUid
        ? findGuideSheetItemByUid(selectedSheetNode, selectedItemUid) ?? null
        : null,
    [selectedSheetNode, selectedItemUid]
  );

  const [statusGroupRows, setStatusGroupRows] = useState<GuideSheetItemStatusGroupRow[]>(() =>
    selectedItemNode
      ? getGuideSheetItemStatusGroupNodes(selectedItemNode).map(toGuideSheetItemStatusGroupRow)
      : []
  );

  const sheetGridRef = useRef<AgGridReact<GuideSheetRow>>(null);
  const itemGridRef = useRef<AgGridReact<GuideSheetItemRow>>(null);
  const statusGroupGridRef = useRef<AgGridReact<GuideSheetItemStatusGroupRow>>(null);
  const pendingSheetFocusUid = useRef<string | null>(null);
  const pendingItemFocusUid = useRef<string | null>(null);
  const pendingStatusGroupFocusUid = useRef<string | null>(null);

  const stackRef = useRef<HTMLDivElement>(null);
  const [topHeight, setTopHeight] = useState<number | null>(null);
  const [midHeight, setMidHeight] = useState<number | null>(null);
  const [topCollapsed, setTopCollapsed] = useState(false);
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
    const t = Math.min(naturalPanelHeight(sheetRows.length), Math.max(MIN_PANEL_PX, available * 0.34));
    const m = Math.min(naturalPanelHeight(itemRows.length), Math.max(MIN_PANEL_PX, available * 0.33));
    const cap = Math.max(MIN_PANEL_PX, available - reserve + 2 * MIN_PANEL_PX);
    setTopHeight(Math.min(t, cap));
    setMidHeight(Math.min(m, cap));
  }, [sheetRows.length, itemRows.length]);

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

  const sheetColumnDefs = useMemo(
    () => buildColumnDefs<GuideSheetRow>(SHEET_COLUMN_META, sheetRows),
    [sheetRows]
  );
  const itemColumnDefs = useMemo(
    () => buildColumnDefs<GuideSheetItemRow>(ITEM_COLUMN_META, itemRows),
    [itemRows]
  );
  const statusGroupColumnDefs = useMemo(
    () => buildColumnDefs<GuideSheetItemStatusGroupRow>(STATUS_GROUP_COLUMN_META, statusGroupRows),
    [statusGroupRows]
  );

  useEffect(() => {
    const uid = pendingSheetFocusUid.current;
    pendingSheetFocusUid.current = null;
    if (!uid) return;
    const api = sheetGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "guideType");
    }
  }, [sheetRows]);

  useEffect(() => {
    const uid = pendingItemFocusUid.current;
    pendingItemFocusUid.current = null;
    if (!uid) return;
    const api = itemGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "guideItemText");
    }
  }, [itemRows]);

  useEffect(() => {
    const uid = pendingStatusGroupFocusUid.current;
    pendingStatusGroupFocusUid.current = null;
    if (!uid) return;
    const api = statusGroupGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "ststus");
    }
  }, [statusGroupRows]);

  const refreshItemRows = useCallback((node: PNode | null) => {
    setItemRows(node ? getGuideSheetItemNodes(node).map(toGuideSheetItemRow) : []);
  }, []);

  const refreshStatusGroupRows = useCallback((node: PNode | null) => {
    setStatusGroupRows(
      node ? getGuideSheetItemStatusGroupNodes(node).map(toGuideSheetItemStatusGroupRow) : []
    );
  }, []);

  const refreshSheetRow = useCallback((node: PNode) => {
    const updated = toGuideSheetRow(node);
    setSheetRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
  }, []);

  const refreshItemRow = useCallback((node: PNode) => {
    const updated = toGuideSheetItemRow(node);
    setItemRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
  }, []);

  const flashRow = useCallback((api: any, uid: string, field: string) => {
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) api.flashCells({ rowNodes: [rowNode], columns: [field] });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      applyAgencyIdToAll: (value: string) => {
        for (const sheetNode of records) {
          setGuideSheetField(sheetNode, "serviceProviderCode", value);
          for (const itemNode of getGuideSheetItemNodes(sheetNode)) {
            setGuideSheetItemField(itemNode, "serviceProviderCode", value);
            for (const sgNode of getGuideSheetItemStatusGroupNodes(itemNode)) {
              setGuideSheetItemStatusGroupField(sgNode, "serviceProviderCode", value);
            }
          }
        }
        setSheetRows(records.map(toGuideSheetRow));
        if (selectedSheetNode) refreshItemRows(selectedSheetNode);
        if (selectedItemNode) refreshStatusGroupRows(selectedItemNode);
        onChange();
      },
    }),
    [records, selectedSheetNode, selectedItemNode, refreshItemRows, refreshStatusGroupRows, onChange]
  );

  const onSheetSelectionChanged = useCallback(() => {
    const selected = sheetGridRef.current?.api.getSelectedRows() ?? [];
    const uid = selected[0]?.uid ?? null;
    setSelectedSheetUid(uid);
    setSelectedItemUid(null);
    const node = uid ? findGuideSheetByUid(records, uid) : null;
    refreshItemRows(node ?? null);
    setStatusGroupRows([]);
  }, [records, refreshItemRows]);

  const onItemSelectionChanged = useCallback(() => {
    const selected = itemGridRef.current?.api.getSelectedRows() ?? [];
    const uid = selected[0]?.uid ?? null;
    setSelectedItemUid(uid);
    const node = selectedSheetNode && uid ? findGuideSheetItemByUid(selectedSheetNode, uid) : null;
    refreshStatusGroupRows(node ?? null);
  }, [selectedSheetNode, refreshStatusGroupRows]);

  const onSheetCellValueChanged = useCallback(
    (e: CellValueChangedEvent<GuideSheetRow>) => {
      const node = findGuideSheetByUid(records, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setGuideSheetField(node, field, String(e.newValue ?? ""));
      refreshSheetRow(node);
      if (field === "guideType" && selectedSheetUid === e.data.uid) {
        refreshItemRows(node);
      }
      flashRow(sheetGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [records, selectedSheetUid, refreshItemRows, refreshSheetRow, flashRow, onChange]
  );

  const onItemCellValueChanged = useCallback(
    (e: CellValueChangedEvent<GuideSheetItemRow>) => {
      if (!selectedSheetNode) return;
      const node = findGuideSheetItemByUid(selectedSheetNode, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setGuideSheetItemField(node, field, String(e.newValue ?? ""));
      refreshItemRow(node);
      if (field === "guideItemStatusGroupName" && selectedItemUid === e.data.uid) {
        refreshStatusGroupRows(node);
      }
      flashRow(itemGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [selectedSheetNode, selectedItemUid, refreshItemRow, refreshStatusGroupRows, flashRow, onChange]
  );

  const onStatusGroupCellValueChanged = useCallback(
    (e: CellValueChangedEvent<GuideSheetItemStatusGroupRow>) => {
      if (!selectedItemNode) return;
      const node = findGuideSheetItemStatusGroupByUid(selectedItemNode, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setGuideSheetItemStatusGroupField(node, field, String(e.newValue ?? ""));
      const updated = toGuideSheetItemStatusGroupRow(node);
      setStatusGroupRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
      flashRow(statusGroupGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [selectedItemNode, flashRow, onChange]
  );

  const addSheetRow = useCallback(() => {
    const num = nextRefIdNumber(records, "GuideSheetModel");
    const node = createGuideSheetNode(num, agencyId);
    records.push(node);
    const row = toGuideSheetRow(node);
    pendingSheetFocusUid.current = row.uid;
    setSheetRows((prev) => [...prev, row]);
    onChange();
  }, [records, agencyId, onChange]);

  const deleteSelectedSheetRows = useCallback(() => {
    const selected = (sheetGridRef.current?.api.getSelectedRows() ?? []) as GuideSheetRow[];
    for (const row of selected) {
      const node = findGuideSheetByUid(records, row.uid);
      if (node) deleteGuideSheet(records, node);
    }
    const deletedUids = new Set(selected.map((r) => r.uid));
    setSheetRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
    if (selectedSheetUid && deletedUids.has(selectedSheetUid)) {
      setSelectedSheetUid(null);
      setSelectedItemUid(null);
      setItemRows([]);
      setStatusGroupRows([]);
    }
    onChange();
  }, [records, selectedSheetUid, onChange]);

  const addItemRow = useCallback(() => {
    if (!selectedSheetNode) return;
    const num = nextRefIdNumber(records, "GuideSheetItemModel");
    const sheetRow = toGuideSheetRow(selectedSheetNode);
    const node = createGuideSheetItemNode(num, sheetRow.guideType, sheetRow.serviceProviderCode);
    getGuideSheetItemNodes(selectedSheetNode).push(node);
    const row = toGuideSheetItemRow(node);
    pendingItemFocusUid.current = row.uid;
    setItemRows((prev) => [...prev, row]);
    refreshSheetRow(selectedSheetNode);
    onChange();
  }, [records, selectedSheetNode, refreshSheetRow, onChange]);

  const deleteSelectedItemRows = useCallback(() => {
    if (!selectedSheetNode) return;
    const selected = (itemGridRef.current?.api.getSelectedRows() ?? []) as GuideSheetItemRow[];
    for (const row of selected) {
      const node = findGuideSheetItemByUid(selectedSheetNode, row.uid);
      if (node) deleteGuideSheetItem(selectedSheetNode, node);
    }
    refreshItemRows(selectedSheetNode);
    refreshSheetRow(selectedSheetNode);
    if (selectedItemUid && selected.some((r) => r.uid === selectedItemUid)) {
      setSelectedItemUid(null);
      setStatusGroupRows([]);
    }
    onChange();
  }, [selectedSheetNode, selectedItemUid, refreshItemRows, refreshSheetRow, onChange]);

  const addStatusGroupRow = useCallback(() => {
    if (!selectedItemNode) return;
    const num = nextRefIdNumber(records, "GuideSheetItemStatusGroupModel");
    const itemRow = toGuideSheetItemRow(selectedItemNode);
    const node = createGuideSheetItemStatusGroupNode(
      num,
      itemRow.guideItemStatusGroupName,
      itemRow.serviceProviderCode
    );
    getGuideSheetItemStatusGroupNodes(selectedItemNode).push(node);
    const row = toGuideSheetItemStatusGroupRow(node);
    pendingStatusGroupFocusUid.current = row.uid;
    setStatusGroupRows((prev) => [...prev, row]);
    refreshItemRow(selectedItemNode);
    onChange();
  }, [records, selectedItemNode, refreshItemRow, onChange]);

  const deleteSelectedStatusGroupRows = useCallback(() => {
    if (!selectedItemNode) return;
    const selected = (statusGroupGridRef.current?.api.getSelectedRows() ??
      []) as GuideSheetItemStatusGroupRow[];
    for (const row of selected) {
      const node = findGuideSheetItemStatusGroupByUid(selectedItemNode, row.uid);
      if (node) deleteGuideSheetItemStatusGroup(selectedItemNode, node);
    }
    refreshStatusGroupRows(selectedItemNode);
    refreshItemRow(selectedItemNode);
    onChange();
  }, [selectedItemNode, refreshStatusGroupRows, refreshItemRow, onChange]);

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
            title={topCollapsed ? "Expand Guide Sheets" : "Collapse Guide Sheets"}
          >
            {topCollapsed ? "▸" : "▾"}
          </button>
          <button className="btn" onClick={addSheetRow}>
            + Add Guide Sheet
          </button>
          <button className="btn btn-danger" onClick={deleteSelectedSheetRows}>
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            Guide Sheets ({sheetRows.length})
            {topCollapsed && selectedSheetNode && (
              <>
                {" — "}
                <strong>{toGuideSheetRow(selectedSheetNode).guideType || "(unnamed)"}</strong>
              </>
            )}
          </span>
        </div>
        {!topCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<GuideSheetRow>
              ref={sheetGridRef}
              rowData={sheetRows}
              columnDefs={sheetColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="single"
              onSelectionChanged={onSheetSelectionChanged}
              onCellValueChanged={onSheetCellValueChanged}
              stopEditingWhenCellsLoseFocus
            />
          </div>
        )}
      </div>

      {!topCollapsed && (
        <div className="resize-handle" onMouseDown={onTopHandleMouseDown} title="Drag to resize" />
      )}

      <div
        className="grid-panel"
        style={{ flex: "0 0 auto", height: midHeight ?? undefined, minHeight: MIN_PANEL_PX }}
      >
        <div className="grid-toolbar">
          <button className="btn" onClick={addItemRow} disabled={!selectedSheetNode}>
            + Add Item
          </button>
          <button
            className="btn btn-danger"
            onClick={deleteSelectedItemRows}
            disabled={!selectedSheetNode}
          >
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {selectedSheetNode
              ? `Items for "${toGuideSheetRow(selectedSheetNode).guideType || "(unnamed)"}" (${itemRows.length})`
              : "Select a Guide Sheet above to see its items"}
          </span>
        </div>
        <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
          <AgGridReact<GuideSheetItemRow>
            ref={itemGridRef}
            rowData={itemRows}
            columnDefs={itemColumnDefs}
            rowHeight={ROW_HEIGHT}
            headerHeight={HEADER_HEIGHT}
            getRowId={(p) => p.data.uid}
            rowSelection="single"
            onSelectionChanged={onItemSelectionChanged}
            onCellValueChanged={onItemCellValueChanged}
            stopEditingWhenCellsLoseFocus
          />
        </div>
      </div>

      <div className="resize-handle" onMouseDown={onMidHandleMouseDown} title="Drag to resize" />

      <div className="grid-panel" style={{ flex: 1, minHeight: MIN_PANEL_PX }}>
        <div className="grid-toolbar">
          <button className="btn" onClick={addStatusGroupRow} disabled={!selectedItemNode}>
            + Add Status Group
          </button>
          <button
            className="btn btn-danger"
            onClick={deleteSelectedStatusGroupRows}
            disabled={!selectedItemNode}
          >
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {selectedItemNode
              ? `Status Groups for "${toGuideSheetItemRow(selectedItemNode).guideItemText || "(unnamed)"}" (${statusGroupRows.length})`
              : "Select an Item above to see its status groups"}
          </span>
        </div>
        <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
          <AgGridReact<GuideSheetItemStatusGroupRow>
            ref={statusGroupGridRef}
            rowData={statusGroupRows}
            columnDefs={statusGroupColumnDefs}
            rowHeight={ROW_HEIGHT}
            headerHeight={HEADER_HEIGHT}
            getRowId={(p) => p.data.uid}
            rowSelection="multiple"
            onCellValueChanged={onStatusGroupCellValueChanged}
            stopEditingWhenCellsLoseFocus
          />
        </div>
      </div>
    </div>
  );
});

export default GuideSheetGrid;
