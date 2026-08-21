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
  SmartChoiceGroupRow,
  SmartChoiceRow,
  SmartChoiceOptionRow,
  createSmartChoiceGroupNode,
  createSmartChoiceNode,
  createSmartChoiceOptionNode,
  deleteSmartChoiceGroup,
  deleteSmartChoice,
  deleteSmartChoiceOption,
  findSmartChoiceGroupByUid,
  findSmartChoiceByUid,
  findSmartChoiceOptionByUid,
  getSmartChoiceNodes,
  getSmartChoiceOptionNodes,
  nextRefIdNumber,
  setSmartChoiceGroupField,
  setSmartChoiceField,
  setSmartChoiceOptionField,
  toSmartChoiceGroupRow,
  toSmartChoiceRow,
  toSmartChoiceOptionRow,
} from "@/lib/xml/smartChoiceGroup";

/** Third three-level grid in the app (see RefLookupTableGrid.tsx and GuideSheetGrid.tsx) — group -> smart choice -> option. Same three-stacked-panel structure. */

export interface SmartChoiceGroupGridHandle {
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

const GROUP_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "groupCode", headerName: "Group Code", editable: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "choiceCount", headerName: "# Smart Choices", editable: false },
];

const CHOICE_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "functionName", headerName: "Function Name", editable: true },
  { field: "displayFlg", headerName: "Display", editable: true, hide: true },
  { field: "displayOrder", headerName: "Display Order", editable: true, hide: true },
  { field: "requiredFlg", headerName: "Required", editable: true, hide: true },
  { field: "validateFlg", headerName: "Validate", editable: true, hide: true },
  { field: "defaultValue", headerName: "Default Value", editable: true, hide: true },
  { field: "groupName", headerName: "Group Name", editable: false, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "optionCount", headerName: "# Options", editable: false },
];

const OPTION_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "functionOption", headerName: "Function Option", editable: true },
  { field: "optionQuantity", headerName: "Quantity", editable: true },
  { field: "functionName", headerName: "Function Name", editable: false, hide: true },
  { field: "groupName", headerName: "Group Name", editable: false, hide: true },
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

const SmartChoiceGroupGrid = forwardRef<SmartChoiceGroupGridHandle, Props>(
  function SmartChoiceGroupGrid({ records, onChange, gridThemeClass, agencyId }, ref) {
    const [groupRows, setGroupRows] = useState<SmartChoiceGroupRow[]>(() =>
      records.map(toSmartChoiceGroupRow)
    );
    const [selectedGroupUid, setSelectedGroupUid] = useState<string | null>(
      groupRows[0]?.uid ?? null
    );

    const selectedGroupNode = useMemo(
      () => (selectedGroupUid ? findSmartChoiceGroupByUid(records, selectedGroupUid) ?? null : null),
      [records, selectedGroupUid]
    );

    const [choiceRows, setChoiceRows] = useState<SmartChoiceRow[]>(() =>
      selectedGroupNode ? getSmartChoiceNodes(selectedGroupNode).map(toSmartChoiceRow) : []
    );
    const [selectedChoiceUid, setSelectedChoiceUid] = useState<string | null>(
      choiceRows[0]?.uid ?? null
    );

    const selectedChoiceNode = useMemo(
      () =>
        selectedGroupNode && selectedChoiceUid
          ? findSmartChoiceByUid(selectedGroupNode, selectedChoiceUid) ?? null
          : null,
      [selectedGroupNode, selectedChoiceUid]
    );

    const [optionRows, setOptionRows] = useState<SmartChoiceOptionRow[]>(() =>
      selectedChoiceNode ? getSmartChoiceOptionNodes(selectedChoiceNode).map(toSmartChoiceOptionRow) : []
    );

    const groupGridRef = useRef<AgGridReact<SmartChoiceGroupRow>>(null);
    const choiceGridRef = useRef<AgGridReact<SmartChoiceRow>>(null);
    const optionGridRef = useRef<AgGridReact<SmartChoiceOptionRow>>(null);
    const pendingGroupFocusUid = useRef<string | null>(null);
    const pendingChoiceFocusUid = useRef<string | null>(null);
    const pendingOptionFocusUid = useRef<string | null>(null);

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
      const t = Math.min(naturalPanelHeight(groupRows.length), Math.max(MIN_PANEL_PX, available * 0.34));
      const m = Math.min(naturalPanelHeight(choiceRows.length), Math.max(MIN_PANEL_PX, available * 0.33));
      const cap = Math.max(MIN_PANEL_PX, available - reserve + 2 * MIN_PANEL_PX);
      setTopHeight(Math.min(t, cap));
      setMidHeight(Math.min(m, cap));
    }, [groupRows.length, choiceRows.length]);

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

    const groupColumnDefs = useMemo(
      () => buildColumnDefs<SmartChoiceGroupRow>(GROUP_COLUMN_META, groupRows),
      [groupRows]
    );
    const choiceColumnDefs = useMemo(
      () => buildColumnDefs<SmartChoiceRow>(CHOICE_COLUMN_META, choiceRows),
      [choiceRows]
    );
    const optionColumnDefs = useMemo(
      () => buildColumnDefs<SmartChoiceOptionRow>(OPTION_COLUMN_META, optionRows),
      [optionRows]
    );

    useEffect(() => {
      const uid = pendingGroupFocusUid.current;
      pendingGroupFocusUid.current = null;
      if (!uid) return;
      const api = groupGridRef.current?.api;
      const rowNode = api?.getRowNode(uid);
      if (api && rowNode) {
        rowNode.setSelected(true, true);
        api.ensureNodeVisible(rowNode);
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "groupCode");
      }
    }, [groupRows]);

    useEffect(() => {
      const uid = pendingChoiceFocusUid.current;
      pendingChoiceFocusUid.current = null;
      if (!uid) return;
      const api = choiceGridRef.current?.api;
      const rowNode = api?.getRowNode(uid);
      if (api && rowNode) {
        rowNode.setSelected(true, true);
        api.ensureNodeVisible(rowNode);
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "functionName");
      }
    }, [choiceRows]);

    useEffect(() => {
      const uid = pendingOptionFocusUid.current;
      pendingOptionFocusUid.current = null;
      if (!uid) return;
      const api = optionGridRef.current?.api;
      const rowNode = api?.getRowNode(uid);
      if (api && rowNode) {
        rowNode.setSelected(true, true);
        api.ensureNodeVisible(rowNode);
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "functionOption");
      }
    }, [optionRows]);

    const refreshChoiceRows = useCallback((node: PNode | null) => {
      setChoiceRows(node ? getSmartChoiceNodes(node).map(toSmartChoiceRow) : []);
    }, []);

    const refreshOptionRows = useCallback((node: PNode | null) => {
      setOptionRows(node ? getSmartChoiceOptionNodes(node).map(toSmartChoiceOptionRow) : []);
    }, []);

    const refreshGroupRow = useCallback((node: PNode) => {
      const updated = toSmartChoiceGroupRow(node);
      setGroupRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
    }, []);

    const refreshChoiceRow = useCallback((node: PNode) => {
      const updated = toSmartChoiceRow(node);
      setChoiceRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
    }, []);

    const flashRow = useCallback((api: any, uid: string, field: string) => {
      const rowNode = api?.getRowNode(uid);
      if (api && rowNode) api.flashCells({ rowNodes: [rowNode], columns: [field] });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        applyAgencyIdToAll: (value: string) => {
          for (const groupNode of records) {
            setSmartChoiceGroupField(groupNode, "serviceProviderCode", value);
            for (const choiceNode of getSmartChoiceNodes(groupNode)) {
              setSmartChoiceField(choiceNode, "serviceProviderCode", value);
              for (const optNode of getSmartChoiceOptionNodes(choiceNode)) {
                setSmartChoiceOptionField(optNode, "serviceProviderCode", value);
              }
            }
          }
          setGroupRows(records.map(toSmartChoiceGroupRow));
          if (selectedGroupNode) refreshChoiceRows(selectedGroupNode);
          if (selectedChoiceNode) refreshOptionRows(selectedChoiceNode);
          onChange();
        },
      }),
      [records, selectedGroupNode, selectedChoiceNode, refreshChoiceRows, refreshOptionRows, onChange]
    );

    const onGroupSelectionChanged = useCallback(() => {
      const selected = groupGridRef.current?.api.getSelectedRows() ?? [];
      const uid = selected[0]?.uid ?? null;
      setSelectedGroupUid(uid);
      setSelectedChoiceUid(null);
      const node = uid ? findSmartChoiceGroupByUid(records, uid) : null;
      refreshChoiceRows(node ?? null);
      setOptionRows([]);
    }, [records, refreshChoiceRows]);

    const onChoiceSelectionChanged = useCallback(() => {
      const selected = choiceGridRef.current?.api.getSelectedRows() ?? [];
      const uid = selected[0]?.uid ?? null;
      setSelectedChoiceUid(uid);
      const node = selectedGroupNode && uid ? findSmartChoiceByUid(selectedGroupNode, uid) : null;
      refreshOptionRows(node ?? null);
    }, [selectedGroupNode, refreshOptionRows]);

    const onGroupCellValueChanged = useCallback(
      (e: CellValueChangedEvent<SmartChoiceGroupRow>) => {
        const node = findSmartChoiceGroupByUid(records, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setSmartChoiceGroupField(node, field, String(e.newValue ?? ""));
        refreshGroupRow(node);
        if (field === "groupCode" && selectedGroupUid === e.data.uid) {
          refreshChoiceRows(node);
        }
        flashRow(groupGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [records, selectedGroupUid, refreshChoiceRows, refreshGroupRow, flashRow, onChange]
    );

    const onChoiceCellValueChanged = useCallback(
      (e: CellValueChangedEvent<SmartChoiceRow>) => {
        if (!selectedGroupNode) return;
        const node = findSmartChoiceByUid(selectedGroupNode, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setSmartChoiceField(node, field, String(e.newValue ?? ""));
        refreshChoiceRow(node);
        if (field === "functionName" && selectedChoiceUid === e.data.uid) {
          refreshOptionRows(node);
        }
        flashRow(choiceGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [selectedGroupNode, selectedChoiceUid, refreshChoiceRow, refreshOptionRows, flashRow, onChange]
    );

    const onOptionCellValueChanged = useCallback(
      (e: CellValueChangedEvent<SmartChoiceOptionRow>) => {
        if (!selectedChoiceNode) return;
        const node = findSmartChoiceOptionByUid(selectedChoiceNode, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setSmartChoiceOptionField(node, field, String(e.newValue ?? ""));
        const updated = toSmartChoiceOptionRow(node);
        setOptionRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
        flashRow(optionGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [selectedChoiceNode, flashRow, onChange]
    );

    const addGroupRow = useCallback(() => {
      const num = nextRefIdNumber(records, "SmartChoiceGroupModel");
      const node = createSmartChoiceGroupNode(num, agencyId);
      records.push(node);
      const row = toSmartChoiceGroupRow(node);
      pendingGroupFocusUid.current = row.uid;
      setGroupRows((prev) => [...prev, row]);
      onChange();
    }, [records, agencyId, onChange]);

    const deleteSelectedGroupRows = useCallback(() => {
      const selected = (groupGridRef.current?.api.getSelectedRows() ?? []) as SmartChoiceGroupRow[];
      for (const row of selected) {
        const node = findSmartChoiceGroupByUid(records, row.uid);
        if (node) deleteSmartChoiceGroup(records, node);
      }
      const deletedUids = new Set(selected.map((r) => r.uid));
      setGroupRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
      if (selectedGroupUid && deletedUids.has(selectedGroupUid)) {
        setSelectedGroupUid(null);
        setSelectedChoiceUid(null);
        setChoiceRows([]);
        setOptionRows([]);
      }
      onChange();
    }, [records, selectedGroupUid, onChange]);

    const addChoiceRow = useCallback(() => {
      if (!selectedGroupNode) return;
      const groupRow = toSmartChoiceGroupRow(selectedGroupNode);
      const node = createSmartChoiceNode(groupRow.groupCode, groupRow.serviceProviderCode);
      getSmartChoiceNodes(selectedGroupNode).push(node);
      const row = toSmartChoiceRow(node);
      pendingChoiceFocusUid.current = row.uid;
      setChoiceRows((prev) => [...prev, row]);
      refreshGroupRow(selectedGroupNode);
      onChange();
    }, [selectedGroupNode, refreshGroupRow, onChange]);

    const deleteSelectedChoiceRows = useCallback(() => {
      if (!selectedGroupNode) return;
      const selected = (choiceGridRef.current?.api.getSelectedRows() ?? []) as SmartChoiceRow[];
      for (const row of selected) {
        const node = findSmartChoiceByUid(selectedGroupNode, row.uid);
        if (node) deleteSmartChoice(selectedGroupNode, node);
      }
      refreshChoiceRows(selectedGroupNode);
      refreshGroupRow(selectedGroupNode);
      if (selectedChoiceUid && selected.some((r) => r.uid === selectedChoiceUid)) {
        setSelectedChoiceUid(null);
        setOptionRows([]);
      }
      onChange();
    }, [selectedGroupNode, selectedChoiceUid, refreshChoiceRows, refreshGroupRow, onChange]);

    const addOptionRow = useCallback(() => {
      if (!selectedChoiceNode) return;
      const choiceRow = toSmartChoiceRow(selectedChoiceNode);
      const node = createSmartChoiceOptionNode(
        choiceRow.functionName,
        choiceRow.groupName,
        choiceRow.serviceProviderCode
      );
      getSmartChoiceOptionNodes(selectedChoiceNode).push(node);
      const row = toSmartChoiceOptionRow(node);
      pendingOptionFocusUid.current = row.uid;
      setOptionRows((prev) => [...prev, row]);
      refreshChoiceRow(selectedChoiceNode);
      onChange();
    }, [selectedChoiceNode, refreshChoiceRow, onChange]);

    const deleteSelectedOptionRows = useCallback(() => {
      if (!selectedChoiceNode) return;
      const selected = (optionGridRef.current?.api.getSelectedRows() ?? []) as SmartChoiceOptionRow[];
      for (const row of selected) {
        const node = findSmartChoiceOptionByUid(selectedChoiceNode, row.uid);
        if (node) deleteSmartChoiceOption(selectedChoiceNode, node);
      }
      refreshOptionRows(selectedChoiceNode);
      refreshChoiceRow(selectedChoiceNode);
      onChange();
    }, [selectedChoiceNode, refreshOptionRows, refreshChoiceRow, onChange]);

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
              title={topCollapsed ? "Expand Smart Choice Groups" : "Collapse Smart Choice Groups"}
            >
              {topCollapsed ? "▸" : "▾"}
            </button>
            <button className="btn" onClick={addGroupRow}>
              + Add Smart Choice Group
            </button>
            <button className="btn btn-danger" onClick={deleteSelectedGroupRows}>
              Delete Selected
            </button>
            <span className="grid-toolbar-label">
              Smart Choice Groups ({groupRows.length})
              {topCollapsed && selectedGroupNode && (
                <>
                  {" — "}
                  <strong>{toSmartChoiceGroupRow(selectedGroupNode).groupCode || "(unnamed)"}</strong>
                </>
              )}
            </span>
          </div>
          {!topCollapsed && (
            <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
              <AgGridReact<SmartChoiceGroupRow>
                ref={groupGridRef}
                rowData={groupRows}
                columnDefs={groupColumnDefs}
                rowHeight={ROW_HEIGHT}
                headerHeight={HEADER_HEIGHT}
                getRowId={(p) => p.data.uid}
                rowSelection="single"
                onSelectionChanged={onGroupSelectionChanged}
                onCellValueChanged={onGroupCellValueChanged}
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
              title={midCollapsed ? "Expand Smart Choices" : "Collapse Smart Choices"}
            >
              {midCollapsed ? "▸" : "▾"}
            </button>
            <button className="btn" onClick={addChoiceRow} disabled={!selectedGroupNode}>
              + Add Smart Choice
            </button>
            <button
              className="btn btn-danger"
              onClick={deleteSelectedChoiceRows}
              disabled={!selectedGroupNode}
            >
              Delete Selected
            </button>
            <span className="grid-toolbar-label">
              {selectedGroupNode
                ? `Smart Choices for "${toSmartChoiceGroupRow(selectedGroupNode).groupCode || "(unnamed)"}" (${choiceRows.length})`
                : "Select a Smart Choice Group above to see its smart choices"}
              {midCollapsed && selectedChoiceNode && (
                <>
                  {" — "}
                  <strong>{toSmartChoiceRow(selectedChoiceNode).functionName || "(unnamed)"}</strong>
                </>
              )}
            </span>
          </div>
          {!midCollapsed && (
            <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
              <AgGridReact<SmartChoiceRow>
                ref={choiceGridRef}
                rowData={choiceRows}
                columnDefs={choiceColumnDefs}
                rowHeight={ROW_HEIGHT}
                headerHeight={HEADER_HEIGHT}
                getRowId={(p) => p.data.uid}
                rowSelection="single"
                onSelectionChanged={onChoiceSelectionChanged}
                onCellValueChanged={onChoiceCellValueChanged}
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
              title={bottomCollapsed ? "Expand Options" : "Collapse Options"}
            >
              {bottomCollapsed ? "▸" : "▾"}
            </button>
            <button className="btn" onClick={addOptionRow} disabled={!selectedChoiceNode}>
              + Add Option
            </button>
            <button
              className="btn btn-danger"
              onClick={deleteSelectedOptionRows}
              disabled={!selectedChoiceNode}
            >
              Delete Selected
            </button>
            <span className="grid-toolbar-label">
              {selectedChoiceNode
                ? `Options for "${toSmartChoiceRow(selectedChoiceNode).functionName || "(unnamed)"}" (${optionRows.length})`
                : "Select a Smart Choice above to see its options"}
            </span>
          </div>
          {!bottomCollapsed && (
            <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
              <AgGridReact<SmartChoiceOptionRow>
                ref={optionGridRef}
                rowData={optionRows}
                columnDefs={optionColumnDefs}
                rowHeight={ROW_HEIGHT}
                headerHeight={HEADER_HEIGHT}
                getRowId={(p) => p.data.uid}
                rowSelection="multiple"
                onCellValueChanged={onOptionCellValueChanged}
                stopEditingWhenCellsLoseFocus
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default SmartChoiceGroupGrid;
