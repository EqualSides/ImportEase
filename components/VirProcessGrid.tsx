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
  type ArmKey,
  PNode,
  VirProcessRow,
  ProcessTaskRow,
  ProcessEmailSettingRow,
  ActivityStatusRow,
  createVirProcessNode,
  createProcessTaskNode,
  createProcessEmailSettingNode,
  createActivityStatusNode,
  deleteVirProcess,
  deleteArmNode,
  findVirProcessByUid,
  findArmNodeByUid,
  getArmNodes,
  setVirProcessField,
  setProcessTaskField,
  setProcessEmailSettingField,
  setActivityStatusField,
  toVirProcessRow,
  toProcessTaskRow,
  toProcessEmailSettingRow,
  toActivityStatusRow,
} from "@/lib/xml/virProcess";

/**
 * A third "heterogeneous-arm" grid (see RefFeeScheduleGrid.tsx for the
 * first), this time with three editable arms instead of two — workflow
 * tasks, email settings, and activity/status types — each with its own
 * distinct row shape. A fourth arm (processSecurityModels) is genuine
 * security data and is intentionally never surfaced here.
 */

export interface VirProcessGridHandle {
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

const PROCESS_COLUMN_META: ColumnMeta[] = [
  { field: "r1ProcessCode", headerName: "Process Code", editable: true },
  { field: "servProvCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "isEmailSettringSelected", headerName: "Email?", editable: true, hide: true },
  { field: "isSecuritySelected", headerName: "Security?", editable: true, hide: true },
  { field: "isTSISelected", headerName: "TSI?", editable: true, hide: true },
  { field: "taskCount", headerName: "# Tasks", editable: false },
  { field: "emailCount", headerName: "# Email Settings", editable: false },
  { field: "statusCount", headerName: "# Statuses", editable: false },
];

const TASK_COLUMN_META: ColumnMeta[] = [
  { field: "sdProDes", headerName: "Task Description", editable: true },
  { field: "sdAppDes", headerName: "Applicant Description", editable: true, hide: true },
  { field: "sdStpNum", headerName: "Step #", editable: true, hide: true },
  { field: "sdDueDay", headerName: "Due Day", editable: true, hide: true },
  { field: "sdNxtId1", headerName: "Next Step ID", editable: true, hide: true },
  { field: "sdProId1", headerName: "Step ID", editable: true, hide: true },
  { field: "asgnAgencyCode", headerName: "Assigned Agency", editable: true, hide: true },
  { field: "asgnBureauCode", headerName: "Assigned Bureau", editable: true, hide: true },
  { field: "asgnDivisionCode", headerName: "Assigned Division", editable: true, hide: true },
  { field: "asgnGroupCode", headerName: "Assigned Group", editable: true, hide: true },
  { field: "asgnOfficeCode", headerName: "Assigned Office", editable: true, hide: true },
  { field: "asgnSectionCode", headerName: "Assigned Section", editable: true, hide: true },
  { field: "displayInAca", headerName: "Display in ACA", editable: true, hide: true },
  { field: "estimatedHours", headerName: "Est. Hours", editable: true, hide: true },
  { field: "hoursSpentRequired", headerName: "Hours Required", editable: true, hide: true },
  { field: "r1CheckboxCode", headerName: "Checkbox Code", editable: true, hide: true },
  { field: "r1CheckboxGroup", headerName: "Checkbox Group", editable: true, hide: true },
  { field: "sdChkLv5", headerName: "Check Level 5", editable: true, hide: true },
  { field: "r1ProcessCode", headerName: "Process Code", editable: false, hide: true },
  { field: "servProvCode", headerName: "Agency ID", editable: true, hide: true },
];

const EMAIL_COLUMN_META: ColumnMeta[] = [
  { field: "contentsCode", headerName: "Contents Code", editable: true },
  { field: "docCategory", headerName: "Doc Category", editable: true, hide: true },
  { field: "docGroup", headerName: "Doc Group", editable: true, hide: true },
  { field: "sdProDes", headerName: "Task Description", editable: true, hide: true },
  { field: "sdAppDes", headerName: "Applicant Description", editable: true, hide: true },
  { field: "noteID", headerName: "Note ID", editable: true, hide: true },
  { field: "b3contactFlag", headerName: "Contact Flag", editable: true, hide: true },
  { field: "contactRelation", headerName: "Contact Relation", editable: true, hide: true },
  { field: "distributionFlag", headerName: "Distribution Flag", editable: true, hide: true },
  { field: "edmsLocation", headerName: "EDMS Location", editable: true, hide: true },
  { field: "edmsObject", headerName: "EDMS Object", editable: true, hide: true },
  { field: "mediaFlag", headerName: "Media Flag", editable: true, hide: true },
  { field: "processName", headerName: "Process Name", editable: false, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
];

const STATUS_COLUMN_META: ColumnMeta[] = [
  { field: "r3ActStatDes", headerName: "Status Description", editable: true },
  { field: "r3ActTypeDes", headerName: "Activity Type", editable: true, hide: true },
  { field: "r3ActStatCod", headerName: "Status Code", editable: true, hide: true },
  { field: "r3ActStatFlg", headerName: "Status Flag", editable: true, hide: true },
  { field: "applicationStatus", headerName: "Application Status", editable: true, hide: true },
  { field: "parentStatus", headerName: "Parent Status", editable: true, hide: true },
  { field: "displayInAca", headerName: "Display in ACA", editable: true, hide: true },
  { field: "r3ProcessCode", headerName: "Process Code", editable: false, hide: true },
  { field: "servProvCode", headerName: "Agency ID", editable: true, hide: true },
];

const ARM_COLUMN_META: Record<ArmKey, ColumnMeta[]> = {
  task: TASK_COLUMN_META,
  email: EMAIL_COLUMN_META,
  status: STATUS_COLUMN_META,
};

const ARM_LABEL: Record<ArmKey, string> = {
  task: "Task",
  email: "Email Setting",
  status: "Status",
};

const ARM_LABEL_PLURAL: Record<ArmKey, string> = {
  task: "Tasks",
  email: "Email Settings",
  status: "Statuses",
};

const ARM_PRIMARY_FIELD: Record<ArmKey, string> = {
  task: "sdProDes",
  email: "contentsCode",
  status: "r3ActStatDes",
};

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

type ArmRow = ProcessTaskRow | ProcessEmailSettingRow | ActivityStatusRow;

function toArmRow(arm: ArmKey, node: PNode): ArmRow {
  if (arm === "task") return toProcessTaskRow(node);
  if (arm === "email") return toProcessEmailSettingRow(node);
  return toActivityStatusRow(node);
}

function setArmField(arm: ArmKey, node: PNode, field: string, value: string) {
  if (arm === "task") setProcessTaskField(node, field, value);
  else if (arm === "email") setProcessEmailSettingField(node, field, value);
  else setActivityStatusField(node, field, value);
}

const VirProcessGrid = forwardRef<VirProcessGridHandle, Props>(function VirProcessGrid(
  { records, onChange, gridThemeClass, agencyId },
  ref
) {
  const [processRows, setProcessRows] = useState<VirProcessRow[]>(() => records.map(toVirProcessRow));
  const [selectedProcessUid, setSelectedProcessUid] = useState<string | null>(
    processRows[0]?.uid ?? null
  );
  const [selectedArm, setSelectedArm] = useState<ArmKey>("task");

  const selectedProcessNode = useMemo(
    () => (selectedProcessUid ? findVirProcessByUid(records, selectedProcessUid) ?? null : null),
    [records, selectedProcessUid]
  );

  const [armRows, setArmRows] = useState<ArmRow[]>(() =>
    selectedProcessNode ? getArmNodes(selectedProcessNode, "task").map((n) => toArmRow("task", n)) : []
  );

  const processGridRef = useRef<AgGridReact<VirProcessRow>>(null);
  const armGridRef = useRef<AgGridReact<ArmRow>>(null);
  const pendingProcessFocusUid = useRef<string | null>(null);
  const pendingArmFocusUid = useRef<string | null>(null);

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
    const soft = Math.max(MIN_PANEL_PX, available * 0.6);
    setTopPanelHeight(Math.min(naturalPanelHeight(processRows.length), soft, cap));
  }, [processRows.length]);

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

  const processColumnDefs = useMemo(
    () => buildColumnDefs<VirProcessRow>(PROCESS_COLUMN_META, processRows),
    [processRows]
  );
  const armColumnDefs = useMemo(
    () => buildColumnDefs<ArmRow>(ARM_COLUMN_META[selectedArm], armRows),
    [selectedArm, armRows]
  );

  useEffect(() => {
    const uid = pendingProcessFocusUid.current;
    pendingProcessFocusUid.current = null;
    if (!uid) return;
    const api = processGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "r1ProcessCode");
    }
  }, [processRows]);

  useEffect(() => {
    const uid = pendingArmFocusUid.current;
    pendingArmFocusUid.current = null;
    if (!uid) return;
    const api = armGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, ARM_PRIMARY_FIELD[selectedArm]);
    }
  }, [armRows, selectedArm]);

  const refreshArmRows = useCallback((node: PNode | null, arm: ArmKey) => {
    setArmRows(node ? getArmNodes(node, arm).map((n) => toArmRow(arm, n)) : []);
  }, []);

  const refreshProcessRow = useCallback((node: PNode) => {
    const updated = toVirProcessRow(node);
    setProcessRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
  }, []);

  const flashRow = useCallback((api: any, uid: string, field: string) => {
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) api.flashCells({ rowNodes: [rowNode], columns: [field] });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      applyAgencyIdToAll: (value: string) => {
        for (const processNode of records) {
          setVirProcessField(processNode, "servProvCode", value);
        }
        setProcessRows(records.map(toVirProcessRow));
        if (selectedProcessNode) refreshArmRows(selectedProcessNode, selectedArm);
        onChange();
      },
    }),
    [records, selectedProcessNode, selectedArm, refreshArmRows, onChange]
  );

  const onProcessSelectionChanged = useCallback(() => {
    const selected = processGridRef.current?.api.getSelectedRows() ?? [];
    const uid = selected[0]?.uid ?? null;
    setSelectedProcessUid(uid);
    const node = uid ? findVirProcessByUid(records, uid) : null;
    refreshArmRows(node ?? null, selectedArm);
  }, [records, selectedArm, refreshArmRows]);

  const onSelectArm = useCallback(
    (arm: ArmKey) => {
      setSelectedArm(arm);
      refreshArmRows(selectedProcessNode, arm);
    },
    [selectedProcessNode, refreshArmRows]
  );

  const onProcessCellValueChanged = useCallback(
    (e: CellValueChangedEvent<VirProcessRow>) => {
      const node = findVirProcessByUid(records, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setVirProcessField(node, field, String(e.newValue ?? ""));
      refreshProcessRow(node);
      if ((field === "r1ProcessCode" || field === "servProvCode") && selectedProcessUid === e.data.uid) {
        refreshArmRows(node, selectedArm);
      }
      flashRow(processGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [records, selectedProcessUid, selectedArm, refreshArmRows, refreshProcessRow, flashRow, onChange]
  );

  const onArmCellValueChanged = useCallback(
    (e: CellValueChangedEvent<ArmRow>) => {
      if (!selectedProcessNode) return;
      const node = findArmNodeByUid(selectedProcessNode, selectedArm, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setArmField(selectedArm, node, field, String(e.newValue ?? ""));
      const updated = toArmRow(selectedArm, node);
      setArmRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
      flashRow(armGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [selectedProcessNode, selectedArm, flashRow, onChange]
  );

  const addProcessRow = useCallback(() => {
    const node = createVirProcessNode(agencyId);
    records.push(node);
    const row = toVirProcessRow(node);
    pendingProcessFocusUid.current = row.uid;
    setProcessRows((prev) => [...prev, row]);
    onChange();
  }, [records, agencyId, onChange]);

  const deleteSelectedProcessRows = useCallback(() => {
    const selected = (processGridRef.current?.api.getSelectedRows() ?? []) as VirProcessRow[];
    for (const row of selected) {
      const node = findVirProcessByUid(records, row.uid);
      if (node) deleteVirProcess(records, node);
    }
    const deletedUids = new Set(selected.map((r) => r.uid));
    setProcessRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
    if (selectedProcessUid && deletedUids.has(selectedProcessUid)) {
      setSelectedProcessUid(null);
      setArmRows([]);
    }
    onChange();
  }, [records, selectedProcessUid, onChange]);

  const addArmRow = useCallback(() => {
    if (!selectedProcessNode) return;
    const processRow = toVirProcessRow(selectedProcessNode);
    const node =
      selectedArm === "task"
        ? createProcessTaskNode(processRow.r1ProcessCode, processRow.servProvCode)
        : selectedArm === "email"
          ? createProcessEmailSettingNode(processRow.r1ProcessCode, processRow.servProvCode)
          : createActivityStatusNode(processRow.r1ProcessCode, processRow.servProvCode);
    getArmNodes(selectedProcessNode, selectedArm).push(node);
    const row = toArmRow(selectedArm, node);
    pendingArmFocusUid.current = row.uid;
    setArmRows((prev) => [...prev, row]);
    refreshProcessRow(selectedProcessNode);
    onChange();
  }, [selectedProcessNode, selectedArm, refreshProcessRow, onChange]);

  const deleteSelectedArmRows = useCallback(() => {
    if (!selectedProcessNode) return;
    const selected = (armGridRef.current?.api.getSelectedRows() ?? []) as ArmRow[];
    for (const row of selected) {
      const node = findArmNodeByUid(selectedProcessNode, selectedArm, row.uid);
      if (node) deleteArmNode(selectedProcessNode, selectedArm, node);
    }
    refreshArmRows(selectedProcessNode, selectedArm);
    refreshProcessRow(selectedProcessNode);
    onChange();
  }, [selectedProcessNode, selectedArm, refreshArmRows, refreshProcessRow, onChange]);

  const selectedProcessRow = selectedProcessNode ? toVirProcessRow(selectedProcessNode) : null;

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
            title={topPanelCollapsed ? "Expand Processes" : "Collapse Processes"}
          >
            {topPanelCollapsed ? "▸" : "▾"}
          </button>
          <button className="btn" onClick={addProcessRow}>
            + Add Process
          </button>
          <button className="btn btn-danger" onClick={deleteSelectedProcessRows}>
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            Processes ({processRows.length})
            {topPanelCollapsed && selectedProcessNode && (
              <>
                {" — "}
                <strong>{toVirProcessRow(selectedProcessNode).r1ProcessCode || "(unnamed)"}</strong>
              </>
            )}
          </span>
        </div>
        {!topPanelCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<VirProcessRow>
              ref={processGridRef}
              rowData={processRows}
              columnDefs={processColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="single"
              onSelectionChanged={onProcessSelectionChanged}
              onCellValueChanged={onProcessCellValueChanged}
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
          <button
            className={selectedArm === "task" ? "btn btn-choice-active" : "btn"}
            onClick={() => onSelectArm("task")}
          >
            Tasks{selectedProcessRow ? ` (${selectedProcessRow.taskCount})` : ""}
          </button>
          <button
            className={selectedArm === "email" ? "btn btn-choice-active" : "btn"}
            onClick={() => onSelectArm("email")}
          >
            Email Settings{selectedProcessRow ? ` (${selectedProcessRow.emailCount})` : ""}
          </button>
          <button
            className={selectedArm === "status" ? "btn btn-choice-active" : "btn"}
            onClick={() => onSelectArm("status")}
          >
            Statuses{selectedProcessRow ? ` (${selectedProcessRow.statusCount})` : ""}
          </button>
        </div>
        <div className="grid-toolbar">
          <button className="btn" onClick={addArmRow} disabled={!selectedProcessNode}>
            + Add {ARM_LABEL[selectedArm]}
          </button>
          <button
            className="btn btn-danger"
            onClick={deleteSelectedArmRows}
            disabled={!selectedProcessNode}
          >
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {selectedProcessNode
              ? `${ARM_LABEL_PLURAL[selectedArm]} for "${toVirProcessRow(selectedProcessNode).r1ProcessCode || "(unnamed)"}" (${armRows.length})`
              : "Select a Process above to see its entries"}
          </span>
        </div>
        <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
          <AgGridReact<ArmRow>
            ref={armGridRef}
            rowData={armRows}
            columnDefs={armColumnDefs}
            rowHeight={ROW_HEIGHT}
            headerHeight={HEADER_HEIGHT}
            getRowId={(p) => p.data.uid}
            rowSelection="multiple"
            onCellValueChanged={onArmCellValueChanged}
            stopEditingWhenCellsLoseFocus
          />
        </div>
      </div>
    </div>
  );
});

export default VirProcessGrid;
