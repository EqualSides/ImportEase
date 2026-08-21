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

/**
 * Four-level grid: group -> checkbox type (synthetic grouping, not its own
 * XML node) -> ASI field -> dropdown value. A single real ASI Group can
 * carry hundreds of fields split across a dozen+ distinct r1CheckboxType
 * values (confirmed against the full real export — one group alone had 13
 * types, from 2 to 99 fields each), so the middle tier groups fields by
 * that type instead of listing them all flat.
 */

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

interface CheckboxTypeColumnMeta {
  field: "checkboxType" | "fieldCount";
  headerName: string;
  editable: boolean;
}

const CHECKBOX_TYPE_COLUMN_META: CheckboxTypeColumnMeta[] = [
  { field: "checkboxType", headerName: "Checkbox Type", editable: false },
  { field: "fieldCount", headerName: "# Fields", editable: false },
];

const FIELD_COLUMN_META: ColumnMeta[] = [
  { field: "r1CheckboxDesc", headerName: "Field Description", editable: true },
  { field: "r1CheckboxCode", headerName: "Checkbox Code", editable: false, hide: true },
  { field: "r1CheckboxGroup", headerName: "Checkbox Group", editable: false, hide: true },
  { field: "r1CheckboxType", headerName: "Checkbox Type", editable: true },
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

// No upper cap: every column sizes to fully fit its longest value/header
// so nothing is truncated by default.
function widthForColumn(rows: any[], field: string, headerName: string): number {
  let maxLen = headerName.length;
  for (const r of rows) {
    const v = r[field];
    const len = v == null ? 0 : String(v).length;
    if (len > maxLen) maxLen = len;
  }
  return Math.max(COL_MIN, Math.round(maxLen * CHAR_PX) + COL_PADDING);
}

function buildColumnDefs<T extends { uid: string }>(
  meta: ColumnMeta[] | CheckboxTypeColumnMeta[],
  rows: T[]
): ColDef<T>[] {
  return meta.map((c) => ({
    field: c.field,
    headerName: c.headerName,
    editable: c.editable,
    hide: "hide" in c ? c.hide : undefined,
    resizable: true,
    width: "hide" in c && c.hide ? undefined : widthForColumn(rows, c.field, c.headerName),
  })) as ColDef<T>[];
}

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 38;
const PANEL_CHROME = 74;
const MIN_PANEL_PX = 160;
const HANDLE_PX = 14;
const NO_TYPE = "(No Checkbox Type)";

function naturalPanelHeight(rowCount: number): number {
  return PANEL_CHROME + HEADER_HEIGHT + Math.max(rowCount, 1) * ROW_HEIGHT;
}

interface CheckboxTypeRow {
  uid: string;
  checkboxType: string;
  fieldCount: number;
}

function groupFieldsByCheckboxType(fields: ASIFieldRow[]): CheckboxTypeRow[] {
  const counts = new Map<string, number>();
  for (const f of fields) {
    const key = f.r1CheckboxType || NO_TYPE;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => (a === NO_TYPE ? 1 : b === NO_TYPE ? -1 : a.localeCompare(b)))
    .map(([checkboxType, fieldCount]) => ({ uid: checkboxType, checkboxType, fieldCount }));
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

  // All fields of the selected group, unfiltered — the source both the
  // Checkbox Type grouping and the (filtered) Fields tier are derived from.
  const [allFieldRows, setAllFieldRows] = useState<ASIFieldRow[]>(() =>
    selectedGroupNode ? getASIFieldNodes(selectedGroupNode).map(toASIFieldRow) : []
  );
  const [selectedCheckboxType, setSelectedCheckboxType] = useState<string | null>(null);
  const [selectedFieldUid, setSelectedFieldUid] = useState<string | null>(null);

  const checkboxTypeRows = useMemo(() => groupFieldsByCheckboxType(allFieldRows), [allFieldRows]);
  const fieldRows = useMemo(
    () =>
      selectedCheckboxType == null
        ? []
        : allFieldRows.filter((f) => (f.r1CheckboxType || NO_TYPE) === selectedCheckboxType),
    [allFieldRows, selectedCheckboxType]
  );

  // If the selected type's last field gets deleted or edited to a
  // different type, its row vanishes from checkboxTypeRows — drop the
  // now-dangling selection instead of silently pointing at nothing.
  useEffect(() => {
    if (selectedCheckboxType != null && !checkboxTypeRows.some((r) => r.checkboxType === selectedCheckboxType)) {
      setSelectedCheckboxType(null);
      setSelectedFieldUid(null);
    }
  }, [checkboxTypeRows, selectedCheckboxType]);

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
  const typeGridRef = useRef<AgGridReact<CheckboxTypeRow>>(null);
  const fieldGridRef = useRef<AgGridReact<ASIFieldRow>>(null);
  const valueGridRef = useRef<AgGridReact<ASIDropdownValueRow>>(null);
  const pendingGroupFocusUid = useRef<string | null>(null);
  const pendingFieldFocusUid = useRef<string | null>(null);
  const pendingValueFocusUid = useRef<string | null>(null);

  const stackRef = useRef<HTMLDivElement>(null);
  const [topHeight, setTopHeight] = useState<number | null>(null);
  const [typeHeight, setTypeHeight] = useState<number | null>(null);
  const [fieldHeight, setFieldHeight] = useState<number | null>(null);
  const [topCollapsed, setTopCollapsed] = useState(false);
  const [typeCollapsed, setTypeCollapsed] = useState(false);
  const [fieldCollapsed, setFieldCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const userResizedRef = useRef(false);
  const dragRef = useRef<{
    which: "top" | "type" | "field";
    startY: number;
    startTop: number;
    startType: number;
    startField: number;
  } | null>(null);

  const recomputeHeights = useCallback(() => {
    if (userResizedRef.current) return;
    const stack = stackRef.current;
    const available = stack ? stack.clientHeight : 1000;
    const reserve = 3 * HANDLE_PX + 3 * MIN_PANEL_PX;
    const t = Math.min(naturalPanelHeight(groupRows.length), Math.max(MIN_PANEL_PX, available * 0.22));
    const ty = Math.min(
      naturalPanelHeight(checkboxTypeRows.length),
      Math.max(MIN_PANEL_PX, available * 0.22)
    );
    const f = Math.min(naturalPanelHeight(fieldRows.length), Math.max(MIN_PANEL_PX, available * 0.22));
    const cap = Math.max(MIN_PANEL_PX, available - reserve + MIN_PANEL_PX);
    setTopHeight(Math.min(t, cap));
    setTypeHeight(Math.min(ty, cap));
    setFieldHeight(Math.min(f, cap));
  }, [groupRows.length, checkboxTypeRows.length, fieldRows.length]);

  useEffect(() => {
    recomputeHeights();
  }, [recomputeHeights]);

  useEffect(() => {
    const onResize = () => recomputeHeights();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recomputeHeights]);

  const makeHandleMouseDown = useCallback(
    (which: "top" | "type" | "field") => (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        which,
        startY: e.clientY,
        startTop: topHeight ?? 200,
        startType: typeHeight ?? 200,
        startField: fieldHeight ?? 200,
      };
      document.body.classList.add("resizing-panels");
      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        const stack = stackRef.current;
        if (!drag || !stack) return;
        const available = stack.clientHeight;
        const delta = ev.clientY - drag.startY;
        const others =
          drag.which === "top"
            ? drag.startType + drag.startField
            : drag.which === "type"
              ? drag.startTop + drag.startField
              : drag.startTop + drag.startType;
        const max = Math.max(MIN_PANEL_PX, available - 3 * HANDLE_PX - 2 * MIN_PANEL_PX - others);
        const start =
          drag.which === "top" ? drag.startTop : drag.which === "type" ? drag.startType : drag.startField;
        const next = Math.min(Math.max(start + delta, MIN_PANEL_PX), max);
        userResizedRef.current = true;
        if (drag.which === "top") setTopHeight(next);
        else if (drag.which === "type") setTypeHeight(next);
        else setFieldHeight(next);
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
    [topHeight, typeHeight, fieldHeight]
  );

  const groupColumnDefs = useMemo(
    () => buildColumnDefs<ASIGroupRow>(GROUP_COLUMN_META, groupRows),
    [groupRows]
  );
  const typeColumnDefs = useMemo(
    () => buildColumnDefs<CheckboxTypeRow>(CHECKBOX_TYPE_COLUMN_META, checkboxTypeRows),
    [checkboxTypeRows]
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

  const refreshAllFieldRows = useCallback((node: PNode | null) => {
    setAllFieldRows(node ? getASIFieldNodes(node).map(toASIFieldRow) : []);
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
    setAllFieldRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
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
        if (selectedGroupNode) refreshAllFieldRows(selectedGroupNode);
        if (selectedFieldNode) refreshValueRows(selectedFieldNode);
        onChange();
      },
    }),
    [records, selectedGroupNode, selectedFieldNode, refreshAllFieldRows, refreshValueRows, onChange]
  );

  const onGroupSelectionChanged = useCallback(() => {
    const selected = groupGridRef.current?.api.getSelectedRows() ?? [];
    const uid = selected[0]?.uid ?? null;
    setSelectedGroupUid(uid);
    setSelectedCheckboxType(null);
    setSelectedFieldUid(null);
    const node = uid ? findASIGroupByUid(records, uid) : null;
    refreshAllFieldRows(node ?? null);
    setValueRows([]);
  }, [records, refreshAllFieldRows]);

  const onTypeSelectionChanged = useCallback(() => {
    const selected = typeGridRef.current?.api.getSelectedRows() ?? [];
    setSelectedCheckboxType(selected[0]?.checkboxType ?? null);
    setSelectedFieldUid(null);
    setValueRows([]);
  }, []);

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
      flashRow(groupGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [records, refreshGroupRow, flashRow, onChange]
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
      setSelectedCheckboxType(null);
      setSelectedFieldUid(null);
      setAllFieldRows([]);
      setValueRows([]);
    }
    onChange();
  }, [records, selectedGroupUid, onChange]);

  // Creates a field under whichever Checkbox Type is currently selected in
  // the middle tier; with none selected (bootstrapping a group's very
  // first field), it lands in the "(No Checkbox Type)" bucket and that
  // bucket becomes selected so the new row is immediately visible below —
  // the type itself can then be set by editing the field's own cell.
  const addFieldRow = useCallback(() => {
    if (!selectedGroupNode) return;
    const groupRow = toASIGroupRow(selectedGroupNode);
    const typeForNewField = selectedCheckboxType && selectedCheckboxType !== NO_TYPE ? selectedCheckboxType : "";
    const node = createASIFieldNode(
      groupRow.appSpecInfoGroupCode,
      groupRow.r1CheckboxGroup,
      typeForNewField,
      groupRow.serviceProviderCode
    );
    getASIFieldNodes(selectedGroupNode).push(node);
    const row = toASIFieldRow(node);
    pendingFieldFocusUid.current = row.uid;
    setAllFieldRows((prev) => [...prev, row]);
    setSelectedCheckboxType(row.r1CheckboxType || NO_TYPE);
    refreshGroupRow(selectedGroupNode);
    onChange();
  }, [selectedGroupNode, selectedCheckboxType, refreshGroupRow, onChange]);

  const deleteSelectedFieldRows = useCallback(() => {
    if (!selectedGroupNode) return;
    const selected = (fieldGridRef.current?.api.getSelectedRows() ?? []) as ASIFieldRow[];
    for (const row of selected) {
      const node = findASIFieldByUid(selectedGroupNode, row.uid);
      if (node) deleteASIField(selectedGroupNode, node);
    }
    refreshAllFieldRows(selectedGroupNode);
    refreshGroupRow(selectedGroupNode);
    if (selectedFieldUid && selected.some((r) => r.uid === selectedFieldUid)) {
      setSelectedFieldUid(null);
      setValueRows([]);
    }
    onChange();
  }, [selectedGroupNode, selectedFieldUid, refreshAllFieldRows, refreshGroupRow, onChange]);

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

      {!topCollapsed && !typeCollapsed && (
        <div className="resize-handle" onMouseDown={makeHandleMouseDown("top")} title="Drag to resize" />
      )}

      <div
        className="grid-panel"
        style={
          typeCollapsed
            ? { flex: "0 0 auto", height: "auto", minHeight: 0 }
            : { flex: "0 0 auto", height: typeHeight ?? undefined, minHeight: MIN_PANEL_PX }
        }
      >
        <div className="grid-toolbar">
          <button
            className="btn icon-btn"
            onClick={() => setTypeCollapsed((c) => !c)}
            title={typeCollapsed ? "Expand Checkbox Types" : "Collapse Checkbox Types"}
          >
            {typeCollapsed ? "▸" : "▾"}
          </button>
          <span className="grid-toolbar-label">
            {selectedGroupNode
              ? `Checkbox Types for "${toASIGroupRow(selectedGroupNode).appSpecInfoGroupCode || "(unnamed)"}" (${checkboxTypeRows.length})`
              : "Select an ASI Group above to see its checkbox types"}
            {typeCollapsed && selectedCheckboxType && (
              <>
                {" — "}
                <strong>{selectedCheckboxType}</strong>
              </>
            )}
          </span>
        </div>
        {!typeCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<CheckboxTypeRow>
              ref={typeGridRef}
              rowData={checkboxTypeRows}
              columnDefs={typeColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="single"
              onSelectionChanged={onTypeSelectionChanged}
            />
          </div>
        )}
      </div>

      {!typeCollapsed && !fieldCollapsed && (
        <div className="resize-handle" onMouseDown={makeHandleMouseDown("type")} title="Drag to resize" />
      )}

      <div
        className="grid-panel"
        style={
          fieldCollapsed
            ? { flex: "0 0 auto", height: "auto", minHeight: 0 }
            : { flex: "0 0 auto", height: fieldHeight ?? undefined, minHeight: MIN_PANEL_PX }
        }
      >
        <div className="grid-toolbar">
          <button
            className="btn icon-btn"
            onClick={() => setFieldCollapsed((c) => !c)}
            title={fieldCollapsed ? "Expand ASI Fields" : "Collapse ASI Fields"}
          >
            {fieldCollapsed ? "▸" : "▾"}
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
            {selectedCheckboxType
              ? `ASI Fields for "${selectedCheckboxType}" (${fieldRows.length})`
              : "Select a Checkbox Type above to see its fields"}
            {fieldCollapsed && selectedFieldNode && (
              <>
                {" — "}
                <strong>{toASIFieldRow(selectedFieldNode).r1CheckboxDesc || "(unnamed)"}</strong>
              </>
            )}
          </span>
        </div>
        {!fieldCollapsed && (
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

      {!fieldCollapsed && !bottomCollapsed && (
        <div className="resize-handle" onMouseDown={makeHandleMouseDown("field")} title="Drag to resize" />
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
