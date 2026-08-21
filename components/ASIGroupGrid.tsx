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
  ASIGroupRow,
  ASIFieldRow,
  ASIDropdownValueRow,
  createASIGroupNode,
  createASIFieldNode,
  createASIDropdownValueNode,
  deleteASIGroup,
  deleteASIField,
  deleteASIDropdownValue,
  findASIGroupByUid,
  findASIFieldByUid,
  findASIDropdownValueByUid,
  getASIFieldNodes,
  getASIDropdownValueNodes,
  setASIGroupField,
  setASIFieldField,
  setASIDropdownValueField,
  toASIGroupRow,
  toASIFieldRow,
  toASIDropdownValueRow,
} from "@/lib/xml/asiGroup";

/** Fourth three-level grid in the app (see SmartChoiceGroupGrid.tsx for the third) — group -> ASI field -> dropdown value. Same three-stacked-panel structure. */

export interface ASIGroupGridHandle {
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
  { field: "appSpecInfoGroupCode", headerName: "Group Code", editable: true },
  { field: "r1CheckboxGroup", headerName: "Checkbox Group", editable: true, hide: true },
  { field: "r1CheckboxType", headerName: "Checkbox Type", editable: true, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "isASITSelected", headerName: "TSI Selected?", editable: true, hide: true },
  { field: "isSecuritySelected", headerName: "Security Selected?", editable: true, hide: true },
  { field: "fieldCount", headerName: "# ASI Fields", editable: false },
];

const FIELD_COLUMN_META: ColumnMeta[] = [
  { field: "r1CheckboxDesc", headerName: "Field Description", editable: true },
  { field: "r1CheckboxCode", headerName: "Checkbox Code", editable: false, hide: true },
  { field: "r1CheckboxGroup", headerName: "Checkbox Group", editable: false, hide: true },
  { field: "r1CheckboxType", headerName: "Checkbox Type", editable: false },
  { field: "r1DisplayOrder", headerName: "Display Order", editable: true, hide: true },
  { field: "r1GroupDisplayOrder", headerName: "Group Display Order", editable: true, hide: true },
  { field: "subGroupAlias", headerName: "Subgroup Alias", editable: true },
  { field: "displayLength", headerName: "Display Length", editable: true, hide: true },
  { field: "maxLength", headerName: "Max Length", editable: true, hide: true },
  { field: "r1AttributeValueReqFlag", headerName: "Value Required", editable: true },
  { field: "r1ReqFeeCalc", headerName: "Req Fee Calc", editable: true, hide: true },
  { field: "r1SearchableFlag", headerName: "Searchable", editable: true, hide: true },
  { field: "r1SearchableForAca", headerName: "Searchable ACA", editable: true, hide: true },
  { field: "r1SupervisorEditOnlyFlag", headerName: "Supervisor Only", editable: true, hide: true },
  { field: "vchDispFlag", headerName: "Voucher Display", editable: true, hide: true },
  { field: "locationQueryFlag", headerName: "Location Query", editable: true, hide: true },
  { field: "r1TableGroupName", headerName: "Table Group", editable: true, hide: true },
  { field: "servProvCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "valueCount", headerName: "# Values", editable: false },
];

const VALUE_COLUMN_META: ColumnMeta[] = [
  { field: "value", headerName: "Value", editable: true },
  { field: "fieldName", headerName: "Field Name", editable: true, hide: true },
  { field: "subGroupCode", headerName: "Subgroup Code", editable: true, hide: true },
  { field: "type", headerName: "Type", editable: true, hide: true },
  { field: "groupCode", headerName: "Group Code", editable: false, hide: true },
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

const ASIGroupGrid = forwardRef<ASIGroupGridHandle, Props>(function ASIGroupGrid(
  { records, onChange, gridThemeClass, agencyId },
  ref
) {
  const [groupRows, setGroupRows] = useState<ASIGroupRow[]>(() => records.map(toASIGroupRow));
  const [selectedGroupUid, setSelectedGroupUid] = useState<string | null>(groupRows[0]?.uid ?? null);

  const selectedGroupNode = useMemo(
    () => (selectedGroupUid ? findASIGroupByUid(records, selectedGroupUid) ?? null : null),
    [records, selectedGroupUid]
  );

  const [fieldRows, setFieldRows] = useState<ASIFieldRow[]>(() =>
    selectedGroupNode ? getASIFieldNodes(selectedGroupNode).map(toASIFieldRow) : []
  );
  const [selectedFieldUid, setSelectedFieldUid] = useState<string | null>(fieldRows[0]?.uid ?? null);

  const selectedFieldNode = useMemo(
    () =>
      selectedGroupNode && selectedFieldUid
        ? findASIFieldByUid(selectedGroupNode, selectedFieldUid) ?? null
        : null,
    [selectedGroupNode, selectedFieldUid]
  );

  const [valueRows, setValueRows] = useState<ASIDropdownValueRow[]>(() =>
    selectedFieldNode ? getASIDropdownValueNodes(selectedFieldNode).map(toASIDropdownValueRow) : []
  );

  const groupGridRef = useRef<AgGridReact<ASIGroupRow>>(null);
  const fieldGridRef = useRef<AgGridReact<ASIFieldRow>>(null);
  const valueGridRef = useRef<AgGridReact<ASIDropdownValueRow>>(null);
  const pendingGroupFocusUid = useRef<string | null>(null);
  const pendingFieldFocusUid = useRef<string | null>(null);
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
    const t = Math.min(naturalPanelHeight(groupRows.length), Math.max(MIN_PANEL_PX, available * 0.34));
    const m = Math.min(naturalPanelHeight(fieldRows.length), Math.max(MIN_PANEL_PX, available * 0.33));
    const cap = Math.max(MIN_PANEL_PX, available - reserve + 2 * MIN_PANEL_PX);
    setTopHeight(Math.min(t, cap));
    setMidHeight(Math.min(m, cap));
  }, [groupRows.length, fieldRows.length]);

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
    () => buildColumnDefs<ASIGroupRow>(GROUP_COLUMN_META, groupRows),
    [groupRows]
  );
  const fieldColumnDefs = useMemo(
    () => buildColumnDefs<ASIFieldRow>(FIELD_COLUMN_META, fieldRows),
    [fieldRows]
  );
  const valueColumnDefs = useMemo(
    () => buildColumnDefs<ASIDropdownValueRow>(VALUE_COLUMN_META, valueRows),
    [valueRows]
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
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "appSpecInfoGroupCode");
    }
  }, [groupRows]);

  useEffect(() => {
    const uid = pendingFieldFocusUid.current;
    pendingFieldFocusUid.current = null;
    if (!uid) return;
    const api = fieldGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "r1CheckboxDesc");
    }
  }, [fieldRows]);

  useEffect(() => {
    const uid = pendingValueFocusUid.current;
    pendingValueFocusUid.current = null;
    if (!uid) return;
    const api = valueGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "value");
    }
  }, [valueRows]);

  const refreshFieldRows = useCallback((node: PNode | null) => {
    setFieldRows(node ? getASIFieldNodes(node).map(toASIFieldRow) : []);
  }, []);

  const refreshValueRows = useCallback((node: PNode | null) => {
    setValueRows(node ? getASIDropdownValueNodes(node).map(toASIDropdownValueRow) : []);
  }, []);

  const refreshGroupRow = useCallback((node: PNode) => {
    const updated = toASIGroupRow(node);
    setGroupRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
  }, []);

  const refreshFieldRow = useCallback((node: PNode) => {
    const updated = toASIFieldRow(node);
    setFieldRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
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
          setASIGroupField(groupNode, "serviceProviderCode", value);
          for (const fieldNode of getASIFieldNodes(groupNode)) {
            setASIFieldField(fieldNode, "servProvCode", value);
            for (const valueNode of getASIDropdownValueNodes(fieldNode)) {
              setASIDropdownValueField(valueNode, "serviceProviderCode", value);
            }
          }
        }
        setGroupRows(records.map(toASIGroupRow));
        if (selectedGroupNode) refreshFieldRows(selectedGroupNode);
        if (selectedFieldNode) refreshValueRows(selectedFieldNode);
        onChange();
      },
    }),
    [records, selectedGroupNode, selectedFieldNode, refreshFieldRows, refreshValueRows, onChange]
  );

  const onGroupSelectionChanged = useCallback(() => {
    const selected = groupGridRef.current?.api.getSelectedRows() ?? [];
    const uid = selected[0]?.uid ?? null;
    setSelectedGroupUid(uid);
    setSelectedFieldUid(null);
    const node = uid ? findASIGroupByUid(records, uid) : null;
    refreshFieldRows(node ?? null);
    setValueRows([]);
  }, [records, refreshFieldRows]);

  const onFieldSelectionChanged = useCallback(() => {
    const selected = fieldGridRef.current?.api.getSelectedRows() ?? [];
    const uid = selected[0]?.uid ?? null;
    setSelectedFieldUid(uid);
    const node = selectedGroupNode && uid ? findASIFieldByUid(selectedGroupNode, uid) : null;
    refreshValueRows(node ?? null);
  }, [selectedGroupNode, refreshValueRows]);

  const onGroupCellValueChanged = useCallback(
    (e: CellValueChangedEvent<ASIGroupRow>) => {
      const node = findASIGroupByUid(records, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setASIGroupField(node, field, String(e.newValue ?? ""));
      refreshGroupRow(node);
      if (
        (field === "appSpecInfoGroupCode" || field === "r1CheckboxGroup" || field === "r1CheckboxType") &&
        selectedGroupUid === e.data.uid
      ) {
        refreshFieldRows(node);
      }
      flashRow(groupGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [records, selectedGroupUid, refreshFieldRows, refreshGroupRow, flashRow, onChange]
  );

  const onFieldCellValueChanged = useCallback(
    (e: CellValueChangedEvent<ASIFieldRow>) => {
      if (!selectedGroupNode) return;
      const node = findASIFieldByUid(selectedGroupNode, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setASIFieldField(node, field, String(e.newValue ?? ""));
      refreshFieldRow(node);
      flashRow(fieldGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [selectedGroupNode, refreshFieldRow, flashRow, onChange]
  );

  const onValueCellValueChanged = useCallback(
    (e: CellValueChangedEvent<ASIDropdownValueRow>) => {
      if (!selectedFieldNode) return;
      const node = findASIDropdownValueByUid(selectedFieldNode, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setASIDropdownValueField(node, field, String(e.newValue ?? ""));
      const updated = toASIDropdownValueRow(node);
      setValueRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
      flashRow(valueGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [selectedFieldNode, flashRow, onChange]
  );

  const addGroupRow = useCallback(() => {
    const node = createASIGroupNode(agencyId);
    records.push(node);
    const row = toASIGroupRow(node);
    pendingGroupFocusUid.current = row.uid;
    setGroupRows((prev) => [...prev, row]);
    onChange();
  }, [records, agencyId, onChange]);

  const deleteSelectedGroupRows = useCallback(() => {
    const selected = (groupGridRef.current?.api.getSelectedRows() ?? []) as ASIGroupRow[];
    for (const row of selected) {
      const node = findASIGroupByUid(records, row.uid);
      if (node) deleteASIGroup(records, node);
    }
    const deletedUids = new Set(selected.map((r) => r.uid));
    setGroupRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
    if (selectedGroupUid && deletedUids.has(selectedGroupUid)) {
      setSelectedGroupUid(null);
      setSelectedFieldUid(null);
      setFieldRows([]);
      setValueRows([]);
    }
    onChange();
  }, [records, selectedGroupUid, onChange]);

  const addFieldRow = useCallback(() => {
    if (!selectedGroupNode) return;
    const groupRow = toASIGroupRow(selectedGroupNode);
    const node = createASIFieldNode(
      groupRow.appSpecInfoGroupCode,
      groupRow.r1CheckboxGroup,
      groupRow.r1CheckboxType,
      groupRow.serviceProviderCode
    );
    getASIFieldNodes(selectedGroupNode).push(node);
    const row = toASIFieldRow(node);
    pendingFieldFocusUid.current = row.uid;
    setFieldRows((prev) => [...prev, row]);
    refreshGroupRow(selectedGroupNode);
    onChange();
  }, [selectedGroupNode, refreshGroupRow, onChange]);

  const deleteSelectedFieldRows = useCallback(() => {
    if (!selectedGroupNode) return;
    const selected = (fieldGridRef.current?.api.getSelectedRows() ?? []) as ASIFieldRow[];
    for (const row of selected) {
      const node = findASIFieldByUid(selectedGroupNode, row.uid);
      if (node) deleteASIField(selectedGroupNode, node);
    }
    refreshFieldRows(selectedGroupNode);
    refreshGroupRow(selectedGroupNode);
    if (selectedFieldUid && selected.some((r) => r.uid === selectedFieldUid)) {
      setSelectedFieldUid(null);
      setValueRows([]);
    }
    onChange();
  }, [selectedGroupNode, selectedFieldUid, refreshFieldRows, refreshGroupRow, onChange]);

  const addValueRow = useCallback(() => {
    if (!selectedFieldNode || !selectedGroupNode) return;
    const groupRow = toASIGroupRow(selectedGroupNode);
    const fieldRow = toASIFieldRow(selectedFieldNode);
    const node = createASIDropdownValueNode(
      fieldRow.r1CheckboxDesc,
      groupRow.appSpecInfoGroupCode,
      groupRow.serviceProviderCode
    );
    getASIDropdownValueNodes(selectedFieldNode).push(node);
    const row = toASIDropdownValueRow(node);
    pendingValueFocusUid.current = row.uid;
    setValueRows((prev) => [...prev, row]);
    refreshFieldRow(selectedFieldNode);
    onChange();
  }, [selectedFieldNode, selectedGroupNode, refreshFieldRow, onChange]);

  const deleteSelectedValueRows = useCallback(() => {
    if (!selectedFieldNode) return;
    const selected = (valueGridRef.current?.api.getSelectedRows() ?? []) as ASIDropdownValueRow[];
    for (const row of selected) {
      const node = findASIDropdownValueByUid(selectedFieldNode, row.uid);
      if (node) deleteASIDropdownValue(selectedFieldNode, node);
    }
    refreshValueRows(selectedFieldNode);
    refreshFieldRow(selectedFieldNode);
    onChange();
  }, [selectedFieldNode, refreshValueRows, refreshFieldRow, onChange]);

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
            title={topCollapsed ? "Expand ASI Groups" : "Collapse ASI Groups"}
          >
            {topCollapsed ? "▸" : "▾"}
          </button>
          <button className="btn" onClick={addGroupRow}>
            + Add ASI Group
          </button>
          <button className="btn btn-danger" onClick={deleteSelectedGroupRows}>
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            ASI Groups ({groupRows.length})
            {topCollapsed && selectedGroupNode && (
              <>
                {" — "}
                <strong>{toASIGroupRow(selectedGroupNode).appSpecInfoGroupCode || "(unnamed)"}</strong>
              </>
            )}
          </span>
        </div>
        {!topCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<ASIGroupRow>
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
            title={midCollapsed ? "Expand ASI Fields" : "Collapse ASI Fields"}
          >
            {midCollapsed ? "▸" : "▾"}
          </button>
          <button className="btn" onClick={addFieldRow} disabled={!selectedGroupNode}>
            + Add ASI Field
          </button>
          <button
            className="btn btn-danger"
            onClick={deleteSelectedFieldRows}
            disabled={!selectedGroupNode}
          >
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {selectedGroupNode
              ? `ASI Fields for "${toASIGroupRow(selectedGroupNode).appSpecInfoGroupCode || "(unnamed)"}" (${fieldRows.length})`
              : "Select an ASI Group above to see its fields"}
            {midCollapsed && selectedFieldNode && (
              <>
                {" — "}
                <strong>{toASIFieldRow(selectedFieldNode).r1CheckboxDesc || "(unnamed)"}</strong>
              </>
            )}
          </span>
        </div>
        {!midCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<ASIFieldRow>
              ref={fieldGridRef}
              rowData={fieldRows}
              columnDefs={fieldColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="single"
              onSelectionChanged={onFieldSelectionChanged}
              onCellValueChanged={onFieldCellValueChanged}
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
          <button className="btn" onClick={addValueRow} disabled={!selectedFieldNode}>
            + Add Value
          </button>
          <button
            className="btn btn-danger"
            onClick={deleteSelectedValueRows}
            disabled={!selectedFieldNode}
          >
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {selectedFieldNode
              ? `Values for "${toASIFieldRow(selectedFieldNode).r1CheckboxDesc || "(unnamed)"}" (${valueRows.length})`
              : "Select an ASI Field above to see its dropdown values"}
          </span>
        </div>
        {!bottomCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<ASIDropdownValueRow>
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

export default ASIGroupGrid;
