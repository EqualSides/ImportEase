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
  RefFeeScheduleRow,
  RefFeeItemRow,
  FeeScheduleModuleRow,
  createRefFeeScheduleNode,
  createRefFeeItemNode,
  createFeeScheduleModuleNode,
  deleteRefFeeSchedule,
  deleteArmNode,
  findRefFeeScheduleByUid,
  findArmNodeByUid,
  getArmNodes,
  nextRefIdNumber,
  setRefFeeScheduleField,
  setRefFeeItemField,
  setFeeScheduleModuleField,
  toRefFeeScheduleRow,
  toRefFeeItemRow,
  toFeeScheduleModuleRow,
} from "@/lib/xml/refFeeSchedule";

/**
 * A second "star-lite" grid (see StandardCommentGroupGrid.tsx for the
 * first), but unlike that one, this schedule's two arms — fee items and
 * module associations — have structurally different row shapes, so the
 * bottom panel swaps both its column defs and its row-projection/mutation
 * functions when the tab changes, not just its data source.
 */

export interface RefFeeScheduleGridHandle {
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

const SCHEDULE_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "feeScheduleName", headerName: "Fee Schedule Name", editable: true },
  { field: "feeScheduleVersion", headerName: "Version", editable: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "effDate", headerName: "Effective Date", editable: true, hide: true },
  { field: "expDate", headerName: "Expiration Date", editable: true, hide: true },
  { field: "feeScheduleAlias", headerName: "Alias", editable: true, hide: true },
  { field: "feeScheduleComment", headerName: "Comment", editable: true, hide: true },
  { field: "itemCount", headerName: "# Fee Items", editable: false },
  { field: "moduleCount", headerName: "# Modules", editable: false },
];

const ITEM_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "feeCod", headerName: "Fee Code", editable: true },
  { field: "feeDes", headerName: "Description", editable: true },
  { field: "paymentPeriod", headerName: "Payment Period", editable: true },
  { field: "calProc", headerName: "Calc Procedure", editable: true, hide: true },
  { field: "formula", headerName: "Formula", editable: true, hide: true },
  { field: "crDr", headerName: "Cr/Dr", editable: true, hide: true },
  { field: "displayOrder", headerName: "Display Order", editable: true, hide: true },
  { field: "subGroup", headerName: "Subgroup", editable: true, hide: true },
  { field: "udes", headerName: "Unit Description", editable: true, hide: true },
  { field: "defaultFlag", headerName: "Default", editable: true, hide: true },
  { field: "autoAssessFlag", headerName: "Auto Assess", editable: true, hide: true },
  { field: "acaRequiredFlag", headerName: "ACA Required", editable: true, hide: true },
  { field: "roundFeeFlag", headerName: "Round Fee", editable: true, hide: true },
  { field: "roundFeeType", headerName: "Round Type", editable: true, hide: true },
  { field: "feeAllocationType", headerName: "Allocation Type", editable: true, hide: true },
  { field: "feeCodeStatus", headerName: "Status", editable: true, hide: true },
  { field: "negativeFeeFlag", headerName: "Negative Fee", editable: true, hide: true },
  { field: "netFeeFlag", headerName: "Net Fee", editable: true, hide: true },
  { field: "preProc", headerName: "Pre Proc", editable: true, hide: true },
  { field: "qtyIndicator", headerName: "Qty Indicator", editable: true, hide: true },
  { field: "taxFlag", headerName: "Taxable", editable: true, hide: true },
  { field: "appendFlag", headerName: "Append", editable: true, hide: true },
  { field: "accCodeL1", headerName: "Acct Code L1", editable: true, hide: true },
  { field: "accCodeL2", headerName: "Acct Code L2", editable: true, hide: true },
  { field: "accCodeL3", headerName: "Acct Code L3", editable: true, hide: true },
  { field: "udf1", headerName: "UDF1", editable: true, hide: true },
  { field: "udf2", headerName: "UDF2", editable: true, hide: true },
  { field: "udf3", headerName: "UDF3", editable: true, hide: true },
  { field: "udf4", headerName: "UDF4", editable: true, hide: true },
  { field: "feeScheduleName", headerName: "Fee Schedule Name", editable: false, hide: true },
  { field: "feeScheduleVersion", headerName: "Version", editable: false, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
];

const MODULE_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "moduleName", headerName: "Module Name", editable: true },
  { field: "feeCode", headerName: "Fee Code", editable: false, hide: true },
  { field: "servPrvCode", headerName: "Agency ID", editable: true, hide: true },
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

type ArmRow = RefFeeItemRow | FeeScheduleModuleRow;

const RefFeeScheduleGrid = forwardRef<RefFeeScheduleGridHandle, Props>(function RefFeeScheduleGrid(
  { records, onChange, gridThemeClass, agencyId },
  ref
) {
  const [scheduleRows, setScheduleRows] = useState<RefFeeScheduleRow[]>(() =>
    records.map(toRefFeeScheduleRow)
  );
  const [selectedScheduleUid, setSelectedScheduleUid] = useState<string | null>(
    scheduleRows[0]?.uid ?? null
  );
  const [selectedArm, setSelectedArm] = useState<ArmKey>("item");

  const selectedScheduleNode = useMemo(
    () =>
      selectedScheduleUid ? findRefFeeScheduleByUid(records, selectedScheduleUid) ?? null : null,
    [records, selectedScheduleUid]
  );

  const toArmRow = useCallback(
    (arm: ArmKey, node: PNode): ArmRow => (arm === "item" ? toRefFeeItemRow(node) : toFeeScheduleModuleRow(node)),
    []
  );

  const [armRows, setArmRows] = useState<ArmRow[]>(() =>
    selectedScheduleNode ? getArmNodes(selectedScheduleNode, "item").map(toRefFeeItemRow) : []
  );

  const scheduleGridRef = useRef<AgGridReact<RefFeeScheduleRow>>(null);
  const armGridRef = useRef<AgGridReact<ArmRow>>(null);
  const pendingScheduleFocusUid = useRef<string | null>(null);
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
    setTopPanelHeight(Math.min(naturalPanelHeight(scheduleRows.length), soft, cap));
  }, [scheduleRows.length]);

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

  const scheduleColumnDefs = useMemo(
    () => buildColumnDefs<RefFeeScheduleRow>(SCHEDULE_COLUMN_META, scheduleRows),
    [scheduleRows]
  );
  const armColumnDefs = useMemo(
    () =>
      selectedArm === "item"
        ? buildColumnDefs<ArmRow>(ITEM_COLUMN_META, armRows)
        : buildColumnDefs<ArmRow>(MODULE_COLUMN_META, armRows),
    [selectedArm, armRows]
  );

  useEffect(() => {
    const uid = pendingScheduleFocusUid.current;
    pendingScheduleFocusUid.current = null;
    if (!uid) return;
    const api = scheduleGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "feeScheduleName");
    }
  }, [scheduleRows]);

  useEffect(() => {
    const uid = pendingArmFocusUid.current;
    pendingArmFocusUid.current = null;
    if (!uid) return;
    const api = armGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) {
        api.setFocusedCell(rowNode.rowIndex, selectedArm === "item" ? "feeCod" : "moduleName");
      }
    }
  }, [armRows, selectedArm]);

  const refreshArmRows = useCallback(
    (node: PNode | null, arm: ArmKey) => {
      setArmRows(node ? getArmNodes(node, arm).map((n) => toArmRow(arm, n)) : []);
    },
    [toArmRow]
  );

  const refreshScheduleRow = useCallback((node: PNode) => {
    const updated = toRefFeeScheduleRow(node);
    setScheduleRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
  }, []);

  const flashRow = useCallback((api: any, uid: string, field: string) => {
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) api.flashCells({ rowNodes: [rowNode], columns: [field] });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      applyAgencyIdToAll: (value: string) => {
        for (const scheduleNode of records) {
          setRefFeeScheduleField(scheduleNode, "serviceProviderCode", value);
          for (const itemNode of getArmNodes(scheduleNode, "item")) {
            setRefFeeItemField(itemNode, "serviceProviderCode", value);
          }
          for (const modNode of getArmNodes(scheduleNode, "module")) {
            setFeeScheduleModuleField(modNode, "servPrvCode", value);
          }
        }
        setScheduleRows(records.map(toRefFeeScheduleRow));
        if (selectedScheduleNode) refreshArmRows(selectedScheduleNode, selectedArm);
        onChange();
      },
    }),
    [records, selectedScheduleNode, selectedArm, refreshArmRows, onChange]
  );

  const onScheduleSelectionChanged = useCallback(() => {
    const selected = scheduleGridRef.current?.api.getSelectedRows() ?? [];
    const uid = selected[0]?.uid ?? null;
    setSelectedScheduleUid(uid);
    const node = uid ? findRefFeeScheduleByUid(records, uid) : null;
    refreshArmRows(node ?? null, selectedArm);
  }, [records, selectedArm, refreshArmRows]);

  const onSelectArm = useCallback(
    (arm: ArmKey) => {
      setSelectedArm(arm);
      refreshArmRows(selectedScheduleNode, arm);
    },
    [selectedScheduleNode, refreshArmRows]
  );

  const onScheduleCellValueChanged = useCallback(
    (e: CellValueChangedEvent<RefFeeScheduleRow>) => {
      const node = findRefFeeScheduleByUid(records, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setRefFeeScheduleField(node, field, String(e.newValue ?? ""));
      refreshScheduleRow(node);
      if (
        (field === "feeScheduleName" || field === "feeScheduleVersion") &&
        selectedScheduleUid === e.data.uid
      ) {
        refreshArmRows(node, selectedArm);
      }
      flashRow(scheduleGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [records, selectedScheduleUid, selectedArm, refreshArmRows, refreshScheduleRow, flashRow, onChange]
  );

  const onArmCellValueChanged = useCallback(
    (e: CellValueChangedEvent<ArmRow>) => {
      if (!selectedScheduleNode) return;
      const node = findArmNodeByUid(selectedScheduleNode, selectedArm, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      if (selectedArm === "item") {
        setRefFeeItemField(node, field, String(e.newValue ?? ""));
      } else {
        setFeeScheduleModuleField(node, field, String(e.newValue ?? ""));
      }
      const updated = toArmRow(selectedArm, node);
      setArmRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
      flashRow(armGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [selectedScheduleNode, selectedArm, toArmRow, flashRow, onChange]
  );

  const addScheduleRow = useCallback(() => {
    const num = nextRefIdNumber(records, "RefFeeScheduleModel");
    const node = createRefFeeScheduleNode(num, agencyId);
    records.push(node);
    const row = toRefFeeScheduleRow(node);
    pendingScheduleFocusUid.current = row.uid;
    setScheduleRows((prev) => [...prev, row]);
    onChange();
  }, [records, agencyId, onChange]);

  const deleteSelectedScheduleRows = useCallback(() => {
    const selected = (scheduleGridRef.current?.api.getSelectedRows() ?? []) as RefFeeScheduleRow[];
    for (const row of selected) {
      const node = findRefFeeScheduleByUid(records, row.uid);
      if (node) deleteRefFeeSchedule(records, node);
    }
    const deletedUids = new Set(selected.map((r) => r.uid));
    setScheduleRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
    if (selectedScheduleUid && deletedUids.has(selectedScheduleUid)) {
      setSelectedScheduleUid(null);
      setArmRows([]);
    }
    onChange();
  }, [records, selectedScheduleUid, onChange]);

  const addArmRow = useCallback(() => {
    if (!selectedScheduleNode) return;
    const scheduleRow = toRefFeeScheduleRow(selectedScheduleNode);
    const num =
      selectedArm === "item" ? nextRefIdNumber(records, "RefFeeItemModel") : 0;
    const node =
      selectedArm === "item"
        ? createRefFeeItemNode(
            num,
            scheduleRow.feeScheduleName,
            scheduleRow.feeScheduleVersion,
            scheduleRow.serviceProviderCode
          )
        : createFeeScheduleModuleNode(scheduleRow.feeScheduleName, scheduleRow.serviceProviderCode);
    getArmNodes(selectedScheduleNode, selectedArm).push(node);
    const row = toArmRow(selectedArm, node);
    pendingArmFocusUid.current = row.uid;
    setArmRows((prev) => [...prev, row]);
    refreshScheduleRow(selectedScheduleNode);
    onChange();
  }, [records, selectedScheduleNode, selectedArm, toArmRow, refreshScheduleRow, onChange]);

  const deleteSelectedArmRows = useCallback(() => {
    if (!selectedScheduleNode) return;
    const selected = (armGridRef.current?.api.getSelectedRows() ?? []) as ArmRow[];
    for (const row of selected) {
      const node = findArmNodeByUid(selectedScheduleNode, selectedArm, row.uid);
      if (node) deleteArmNode(selectedScheduleNode, selectedArm, node);
    }
    refreshArmRows(selectedScheduleNode, selectedArm);
    refreshScheduleRow(selectedScheduleNode);
    onChange();
  }, [selectedScheduleNode, selectedArm, refreshArmRows, refreshScheduleRow, onChange]);

  const selectedScheduleRow = selectedScheduleNode ? toRefFeeScheduleRow(selectedScheduleNode) : null;
  const armLabel = selectedArm === "item" ? "Fee Item" : "Module";

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
            title={topPanelCollapsed ? "Expand Fee Schedules" : "Collapse Fee Schedules"}
          >
            {topPanelCollapsed ? "▸" : "▾"}
          </button>
          <button className="btn" onClick={addScheduleRow}>
            + Add Fee Schedule
          </button>
          <button className="btn btn-danger" onClick={deleteSelectedScheduleRows}>
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            Fee Schedules ({scheduleRows.length})
            {topPanelCollapsed && selectedScheduleNode && (
              <>
                {" — "}
                <strong>{toRefFeeScheduleRow(selectedScheduleNode).feeScheduleName || "(unnamed)"}</strong>
              </>
            )}
          </span>
        </div>
        {!topPanelCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<RefFeeScheduleRow>
              ref={scheduleGridRef}
              rowData={scheduleRows}
              columnDefs={scheduleColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="single"
              onSelectionChanged={onScheduleSelectionChanged}
              onCellValueChanged={onScheduleCellValueChanged}
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
            className={selectedArm === "item" ? "btn btn-choice-active" : "btn"}
            onClick={() => onSelectArm("item")}
          >
            Fee Items{selectedScheduleRow ? ` (${selectedScheduleRow.itemCount})` : ""}
          </button>
          <button
            className={selectedArm === "module" ? "btn btn-choice-active" : "btn"}
            onClick={() => onSelectArm("module")}
          >
            Modules{selectedScheduleRow ? ` (${selectedScheduleRow.moduleCount})` : ""}
          </button>
        </div>
        <div className="grid-toolbar">
          <button className="btn" onClick={addArmRow} disabled={!selectedScheduleNode}>
            + Add {armLabel}
          </button>
          <button
            className="btn btn-danger"
            onClick={deleteSelectedArmRows}
            disabled={!selectedScheduleNode}
          >
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {selectedScheduleNode
              ? `${armLabel}s for "${toRefFeeScheduleRow(selectedScheduleNode).feeScheduleName || "(unnamed)"}" (${armRows.length})`
              : "Select a Fee Schedule above to see its entries"}
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

export default RefFeeScheduleGrid;
