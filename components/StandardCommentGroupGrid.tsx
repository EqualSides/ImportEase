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
  ARM_DEFS,
  ARM_KEYS,
  type ArmKey,
  PNode,
  StandardCommentGroupRow,
  CommentGroupEntityRow,
  createStandardCommentGroupNode,
  createCommentGroupEntityNode,
  deleteStandardCommentGroup,
  deleteCommentGroupEntity,
  findStandardCommentGroupByUid,
  findCommentGroupEntityByUid,
  getArmNodes,
  nextRefIdNumber,
  setStandardCommentGroupField,
  setCommentGroupEntityField,
  toStandardCommentGroupRow,
  toCommentGroupEntityRow,
} from "@/lib/xml/standardCommentGroup";

/**
 * New "star" grid pattern (see the module doc comment in
 * lib/xml/standardCommentGroup.ts) — one group has five parallel flat
 * child arms instead of one arm that nests further. Rather than five
 * fixed sub-panels, the bottom panel is a single AG Grid whose data
 * source switches between the five arms via a tab strip, since all five
 * share an identical row shape.
 */

export interface StandardCommentGroupGridHandle {
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
  { field: "groupName", headerName: "Group Name", editable: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "isChecklistSelected", headerName: "Checklist?", editable: true, hide: true },
  { field: "isCommentTypeSelected", headerName: "Comment Type?", editable: true, hide: true },
  { field: "isInspectionSelected", headerName: "Inspection?", editable: true, hide: true },
  { field: "isRecordTypeSelected", headerName: "Record Type?", editable: true, hide: true },
  { field: "isWorkflowSelected", headerName: "Workflow?", editable: true, hide: true },
  { field: "checklistCount", headerName: "# Checklist", editable: false },
  { field: "commentTypeCount", headerName: "# Comment Type", editable: false },
  { field: "inspectionCount", headerName: "# Inspection", editable: false },
  { field: "recordCount", headerName: "# Record", editable: false },
  { field: "workflowCount", headerName: "# Workflow", editable: false },
];

const ENTITY_COLUMN_META: ColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "entityData", headerName: "Entity Data", editable: true },
  { field: "entityType", headerName: "Entity Type", editable: true },
  { field: "entitySeqNbr", headerName: "Seq #", editable: true, hide: true },
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

const StandardCommentGroupGrid = forwardRef<StandardCommentGroupGridHandle, Props>(
  function StandardCommentGroupGrid({ records, onChange, gridThemeClass, agencyId }, ref) {
    const [groupRows, setGroupRows] = useState<StandardCommentGroupRow[]>(() =>
      records.map(toStandardCommentGroupRow)
    );
    const [selectedGroupUid, setSelectedGroupUid] = useState<string | null>(
      groupRows[0]?.uid ?? null
    );
    const [selectedArm, setSelectedArm] = useState<ArmKey>("checklist");

    const selectedGroupNode = useMemo(
      () =>
        selectedGroupUid ? findStandardCommentGroupByUid(records, selectedGroupUid) ?? null : null,
      [records, selectedGroupUid]
    );

    const [entityRows, setEntityRows] = useState<CommentGroupEntityRow[]>(() =>
      selectedGroupNode
        ? getArmNodes(selectedGroupNode, selectedArm).map(toCommentGroupEntityRow)
        : []
    );

    const groupGridRef = useRef<AgGridReact<StandardCommentGroupRow>>(null);
    const entityGridRef = useRef<AgGridReact<CommentGroupEntityRow>>(null);
    const pendingGroupFocusUid = useRef<string | null>(null);
    const pendingEntityFocusUid = useRef<string | null>(null);

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
      () => buildColumnDefs<StandardCommentGroupRow>(GROUP_COLUMN_META, groupRows),
      [groupRows]
    );
    const entityColumnDefs = useMemo(
      () => buildColumnDefs<CommentGroupEntityRow>(ENTITY_COLUMN_META, entityRows),
      [entityRows]
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
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "groupName");
      }
    }, [groupRows]);

    useEffect(() => {
      const uid = pendingEntityFocusUid.current;
      pendingEntityFocusUid.current = null;
      if (!uid) return;
      const api = entityGridRef.current?.api;
      const rowNode = api?.getRowNode(uid);
      if (api && rowNode) {
        rowNode.setSelected(true, true);
        api.ensureNodeVisible(rowNode);
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "entityData");
      }
    }, [entityRows]);

    const refreshEntityRows = useCallback((node: PNode | null, arm: ArmKey) => {
      setEntityRows(node ? getArmNodes(node, arm).map(toCommentGroupEntityRow) : []);
    }, []);

    const refreshGroupRow = useCallback((node: PNode) => {
      const updated = toStandardCommentGroupRow(node);
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
            setStandardCommentGroupField(groupNode, "serviceProviderCode", value);
            for (const arm of ARM_KEYS) {
              for (const entityNode of getArmNodes(groupNode, arm)) {
                setCommentGroupEntityField(entityNode, "serviceProviderCode", value);
              }
            }
          }
          setGroupRows(records.map(toStandardCommentGroupRow));
          if (selectedGroupNode) refreshEntityRows(selectedGroupNode, selectedArm);
          onChange();
        },
      }),
      [records, selectedGroupNode, selectedArm, refreshEntityRows, onChange]
    );

    const onGroupSelectionChanged = useCallback(() => {
      const selected = groupGridRef.current?.api.getSelectedRows() ?? [];
      const uid = selected[0]?.uid ?? null;
      setSelectedGroupUid(uid);
      const node = uid ? findStandardCommentGroupByUid(records, uid) : null;
      refreshEntityRows(node ?? null, selectedArm);
    }, [records, selectedArm, refreshEntityRows]);

    const onSelectArm = useCallback(
      (arm: ArmKey) => {
        setSelectedArm(arm);
        refreshEntityRows(selectedGroupNode, arm);
      },
      [selectedGroupNode, refreshEntityRows]
    );

    const onGroupCellValueChanged = useCallback(
      (e: CellValueChangedEvent<StandardCommentGroupRow>) => {
        const node = findStandardCommentGroupByUid(records, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setStandardCommentGroupField(node, field, String(e.newValue ?? ""));
        refreshGroupRow(node);
        if (field === "groupName" && selectedGroupUid === e.data.uid) {
          refreshEntityRows(node, selectedArm);
        }
        flashRow(groupGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [records, selectedGroupUid, selectedArm, refreshEntityRows, refreshGroupRow, flashRow, onChange]
    );

    const onEntityCellValueChanged = useCallback(
      (e: CellValueChangedEvent<CommentGroupEntityRow>) => {
        if (!selectedGroupNode) return;
        const node = findCommentGroupEntityByUid(selectedGroupNode, selectedArm, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setCommentGroupEntityField(node, field, String(e.newValue ?? ""));
        const updated = toCommentGroupEntityRow(node);
        setEntityRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
        flashRow(entityGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [selectedGroupNode, selectedArm, flashRow, onChange]
    );

    const addGroupRow = useCallback(() => {
      const num = nextRefIdNumber(records, "StandardCommentGroupModel");
      const node = createStandardCommentGroupNode(num, agencyId);
      records.push(node);
      const row = toStandardCommentGroupRow(node);
      pendingGroupFocusUid.current = row.uid;
      setGroupRows((prev) => [...prev, row]);
      onChange();
    }, [records, agencyId, onChange]);

    const deleteSelectedGroupRows = useCallback(() => {
      const selected = (groupGridRef.current?.api.getSelectedRows() ??
        []) as StandardCommentGroupRow[];
      for (const row of selected) {
        const node = findStandardCommentGroupByUid(records, row.uid);
        if (node) deleteStandardCommentGroup(records, node);
      }
      const deletedUids = new Set(selected.map((r) => r.uid));
      setGroupRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
      if (selectedGroupUid && deletedUids.has(selectedGroupUid)) {
        setSelectedGroupUid(null);
        setEntityRows([]);
      }
      onChange();
    }, [records, selectedGroupUid, onChange]);

    const addEntityRow = useCallback(() => {
      if (!selectedGroupNode) return;
      const num = nextRefIdNumber(records, "XCommentGroupEntityModel");
      const groupRow = toStandardCommentGroupRow(selectedGroupNode);
      const node = createCommentGroupEntityNode(
        num,
        selectedArm,
        groupRow.groupName,
        groupRow.serviceProviderCode
      );
      getArmNodes(selectedGroupNode, selectedArm).push(node);
      const row = toCommentGroupEntityRow(node);
      pendingEntityFocusUid.current = row.uid;
      setEntityRows((prev) => [...prev, row]);
      refreshGroupRow(selectedGroupNode);
      onChange();
    }, [records, selectedGroupNode, selectedArm, refreshGroupRow, onChange]);

    const deleteSelectedEntityRows = useCallback(() => {
      if (!selectedGroupNode) return;
      const selected = (entityGridRef.current?.api.getSelectedRows() ?? []) as CommentGroupEntityRow[];
      for (const row of selected) {
        const node = findCommentGroupEntityByUid(selectedGroupNode, selectedArm, row.uid);
        if (node) deleteCommentGroupEntity(selectedGroupNode, selectedArm, node);
      }
      refreshEntityRows(selectedGroupNode, selectedArm);
      refreshGroupRow(selectedGroupNode);
      onChange();
    }, [selectedGroupNode, selectedArm, refreshEntityRows, refreshGroupRow, onChange]);

    const armCountField: Record<ArmKey, keyof StandardCommentGroupRow> = {
      checklist: "checklistCount",
      commentType: "commentTypeCount",
      inspection: "inspectionCount",
      record: "recordCount",
      workflow: "workflowCount",
    };
    const selectedGroupRow = selectedGroupNode ? toStandardCommentGroupRow(selectedGroupNode) : null;

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
              title={topPanelCollapsed ? "Expand Standard Comment Groups" : "Collapse Standard Comment Groups"}
            >
              {topPanelCollapsed ? "▸" : "▾"}
            </button>
            <button className="btn" onClick={addGroupRow}>
              + Add Group
            </button>
            <button className="btn btn-danger" onClick={deleteSelectedGroupRows}>
              Delete Selected
            </button>
            <span className="grid-toolbar-label">
              Standard Comment Groups ({groupRows.length})
              {topPanelCollapsed && selectedGroupNode && (
                <>
                  {" — "}
                  <strong>{toStandardCommentGroupRow(selectedGroupNode).groupName || "(unnamed)"}</strong>
                </>
              )}
            </span>
          </div>
          {!topPanelCollapsed && (
            <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
              <AgGridReact<StandardCommentGroupRow>
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

        {!topPanelCollapsed && (
          <div className="resize-handle" onMouseDown={onHandleMouseDown} title="Drag to resize" />
        )}

        <div className="grid-panel" style={{ flex: 1, minHeight: MIN_PANEL_PX }}>
          <div className="grid-toolbar" style={{ flexWrap: "wrap", rowGap: 4 }}>
            {ARM_KEYS.map((arm) => (
              <button
                key={arm}
                className={selectedArm === arm ? "btn btn-choice-active" : "btn"}
                onClick={() => onSelectArm(arm)}
              >
                {ARM_DEFS[arm].label}
                {selectedGroupRow ? ` (${selectedGroupRow[armCountField[arm]]})` : ""}
              </button>
            ))}
          </div>
          <div className="grid-toolbar">
            <button className="btn" onClick={addEntityRow} disabled={!selectedGroupNode}>
              + Add {ARM_DEFS[selectedArm].label}
            </button>
            <button
              className="btn btn-danger"
              onClick={deleteSelectedEntityRows}
              disabled={!selectedGroupNode}
            >
              Delete Selected
            </button>
            <span className="grid-toolbar-label">
              {selectedGroupNode
                ? `${ARM_DEFS[selectedArm].label} entries for "${toStandardCommentGroupRow(selectedGroupNode).groupName || "(unnamed)"}" (${entityRows.length})`
                : "Select a Standard Comment Group above to see its entries"}
            </span>
          </div>
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<CommentGroupEntityRow>
              ref={entityGridRef}
              rowData={entityRows}
              columnDefs={entityColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="multiple"
              onCellValueChanged={onEntityCellValueChanged}
              stopEditingWhenCellsLoseFocus
            />
          </div>
        </div>
      </div>
    );
  }
);

export default StandardCommentGroupGrid;
