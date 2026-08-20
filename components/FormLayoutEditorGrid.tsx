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
  FormLayoutScreenRow,
  FormLayoutElementRow,
  createFormLayoutScreenNode,
  createFormLayoutElementNode,
  deleteFormLayoutScreen,
  deleteFormLayoutElement,
  findFormLayoutScreenByUid,
  findFormLayoutElementByUid,
  getFormLayoutElementNodes,
  setFormLayoutScreenField,
  setFormLayoutElementField,
  toFormLayoutScreenRow,
  toFormLayoutElementRow,
} from "@/lib/xml/formLayoutEditor";

export interface FormLayoutEditorGridHandle {
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

const SCREEN_COLUMN_META: ColumnMeta[] = [
  { field: "screenName", headerName: "Screen Name", editable: true },
  { field: "screenLabel", headerName: "Screen Label", editable: true },
  { field: "screenType", headerName: "Type", editable: true, hide: true },
  { field: "screenGroupCode", headerName: "Group Code", editable: true, hide: true },
  { field: "screenId", headerName: "Screen ID", editable: true, hide: true },
  { field: "servProvCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "contractNum", headerName: "Contract #", editable: true, hide: true },
  { field: "expandNum", headerName: "Expand #", editable: true, hide: true },
  { field: "refreshInterval", headerName: "Refresh Interval", editable: true, hide: true },
  { field: "screenHeight", headerName: "Height", editable: true, hide: true },
  { field: "screenWidth", headerName: "Width", editable: true, hide: true },
  { field: "sizeUnit", headerName: "Size Unit", editable: true, hide: true },
  { field: "useLayout2", headerName: "Use Layout 2", editable: true, hide: true },
  { field: "isPermissionSelected", headerName: "Permission Selected", editable: true, hide: true },
  { field: "screenLayout2", headerName: "Layout HTML", editable: true, hide: true },
  { field: "elementCount", headerName: "# Elements", editable: false },
];

const ELEMENT_COLUMN_META: ColumnMeta[] = [
  { field: "screenElementLabel", headerName: "Element Label", editable: true },
  { field: "screenElementName", headerName: "Element Name", editable: true },
  { field: "screenGroupCode", headerName: "Group Code", editable: true, hide: true },
  { field: "screenSubgroupCode", headerName: "Subgroup Code", editable: true, hide: true },
  { field: "elementLeft", headerName: "Left", editable: true, hide: true },
  { field: "elementTop", headerName: "Top", editable: true, hide: true },
  { field: "screenHeight", headerName: "Height", editable: true, hide: true },
  { field: "screenWidth", headerName: "Width", editable: true, hide: true },
  { field: "screenElementId", headerName: "Element ID", editable: true, hide: true },
  { field: "screenId", headerName: "Screen ID", editable: false, hide: true },
  { field: "servProvCode", headerName: "Agency ID", editable: true, hide: true },
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

const FormLayoutEditorGrid = forwardRef<FormLayoutEditorGridHandle, Props>(
  function FormLayoutEditorGrid({ records, onChange, gridThemeClass, agencyId }, ref) {
    const [screenRows, setScreenRows] = useState<FormLayoutScreenRow[]>(() =>
      records.map(toFormLayoutScreenRow)
    );
    const [selectedUid, setSelectedUid] = useState<string | null>(screenRows[0]?.uid ?? null);

    const selectedNode = useMemo(
      () => (selectedUid ? findFormLayoutScreenByUid(records, selectedUid) ?? null : null),
      [records, selectedUid]
    );

    const [elementRows, setElementRows] = useState<FormLayoutElementRow[]>(() =>
      selectedNode ? getFormLayoutElementNodes(selectedNode).map(toFormLayoutElementRow) : []
    );

    const screenGridRef = useRef<AgGridReact<FormLayoutScreenRow>>(null);
    const elementGridRef = useRef<AgGridReact<FormLayoutElementRow>>(null);
    const pendingScreenFocusUid = useRef<string | null>(null);
    const pendingElementFocusUid = useRef<string | null>(null);

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
      const soft = Math.max(MIN_PANEL_PX, available * 0.5);
      setTopPanelHeight(Math.min(naturalPanelHeight(screenRows.length), soft, cap));
    }, [screenRows.length]);

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

    const screenColumnDefs = useMemo(
      () => buildColumnDefs<FormLayoutScreenRow>(SCREEN_COLUMN_META, screenRows),
      [screenRows]
    );
    const elementColumnDefs = useMemo(
      () => buildColumnDefs<FormLayoutElementRow>(ELEMENT_COLUMN_META, elementRows),
      [elementRows]
    );

    useEffect(() => {
      const uid = pendingScreenFocusUid.current;
      pendingScreenFocusUid.current = null;
      if (!uid) return;
      const api = screenGridRef.current?.api;
      const rowNode = api?.getRowNode(uid);
      if (api && rowNode) {
        rowNode.setSelected(true, true);
        api.ensureNodeVisible(rowNode);
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "screenName");
      }
    }, [screenRows]);

    useEffect(() => {
      const uid = pendingElementFocusUid.current;
      pendingElementFocusUid.current = null;
      if (!uid) return;
      const api = elementGridRef.current?.api;
      const rowNode = api?.getRowNode(uid);
      if (api && rowNode) {
        rowNode.setSelected(true, true);
        api.ensureNodeVisible(rowNode);
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "screenElementLabel");
      }
    }, [elementRows]);

    const refreshElementRows = useCallback((node: PNode | null) => {
      setElementRows(node ? getFormLayoutElementNodes(node).map(toFormLayoutElementRow) : []);
    }, []);

    const refreshScreenRow = useCallback((node: PNode) => {
      const updated = toFormLayoutScreenRow(node);
      setScreenRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
    }, []);

    const flashRow = useCallback((api: any, uid: string, field: string) => {
      const rowNode = api?.getRowNode(uid);
      if (api && rowNode) api.flashCells({ rowNodes: [rowNode], columns: [field] });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        applyAgencyIdToAll: (value: string) => {
          for (const screenNode of records) {
            setFormLayoutScreenField(screenNode, "servProvCode", value);
          }
          setScreenRows(records.map(toFormLayoutScreenRow));
          if (selectedNode) refreshElementRows(selectedNode);
          onChange();
        },
      }),
      [records, selectedNode, refreshElementRows, onChange]
    );

    const onSelectionChanged = useCallback(() => {
      const selected = screenGridRef.current?.api.getSelectedRows() ?? [];
      const uid = selected[0]?.uid ?? null;
      setSelectedUid(uid);
      const node = uid ? findFormLayoutScreenByUid(records, uid) : null;
      refreshElementRows(node ?? null);
    }, [records, refreshElementRows]);

    const onScreenCellValueChanged = useCallback(
      (e: CellValueChangedEvent<FormLayoutScreenRow>) => {
        const node = findFormLayoutScreenByUid(records, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setFormLayoutScreenField(node, field, String(e.newValue ?? ""));
        refreshScreenRow(node);
        if ((field === "screenId" || field === "servProvCode") && selectedUid === e.data.uid) {
          refreshElementRows(node);
        }
        flashRow(screenGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [records, selectedUid, refreshElementRows, refreshScreenRow, flashRow, onChange]
    );

    const onElementCellValueChanged = useCallback(
      (e: CellValueChangedEvent<FormLayoutElementRow>) => {
        if (!selectedNode) return;
        const node = findFormLayoutElementByUid(selectedNode, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setFormLayoutElementField(node, field, String(e.newValue ?? ""));
        const updated = toFormLayoutElementRow(node);
        setElementRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
        flashRow(elementGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [selectedNode, flashRow, onChange]
    );

    const addScreenRow = useCallback(() => {
      const node = createFormLayoutScreenNode(agencyId);
      records.push(node);
      const row = toFormLayoutScreenRow(node);
      pendingScreenFocusUid.current = row.uid;
      setScreenRows((prev) => [...prev, row]);
      onChange();
    }, [records, agencyId, onChange]);

    const deleteSelectedScreenRows = useCallback(() => {
      const selected = (screenGridRef.current?.api.getSelectedRows() ?? []) as FormLayoutScreenRow[];
      for (const row of selected) {
        const node = findFormLayoutScreenByUid(records, row.uid);
        if (node) deleteFormLayoutScreen(records, node);
      }
      const deletedUids = new Set(selected.map((r) => r.uid));
      setScreenRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
      if (selectedUid && deletedUids.has(selectedUid)) {
        setSelectedUid(null);
        setElementRows([]);
      }
      onChange();
    }, [records, selectedUid, onChange]);

    const addElementRow = useCallback(() => {
      if (!selectedNode) return;
      const screenRow = toFormLayoutScreenRow(selectedNode);
      const node = createFormLayoutElementNode(screenRow.screenId, screenRow.servProvCode);
      getFormLayoutElementNodes(selectedNode).push(node);
      const row = toFormLayoutElementRow(node);
      pendingElementFocusUid.current = row.uid;
      setElementRows((prev) => [...prev, row]);
      refreshScreenRow(selectedNode);
      onChange();
    }, [selectedNode, refreshScreenRow, onChange]);

    const deleteSelectedElementRows = useCallback(() => {
      if (!selectedNode) return;
      const selected = (elementGridRef.current?.api.getSelectedRows() ?? []) as FormLayoutElementRow[];
      for (const row of selected) {
        const node = findFormLayoutElementByUid(selectedNode, row.uid);
        if (node) deleteFormLayoutElement(selectedNode, node);
      }
      refreshElementRows(selectedNode);
      refreshScreenRow(selectedNode);
      onChange();
    }, [selectedNode, refreshElementRows, refreshScreenRow, onChange]);

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
              title={topPanelCollapsed ? "Expand Screens" : "Collapse Screens"}
            >
              {topPanelCollapsed ? "▸" : "▾"}
            </button>
            <button className="btn" onClick={addScreenRow}>
              + Add Screen
            </button>
            <button className="btn btn-danger" onClick={deleteSelectedScreenRows}>
              Delete Selected
            </button>
            <span className="grid-toolbar-label">
              Screens ({screenRows.length})
              {topPanelCollapsed && selectedNode && (
                <>
                  {" — "}
                  <strong>{toFormLayoutScreenRow(selectedNode).screenName || "(unnamed)"}</strong>
                </>
              )}
            </span>
          </div>
          {!topPanelCollapsed && (
            <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
              <AgGridReact<FormLayoutScreenRow>
                ref={screenGridRef}
                rowData={screenRows}
                columnDefs={screenColumnDefs}
                rowHeight={ROW_HEIGHT}
                headerHeight={HEADER_HEIGHT}
                getRowId={(p) => p.data.uid}
                rowSelection="single"
                onSelectionChanged={onSelectionChanged}
                onCellValueChanged={onScreenCellValueChanged}
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
            <button className="btn" onClick={addElementRow} disabled={!selectedNode}>
              + Add Element
            </button>
            <button
              className="btn btn-danger"
              onClick={deleteSelectedElementRows}
              disabled={!selectedNode}
            >
              Delete Selected
            </button>
            <span className="grid-toolbar-label">
              {selectedNode
                ? `Elements for "${toFormLayoutScreenRow(selectedNode).screenName || "(unnamed)"}" (${elementRows.length})`
                : "Select a Screen above to see its elements"}
            </span>
          </div>
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<FormLayoutElementRow>
              ref={elementGridRef}
              rowData={elementRows}
              columnDefs={elementColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="multiple"
              onCellValueChanged={onElementCellValueChanged}
              stopEditingWhenCellsLoseFocus
            />
          </div>
        </div>
      </div>
    );
  }
);

export default FormLayoutEditorGrid;
