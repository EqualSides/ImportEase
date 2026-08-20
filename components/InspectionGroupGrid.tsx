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
  InspectionGroupRow,
  InspectionTypeRow,
  createInspectionGroupNode,
  createInspectionTypeNode,
  deleteInspectionGroup,
  deleteInspectionType,
  findInspectionGroupByUid,
  findInspectionTypeByUid,
  getInspectionTypeNodes,
  setInspectionGroupField,
  setInspectionTypeField,
  toInspectionGroupRow,
  toInspectionTypeRow,
} from "@/lib/xml/inspectionGroup";

export interface InspectionGroupGridHandle {
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
  { field: "inspGroupName", headerName: "Group Name", editable: true },
  { field: "inspCode", headerName: "Inspection Code", editable: true, hide: true },
  { field: "servProvCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "inspectionSec", headerName: "Security Path", editable: true, hide: true },
  { field: "isDepartmentSelected", headerName: "Department?", editable: true, hide: true },
  { field: "isGradeGroupSelected", headerName: "Grade Group?", editable: true, hide: true },
  { field: "isGuideSheetSelected", headerName: "Guide Sheet?", editable: true, hide: true },
  { field: "isRelatedInspSelected", headerName: "Related Insp?", editable: true, hide: true },
  { field: "isResultGroupSelected", headerName: "Result Group?", editable: true, hide: true },
  { field: "isSecutirySelected", headerName: "Security?", editable: true, hide: true },
  { field: "typeCount", headerName: "# Inspection Types", editable: false },
];

const TYPE_COLUMN_META: ColumnMeta[] = [
  { field: "inspType", headerName: "Inspection Type", editable: true },
  { field: "inspResultGroup", headerName: "Result Group", editable: true, hide: true },
  { field: "inspPriority", headerName: "Priority", editable: true, hide: true },
  { field: "inspRequired", headerName: "Required", editable: true, hide: true },
  { field: "inspEditable", headerName: "Editable", editable: true, hide: true },
  { field: "allowFailedGuidesheet", headerName: "Allow Failed Guidesheet", editable: true, hide: true },
  { field: "allowMultiInspInAca", headerName: "Allow Multi (ACA)", editable: true, hide: true },
  { field: "autoAssign", headerName: "Auto Assign", editable: true, hide: true },
  { field: "displayInAca", headerName: "Display in ACA", editable: true, hide: true },
  { field: "flowEnabled", headerName: "Flow Enabled", editable: true, hide: true },
  { field: "grade", headerName: "Grade", editable: true, hide: true },
  { field: "guideGroup", headerName: "Guide Group", editable: true, hide: true },
  { field: "ivrNumber", headerName: "IVR Number", editable: true, hide: true },
  { field: "totalScoreOption", headerName: "Total Score Option", editable: true, hide: true },
  { field: "r3AgencyCode", headerName: "Assigned Agency", editable: true, hide: true },
  { field: "r3BureauCode", headerName: "Assigned Bureau", editable: true, hide: true },
  { field: "r3DivisionCode", headerName: "Assigned Division", editable: true, hide: true },
  { field: "r3GroupCode", headerName: "Assigned Group", editable: true, hide: true },
  { field: "r3OfficeCode", headerName: "Assigned Office", editable: true, hide: true },
  { field: "r3SectionCode", headerName: "Assigned Section", editable: true, hide: true },
  { field: "inspSeqNbr", headerName: "Seq #", editable: true, hide: true },
  { field: "inspCode", headerName: "Inspection Code", editable: false, hide: true },
  { field: "inspGroupName", headerName: "Group Name", editable: false, hide: true },
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

const InspectionGroupGrid = forwardRef<InspectionGroupGridHandle, Props>(
  function InspectionGroupGrid({ records, onChange, gridThemeClass, agencyId }, ref) {
    const [groupRows, setGroupRows] = useState<InspectionGroupRow[]>(() =>
      records.map(toInspectionGroupRow)
    );
    const [selectedUid, setSelectedUid] = useState<string | null>(groupRows[0]?.uid ?? null);

    const selectedNode = useMemo(
      () => (selectedUid ? findInspectionGroupByUid(records, selectedUid) ?? null : null),
      [records, selectedUid]
    );

    const [typeRows, setTypeRows] = useState<InspectionTypeRow[]>(() =>
      selectedNode ? getInspectionTypeNodes(selectedNode).map(toInspectionTypeRow) : []
    );

    const groupGridRef = useRef<AgGridReact<InspectionGroupRow>>(null);
    const typeGridRef = useRef<AgGridReact<InspectionTypeRow>>(null);
    const pendingGroupFocusUid = useRef<string | null>(null);
    const pendingTypeFocusUid = useRef<string | null>(null);

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
      setTopPanelHeight(Math.min(naturalPanelHeight(groupRows.length), soft, cap));
    }, [groupRows.length]);

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

    const groupColumnDefs = useMemo(
      () => buildColumnDefs<InspectionGroupRow>(GROUP_COLUMN_META, groupRows),
      [groupRows]
    );
    const typeColumnDefs = useMemo(
      () => buildColumnDefs<InspectionTypeRow>(TYPE_COLUMN_META, typeRows),
      [typeRows]
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
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "inspGroupName");
      }
    }, [groupRows]);

    useEffect(() => {
      const uid = pendingTypeFocusUid.current;
      pendingTypeFocusUid.current = null;
      if (!uid) return;
      const api = typeGridRef.current?.api;
      const rowNode = api?.getRowNode(uid);
      if (api && rowNode) {
        rowNode.setSelected(true, true);
        api.ensureNodeVisible(rowNode);
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "inspType");
      }
    }, [typeRows]);

    const refreshTypeRows = useCallback((node: PNode | null) => {
      setTypeRows(node ? getInspectionTypeNodes(node).map(toInspectionTypeRow) : []);
    }, []);

    const refreshGroupRow = useCallback((node: PNode) => {
      const updated = toInspectionGroupRow(node);
      setGroupRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
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
            setInspectionGroupField(groupNode, "servProvCode", value);
            for (const typeNode of getInspectionTypeNodes(groupNode)) {
              setInspectionTypeField(typeNode, "servProvCode", value);
            }
          }
          setGroupRows(records.map(toInspectionGroupRow));
          if (selectedNode) refreshTypeRows(selectedNode);
          onChange();
        },
      }),
      [records, selectedNode, refreshTypeRows, onChange]
    );

    const onSelectionChanged = useCallback(() => {
      const selected = groupGridRef.current?.api.getSelectedRows() ?? [];
      const uid = selected[0]?.uid ?? null;
      setSelectedUid(uid);
      const node = uid ? findInspectionGroupByUid(records, uid) : null;
      refreshTypeRows(node ?? null);
    }, [records, refreshTypeRows]);

    const onGroupCellValueChanged = useCallback(
      (e: CellValueChangedEvent<InspectionGroupRow>) => {
        const node = findInspectionGroupByUid(records, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setInspectionGroupField(node, field, String(e.newValue ?? ""));
        refreshGroupRow(node);
        if (
          (field === "inspCode" || field === "inspGroupName" || field === "servProvCode") &&
          selectedUid === e.data.uid
        ) {
          refreshTypeRows(node);
        }
        flashRow(groupGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [records, selectedUid, refreshTypeRows, refreshGroupRow, flashRow, onChange]
    );

    const onTypeCellValueChanged = useCallback(
      (e: CellValueChangedEvent<InspectionTypeRow>) => {
        if (!selectedNode) return;
        const node = findInspectionTypeByUid(selectedNode, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setInspectionTypeField(node, field, String(e.newValue ?? ""));
        const updated = toInspectionTypeRow(node);
        setTypeRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
        flashRow(typeGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [selectedNode, flashRow, onChange]
    );

    const addGroupRow = useCallback(() => {
      const node = createInspectionGroupNode(agencyId);
      records.push(node);
      const row = toInspectionGroupRow(node);
      pendingGroupFocusUid.current = row.uid;
      setGroupRows((prev) => [...prev, row]);
      onChange();
    }, [records, agencyId, onChange]);

    const deleteSelectedGroupRows = useCallback(() => {
      const selected = (groupGridRef.current?.api.getSelectedRows() ?? []) as InspectionGroupRow[];
      for (const row of selected) {
        const node = findInspectionGroupByUid(records, row.uid);
        if (node) deleteInspectionGroup(records, node);
      }
      const deletedUids = new Set(selected.map((r) => r.uid));
      setGroupRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
      if (selectedUid && deletedUids.has(selectedUid)) {
        setSelectedUid(null);
        setTypeRows([]);
      }
      onChange();
    }, [records, selectedUid, onChange]);

    const addTypeRow = useCallback(() => {
      if (!selectedNode) return;
      const groupRow = toInspectionGroupRow(selectedNode);
      const node = createInspectionTypeNode(groupRow.inspCode, groupRow.inspGroupName, groupRow.servProvCode);
      getInspectionTypeNodes(selectedNode).push(node);
      const row = toInspectionTypeRow(node);
      pendingTypeFocusUid.current = row.uid;
      setTypeRows((prev) => [...prev, row]);
      refreshGroupRow(selectedNode);
      onChange();
    }, [selectedNode, refreshGroupRow, onChange]);

    const deleteSelectedTypeRows = useCallback(() => {
      if (!selectedNode) return;
      const selected = (typeGridRef.current?.api.getSelectedRows() ?? []) as InspectionTypeRow[];
      for (const row of selected) {
        const node = findInspectionTypeByUid(selectedNode, row.uid);
        if (node) deleteInspectionType(selectedNode, node);
      }
      refreshTypeRows(selectedNode);
      refreshGroupRow(selectedNode);
      onChange();
    }, [selectedNode, refreshTypeRows, refreshGroupRow, onChange]);

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
              title={topPanelCollapsed ? "Expand Inspection Groups" : "Collapse Inspection Groups"}
            >
              {topPanelCollapsed ? "▸" : "▾"}
            </button>
            <button className="btn" onClick={addGroupRow}>
              + Add Inspection Group
            </button>
            <button className="btn btn-danger" onClick={deleteSelectedGroupRows}>
              Delete Selected
            </button>
            <span className="grid-toolbar-label">
              Inspection Groups ({groupRows.length})
              {topPanelCollapsed && selectedNode && (
                <>
                  {" — "}
                  <strong>{toInspectionGroupRow(selectedNode).inspGroupName || "(unnamed)"}</strong>
                </>
              )}
            </span>
          </div>
          {!topPanelCollapsed && (
            <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
              <AgGridReact<InspectionGroupRow>
                ref={groupGridRef}
                rowData={groupRows}
                columnDefs={groupColumnDefs}
                rowHeight={ROW_HEIGHT}
                headerHeight={HEADER_HEIGHT}
                getRowId={(p) => p.data.uid}
                rowSelection="single"
                onSelectionChanged={onSelectionChanged}
                onCellValueChanged={onGroupCellValueChanged}
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
            <button className="btn" onClick={addTypeRow} disabled={!selectedNode}>
              + Add Inspection Type
            </button>
            <button
              className="btn btn-danger"
              onClick={deleteSelectedTypeRows}
              disabled={!selectedNode}
            >
              Delete Selected
            </button>
            <span className="grid-toolbar-label">
              {selectedNode
                ? `Inspection Types for "${toInspectionGroupRow(selectedNode).inspGroupName || "(unnamed)"}" (${typeRows.length})`
                : "Select an Inspection Group above to see its types"}
            </span>
          </div>
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<InspectionTypeRow>
              ref={typeGridRef}
              rowData={typeRows}
              columnDefs={typeColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="multiple"
              onCellValueChanged={onTypeCellValueChanged}
              stopEditingWhenCellsLoseFocus
            />
          </div>
        </div>
      </div>
    );
  }
);

export default InspectionGroupGrid;
