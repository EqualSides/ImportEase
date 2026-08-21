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
  ExpressionRow,
  ExpressCalculationRow,
  ExpressCriteriaRow,
  ExpressFieldRow,
  createExpressionNode,
  createExpressCalculationNode,
  createExpressCriteriaNode,
  createExpressFieldNode,
  deleteExpression,
  deleteArmNode,
  findExpressionByUid,
  findArmNodeByUid,
  getArmNodes,
  setExpressionField,
  setExpressCalculationField,
  setExpressCriteriaField,
  setExpressFieldField,
  toExpressionRow,
  toExpressCalculationRow,
  toExpressCriteriaRow,
  toExpressFieldRow,
} from "@/lib/xml/expressionBuilder";
import { type LintFinding, lintExpression } from "@/lib/xml/expressionLint";
import CodeTextarea from "./CodeTextarea";

/**
 * The fourth "heterogeneous-arm" grid (see VirProcessGrid.tsx for the
 * third) — three editable arms (calculations, criteria, fields), each
 * with its own distinct row shape. Two always-empty sibling arms
 * (expressPortlets, xexpressEMSEScripts) are intentionally never
 * surfaced here, same treatment as VirProcess's processSecurityModels.
 */

export interface ExpressionBuilderGridHandle {
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
  /** Constrains editing to a dropdown of exactly these values. */
  values?: string[];
}

const EXPRESSION_COLUMN_META: ColumnMeta[] = [
  { field: "expressionName", headerName: "Expression Name", editable: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "checkboxCode", headerName: "Checkbox Code", editable: true, hide: true },
  { field: "entityKey1", headerName: "Entity Key 1", editable: true, hide: true },
  { field: "entityKey2", headerName: "Entity Key 2", editable: true, hide: true },
  { field: "entityKey3", headerName: "Entity Key 3", editable: true, hide: true },
  { field: "executeIn", headerName: "Execute In", editable: true, hide: true },
  { field: "executeOrder", headerName: "Execute Order", editable: true, hide: true },
  { field: "expressionBehavior", headerName: "Behavior", editable: true, hide: true },
  { field: "expressionMode", headerName: "Mode", editable: true, values: ["Manual", "Wizard"] },
  { field: "expressionVersion", headerName: "Version", editable: true, hide: true },
  { field: "viewID", headerName: "View ID", editable: true, hide: true },
  { field: "scriptText", headerName: "Script Text", editable: true, hide: true },
  { field: "calcCount", headerName: "# Calculations", editable: false },
  { field: "criteriaCount", headerName: "# Criteria", editable: false },
  { field: "fieldCount", headerName: "# Fields", editable: false },
];

const CALC_COLUMN_META: ColumnMeta[] = [
  { field: "fieldName", headerName: "Field Name", editable: true },
  { field: "fieldPropterty", headerName: "Field Property", editable: true, hide: true },
  { field: "calculateExp", headerName: "Calculate Expression", editable: true },
  { field: "calSeq", headerName: "Sequence", editable: true, hide: true },
  { field: "expressionName", headerName: "Expression Name", editable: false, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
];

const CRITERIA_COLUMN_META: ColumnMeta[] = [
  { field: "fieldName", headerName: "Field Name", editable: true },
  { field: "fieldOperator", headerName: "Operator", editable: true },
  { field: "criteriaValue", headerName: "Value", editable: true },
  { field: "criteriaType", headerName: "Criteria Type", editable: true, hide: true },
  { field: "booleanOperator", headerName: "Boolean Operator", editable: true, hide: true },
  { field: "criteriaSeq", headerName: "Sequence", editable: true, hide: true },
  { field: "parentId", headerName: "Parent ID", editable: true, hide: true },
  { field: "expressionName", headerName: "Expression Name", editable: false, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
];

const FIELD_COLUMN_META: ColumnMeta[] = [
  { field: "name", headerName: "Name", editable: true },
  { field: "label", headerName: "Label", editable: true, hide: true },
  { field: "variableKey", headerName: "Variable Key", editable: true, hide: true },
  { field: "usage", headerName: "Usage", editable: true, hide: true },
  { field: "event", headerName: "Event", editable: true, hide: true },
  { field: "isRequired", headerName: "Required?", editable: true, hide: true },
  { field: "portletId", headerName: "Portlet ID", editable: true, hide: true },
  { field: "refColName", headerName: "Ref Column", editable: true, hide: true },
  { field: "type", headerName: "Type", editable: true, hide: true },
  { field: "expressionName", headerName: "Expression Name", editable: false, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
];

const ARM_COLUMN_META: Record<ArmKey, ColumnMeta[]> = {
  calc: CALC_COLUMN_META,
  criteria: CRITERIA_COLUMN_META,
  field: FIELD_COLUMN_META,
};

const ARM_LABEL: Record<ArmKey, string> = {
  calc: "Calculation",
  criteria: "Criteria",
  field: "Field",
};

const ARM_LABEL_PLURAL: Record<ArmKey, string> = {
  calc: "Calculations",
  criteria: "Criteria",
  field: "Fields",
};

const ARM_PRIMARY_FIELD: Record<ArmKey, string> = {
  calc: "fieldName",
  criteria: "fieldName",
  field: "name",
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
    ...(c.values
      ? { cellEditor: "agSelectCellEditor", cellEditorParams: { values: c.values } }
      : undefined),
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

type ArmRow = ExpressCalculationRow | ExpressCriteriaRow | ExpressFieldRow;

function toArmRow(arm: ArmKey, node: PNode): ArmRow {
  if (arm === "calc") return toExpressCalculationRow(node);
  if (arm === "criteria") return toExpressCriteriaRow(node);
  return toExpressFieldRow(node);
}

function setArmField(arm: ArmKey, node: PNode, field: string, value: string) {
  if (arm === "calc") setExpressCalculationField(node, field, value);
  else if (arm === "criteria") setExpressCriteriaField(node, field, value);
  else setExpressFieldField(node, field, value);
}

const ExpressionBuilderGrid = forwardRef<ExpressionBuilderGridHandle, Props>(
  function ExpressionBuilderGrid({ records, onChange, gridThemeClass, agencyId }, ref) {
    const [exprRows, setExprRows] = useState<ExpressionRow[]>(() => records.map(toExpressionRow));
    const [selectedExprUid, setSelectedExprUid] = useState<string | null>(exprRows[0]?.uid ?? null);
    const [selectedArm, setSelectedArm] = useState<ArmKey>("calc");
    const [lintFindings, setLintFindings] = useState<LintFinding[] | null>(null);
    const [scriptTextCollapsed, setScriptTextCollapsed] = useState(false);
    const [scriptTextModalOpen, setScriptTextModalOpen] = useState(false);

    const selectedExprNode = useMemo(
      () => (selectedExprUid ? findExpressionByUid(records, selectedExprUid) ?? null : null),
      [records, selectedExprUid]
    );

    const [armRows, setArmRows] = useState<ArmRow[]>(() =>
      selectedExprNode ? getArmNodes(selectedExprNode, "calc").map((n) => toArmRow("calc", n)) : []
    );

    const exprGridRef = useRef<AgGridReact<ExpressionRow>>(null);
    const armGridRef = useRef<AgGridReact<ArmRow>>(null);
    const pendingExprFocusUid = useRef<string | null>(null);
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
      setTopPanelHeight(Math.min(naturalPanelHeight(exprRows.length), soft, cap));
    }, [exprRows.length]);

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

    const exprColumnDefs = useMemo(
      () => buildColumnDefs<ExpressionRow>(EXPRESSION_COLUMN_META, exprRows),
      [exprRows]
    );
    const armColumnDefs = useMemo(
      () => buildColumnDefs<ArmRow>(ARM_COLUMN_META[selectedArm], armRows),
      [selectedArm, armRows]
    );

    useEffect(() => {
      const uid = pendingExprFocusUid.current;
      pendingExprFocusUid.current = null;
      if (!uid) return;
      const api = exprGridRef.current?.api;
      const rowNode = api?.getRowNode(uid);
      if (api && rowNode) {
        rowNode.setSelected(true, true);
        api.ensureNodeVisible(rowNode);
        if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "expressionName");
      }
    }, [exprRows]);

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

    const refreshExprRow = useCallback((node: PNode) => {
      const updated = toExpressionRow(node);
      setExprRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
    }, []);

    // Script Text lives in the lower panel (not as a top-grid column) —
    // it's often multi-line code, which a grid cell can't show wrapped
    // and readable the way a textarea can.
    const onScriptTextChange = useCallback(
      (value: string) => {
        if (!selectedExprNode) return;
        setExpressionField(selectedExprNode, "scriptText", value);
        refreshExprRow(selectedExprNode);
        onChange();
      },
      [selectedExprNode, refreshExprRow, onChange]
    );

    const flashRow = useCallback((api: any, uid: string, field: string) => {
      const rowNode = api?.getRowNode(uid);
      if (api && rowNode) api.flashCells({ rowNodes: [rowNode], columns: [field] });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        applyAgencyIdToAll: (value: string) => {
          for (const exprNode of records) {
            setExpressionField(exprNode, "serviceProviderCode", value);
          }
          setExprRows(records.map(toExpressionRow));
          if (selectedExprNode) refreshArmRows(selectedExprNode, selectedArm);
          onChange();
        },
      }),
      [records, selectedExprNode, selectedArm, refreshArmRows, onChange]
    );

    const onExprSelectionChanged = useCallback(() => {
      const selected = exprGridRef.current?.api.getSelectedRows() ?? [];
      const uid = selected[0]?.uid ?? null;
      setSelectedExprUid(uid);
      const node = uid ? findExpressionByUid(records, uid) : null;
      refreshArmRows(node ?? null, selectedArm);
    }, [records, selectedArm, refreshArmRows]);

    const onSelectArm = useCallback(
      (arm: ArmKey) => {
        setSelectedArm(arm);
        refreshArmRows(selectedExprNode, arm);
      },
      [selectedExprNode, refreshArmRows]
    );

    const onExprCellValueChanged = useCallback(
      (e: CellValueChangedEvent<ExpressionRow>) => {
        const node = findExpressionByUid(records, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setExpressionField(node, field, String(e.newValue ?? ""));
        refreshExprRow(node);
        if (
          (field === "expressionName" || field === "serviceProviderCode") &&
          selectedExprUid === e.data.uid
        ) {
          refreshArmRows(node, selectedArm);
        }
        flashRow(exprGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [records, selectedExprUid, selectedArm, refreshArmRows, refreshExprRow, flashRow, onChange]
    );

    const onArmCellValueChanged = useCallback(
      (e: CellValueChangedEvent<ArmRow>) => {
        if (!selectedExprNode) return;
        const node = findArmNodeByUid(selectedExprNode, selectedArm, e.data.uid);
        if (!node) return;
        const field = e.colDef.field as string;
        setArmField(selectedArm, node, field, String(e.newValue ?? ""));
        const updated = toArmRow(selectedArm, node);
        setArmRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
        flashRow(armGridRef.current?.api, e.data.uid, field);
        onChange();
      },
      [selectedExprNode, selectedArm, flashRow, onChange]
    );

    const addExprRow = useCallback(() => {
      const node = createExpressionNode(agencyId);
      records.push(node);
      const row = toExpressionRow(node);
      pendingExprFocusUid.current = row.uid;
      setExprRows((prev) => [...prev, row]);
      onChange();
    }, [records, agencyId, onChange]);

    const deleteSelectedExprRows = useCallback(() => {
      const selected = (exprGridRef.current?.api.getSelectedRows() ?? []) as ExpressionRow[];
      for (const row of selected) {
        const node = findExpressionByUid(records, row.uid);
        if (node) deleteExpression(records, node);
      }
      const deletedUids = new Set(selected.map((r) => r.uid));
      setExprRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
      if (selectedExprUid && deletedUids.has(selectedExprUid)) {
        setSelectedExprUid(null);
        setArmRows([]);
      }
      onChange();
    }, [records, selectedExprUid, onChange]);

    const addArmRow = useCallback(() => {
      if (!selectedExprNode) return;
      const exprRow = toExpressionRow(selectedExprNode);
      const node =
        selectedArm === "calc"
          ? createExpressCalculationNode(exprRow.expressionName, exprRow.serviceProviderCode)
          : selectedArm === "criteria"
            ? createExpressCriteriaNode(exprRow.expressionName, exprRow.serviceProviderCode)
            : createExpressFieldNode(exprRow.expressionName, exprRow.serviceProviderCode);
      getArmNodes(selectedExprNode, selectedArm).push(node);
      const row = toArmRow(selectedArm, node);
      pendingArmFocusUid.current = row.uid;
      setArmRows((prev) => [...prev, row]);
      refreshExprRow(selectedExprNode);
      onChange();
    }, [selectedExprNode, selectedArm, refreshExprRow, onChange]);

    const deleteSelectedArmRows = useCallback(() => {
      if (!selectedExprNode) return;
      const selected = (armGridRef.current?.api.getSelectedRows() ?? []) as ArmRow[];
      for (const row of selected) {
        const node = findArmNodeByUid(selectedExprNode, selectedArm, row.uid);
        if (node) deleteArmNode(selectedExprNode, selectedArm, node);
      }
      refreshArmRows(selectedExprNode, selectedArm);
      refreshExprRow(selectedExprNode);
      onChange();
    }, [selectedExprNode, selectedArm, refreshArmRows, refreshExprRow, onChange]);

    const runLint = useCallback(() => {
      if (!selectedExprNode) return;
      const exprRow = toExpressionRow(selectedExprNode);
      const calc = getArmNodes(selectedExprNode, "calc").map(toExpressCalculationRow);
      const criteria = getArmNodes(selectedExprNode, "criteria").map(toExpressCriteriaRow);
      setLintFindings(lintExpression(exprRow, calc, criteria));
    }, [selectedExprNode]);

    const dismissFinding = useCallback((id: string) => {
      setLintFindings((prev) => (prev ? prev.filter((f) => f.id !== id) : prev));
    }, []);

    const applyLintFix = useCallback(
      (finding: LintFinding) => {
        if (!finding.fix || !selectedExprNode) return;
        const { arm, uid, field, newValue } = finding.fix;
        if (arm === "expr") {
          setExpressionField(selectedExprNode, field, newValue);
          refreshExprRow(selectedExprNode);
        } else {
          const node = findArmNodeByUid(selectedExprNode, arm, uid);
          if (!node) return;
          setArmField(arm, node, field, newValue);
          if (selectedArm === arm) {
            const updated = toArmRow(arm, node);
            setArmRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
          }
        }
        onChange();
        dismissFinding(finding.id);
      },
      [selectedExprNode, selectedArm, refreshExprRow, onChange, dismissFinding]
    );

    const applyLintDelete = useCallback(
      (finding: LintFinding) => {
        if (!finding.deletable || !selectedExprNode) return;
        const { arm, uid } = finding.deletable;
        const node = findArmNodeByUid(selectedExprNode, arm, uid);
        if (!node) return;
        deleteArmNode(selectedExprNode, arm, node);
        if (selectedArm === arm) refreshArmRows(selectedExprNode, arm);
        refreshExprRow(selectedExprNode);
        onChange();
        dismissFinding(finding.id);
      },
      [selectedExprNode, selectedArm, refreshArmRows, refreshExprRow, onChange, dismissFinding]
    );

    const selectedExprRow = selectedExprNode ? toExpressionRow(selectedExprNode) : null;

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
              title={topPanelCollapsed ? "Expand Expressions" : "Collapse Expressions"}
            >
              {topPanelCollapsed ? "▸" : "▾"}
            </button>
            <button className="btn" onClick={addExprRow}>
              + Add Expression
            </button>
            <button className="btn btn-danger" onClick={deleteSelectedExprRows}>
              Delete Selected
            </button>
            <button className="btn" onClick={runLint} disabled={!selectedExprNode}>
              Check Code
            </button>
            <span className="grid-toolbar-label">
              Expressions ({exprRows.length})
              {topPanelCollapsed && selectedExprNode && (
                <>
                  {" — "}
                  <strong>{toExpressionRow(selectedExprNode).expressionName || "(unnamed)"}</strong>
                </>
              )}
            </span>
          </div>
          {!topPanelCollapsed && (
            <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
              <AgGridReact<ExpressionRow>
                ref={exprGridRef}
                rowData={exprRows}
                columnDefs={exprColumnDefs}
                rowHeight={ROW_HEIGHT}
                headerHeight={HEADER_HEIGHT}
                getRowId={(p) => p.data.uid}
                rowSelection="single"
                onSelectionChanged={onExprSelectionChanged}
                onCellValueChanged={onExprCellValueChanged}
                stopEditingWhenCellsLoseFocus
              />
            </div>
          )}
        </div>

        {!topPanelCollapsed && (
          <div className="resize-handle" onMouseDown={onHandleMouseDown} title="Drag to resize" />
        )}

        <div className="grid-panel" style={{ flex: 1, minHeight: MIN_PANEL_PX }}>
          <div className="expr-script-text-section">
            <div className="expr-script-text-header">
              <button
                className="btn icon-btn"
                onClick={() => setScriptTextCollapsed((c) => !c)}
                title={scriptTextCollapsed ? "Expand Script Text" : "Collapse Script Text"}
              >
                {scriptTextCollapsed ? "▸" : "▾"}
              </button>
              <label className="expr-script-text-label" htmlFor="expr-script-text-input">
                Script Text
                {selectedExprRow ? ` — ${selectedExprRow.expressionName || "(unnamed)"}` : ""}
              </label>
              <button
                className="btn"
                onClick={() => setScriptTextModalOpen(true)}
                disabled={!selectedExprNode}
                title="Open in a larger window"
                style={{ marginLeft: "auto" }}
              >
                Open in Window
              </button>
            </div>
            {!scriptTextCollapsed && (
              <CodeTextarea
                id="expr-script-text-input"
                value={selectedExprRow?.scriptText ?? ""}
                onChange={onScriptTextChange}
                disabled={!selectedExprNode}
                placeholder={selectedExprNode ? "" : "Select an Expression above to view/edit its script"}
              />
            )}
          </div>
          <div className="grid-toolbar">
            <button
              className={selectedArm === "calc" ? "btn btn-choice-active" : "btn"}
              onClick={() => onSelectArm("calc")}
            >
              Calculations{selectedExprRow ? ` (${selectedExprRow.calcCount})` : ""}
            </button>
            <button
              className={selectedArm === "criteria" ? "btn btn-choice-active" : "btn"}
              onClick={() => onSelectArm("criteria")}
            >
              Criteria{selectedExprRow ? ` (${selectedExprRow.criteriaCount})` : ""}
            </button>
            <button
              className={selectedArm === "field" ? "btn btn-choice-active" : "btn"}
              onClick={() => onSelectArm("field")}
            >
              Fields{selectedExprRow ? ` (${selectedExprRow.fieldCount})` : ""}
            </button>
            <button className="btn" onClick={addArmRow} disabled={!selectedExprNode}>
              + Add {ARM_LABEL[selectedArm]}
            </button>
            <button className="btn btn-danger" onClick={deleteSelectedArmRows} disabled={!selectedExprNode}>
              Delete Selected
            </button>
            <span className="grid-toolbar-label">
              {selectedExprNode
                ? `${ARM_LABEL_PLURAL[selectedArm]} for "${toExpressionRow(selectedExprNode).expressionName || "(unnamed)"}" (${armRows.length})`
                : "Select an Expression above to see its entries"}
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

        {scriptTextModalOpen && (
          <div className="auth-modal-backdrop" onClick={() => setScriptTextModalOpen(false)}>
            <div
              className="auth-modal script-text-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="auth-modal-close"
                onClick={() => setScriptTextModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
              <h2 className="lint-modal-title">
                Script Text{selectedExprRow ? ` — ${selectedExprRow.expressionName || "(unnamed)"}` : ""}
              </h2>
              <CodeTextarea
                value={selectedExprRow?.scriptText ?? ""}
                onChange={onScriptTextChange}
                disabled={!selectedExprNode}
                large
                autoFocus
              />
            </div>
          </div>
        )}

        {lintFindings !== null && (
          <div className="auth-modal-backdrop" onClick={() => setLintFindings(null)}>
            <div className="auth-modal lint-modal" onClick={(e) => e.stopPropagation()}>
              <button
                className="auth-modal-close"
                onClick={() => setLintFindings(null)}
                aria-label="Close"
              >
                ×
              </button>
              <h2 className="lint-modal-title">
                Code Check{selectedExprRow ? ` — ${selectedExprRow.expressionName || "(unnamed)"}` : ""}
              </h2>
              {lintFindings.length === 0 ? (
                <p className="auth-form-hint">No issues found.</p>
              ) : (
                <div className="admin-request-list lint-findings">
                  {lintFindings.map((f) => (
                    <div key={f.id} className="admin-request-row lint-finding">
                      <div className="lint-finding-header">
                        <span className={`lint-badge lint-badge-${f.category}`}>
                          {f.category === "syntax-error" ? "Syntax Error" : "Simplify"}
                        </span>
                        <span className="admin-request-meta">{f.location}</span>
                      </div>
                      <div className="admin-request-message">{f.message}</div>
                      {f.before !== undefined && f.after !== undefined && (
                        <div className="lint-diff">
                          <div className="lint-diff-before">− {f.before}</div>
                          <div className="lint-diff-after">+ {f.after}</div>
                        </div>
                      )}
                      <div className="admin-request-actions">
                        {f.fix && (
                          <button className="auth-submit" onClick={() => applyLintFix(f)}>
                            Apply Fix
                          </button>
                        )}
                        {f.deletable && (
                          <button className="btn btn-danger" onClick={() => applyLintDelete(f)}>
                            Delete Row
                          </button>
                        )}
                        <button className="btn" onClick={() => dismissFinding(f.id)}>
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default ExpressionBuilderGrid;
