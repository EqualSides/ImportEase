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
  RefDocumentRow,
  XDocEntityTypeRow,
  createRefDocumentNode,
  createXDocEntityTypeNode,
  deleteRefDocument,
  deleteXDocEntityType,
  findRefDocumentByUid,
  findXDocEntityTypeByUid,
  getXDocEntityTypeNodes,
  nextRefIdNumber,
  setRefDocumentField,
  setXDocEntityTypeField,
  toRefDocumentRow,
  toXDocEntityTypeRow,
} from "@/lib/xml/refDocument";

export interface RefDocumentGridHandle {
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

const DOC_COLUMN_META: ColumnMeta[] = [
  { field: "documentType", headerName: "Document Type", editable: true },
  { field: "docCode", headerName: "Doc Code", editable: true, hide: true },
  { field: "docSeqNumber", headerName: "Seq #", editable: true, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "resDocCode", headerName: "Res Doc Code", editable: true, hide: true },
  { field: "documentName", headerName: "Document Name", editable: true, hide: true },
  { field: "documentComment", headerName: "Comment", editable: true, hide: true },
  { field: "docStatusGroup", headerName: "Status Group", editable: true, hide: true },
  { field: "guideGroup", headerName: "Guide Group", editable: true, hide: true },
  { field: "reviewStatusGroup", headerName: "Review Status Group", editable: true, hide: true },
  { field: "autoDownload", headerName: "Auto Download", editable: true, hide: true },
  { field: "restrictDocTypeForACA", headerName: "Restrict for ACA", editable: true, hide: true },
  { field: "deleteRole", headerName: "Delete Role", editable: true, hide: true },
  { field: "titleRestrictRole", headerName: "Title Restrict Role", editable: true, hide: true },
  { field: "uploadRole", headerName: "Upload Role", editable: true, hide: true },
  { field: "viewRole", headerName: "View Role", editable: true, hide: true },
  { field: "entityTypeCount", headerName: "# Entity Types", editable: false },
];

const ENTITY_TYPE_COLUMN_META: ColumnMeta[] = [
  { field: "entType", headerName: "Entity Type", editable: true },
  { field: "entValue", headerName: "Entity Value", editable: true },
  { field: "licType", headerName: "License Type", editable: true, hide: true },
  { field: "docGroup", headerName: "Doc Group", editable: false, hide: true },
  { field: "resID", headerName: "Res ID", editable: true, hide: true },
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

const RefDocumentGrid = forwardRef<RefDocumentGridHandle, Props>(function RefDocumentGrid(
  { records, onChange, gridThemeClass, agencyId },
  ref
) {
  const [docRows, setDocRows] = useState<RefDocumentRow[]>(() => records.map(toRefDocumentRow));
  const [selectedUid, setSelectedUid] = useState<string | null>(docRows[0]?.uid ?? null);

  const selectedNode = useMemo(
    () => (selectedUid ? findRefDocumentByUid(records, selectedUid) ?? null : null),
    [records, selectedUid]
  );

  const [entityTypeRows, setEntityTypeRows] = useState<XDocEntityTypeRow[]>(() =>
    selectedNode ? getXDocEntityTypeNodes(selectedNode).map(toXDocEntityTypeRow) : []
  );

  const docGridRef = useRef<AgGridReact<RefDocumentRow>>(null);
  const entityTypeGridRef = useRef<AgGridReact<XDocEntityTypeRow>>(null);
  const pendingDocFocusUid = useRef<string | null>(null);
  const pendingEntityTypeFocusUid = useRef<string | null>(null);

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
    setTopPanelHeight(Math.min(naturalPanelHeight(docRows.length), soft, cap));
  }, [docRows.length]);

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

  const docColumnDefs = useMemo(
    () => buildColumnDefs<RefDocumentRow>(DOC_COLUMN_META, docRows),
    [docRows]
  );
  const entityTypeColumnDefs = useMemo(
    () => buildColumnDefs<XDocEntityTypeRow>(ENTITY_TYPE_COLUMN_META, entityTypeRows),
    [entityTypeRows]
  );

  useEffect(() => {
    const uid = pendingDocFocusUid.current;
    pendingDocFocusUid.current = null;
    if (!uid) return;
    const api = docGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "documentType");
    }
  }, [docRows]);

  useEffect(() => {
    const uid = pendingEntityTypeFocusUid.current;
    pendingEntityTypeFocusUid.current = null;
    if (!uid) return;
    const api = entityTypeGridRef.current?.api;
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) {
      rowNode.setSelected(true, true);
      api.ensureNodeVisible(rowNode);
      if (rowNode.rowIndex != null) api.setFocusedCell(rowNode.rowIndex, "entType");
    }
  }, [entityTypeRows]);

  const refreshEntityTypeRows = useCallback((node: PNode | null) => {
    setEntityTypeRows(node ? getXDocEntityTypeNodes(node).map(toXDocEntityTypeRow) : []);
  }, []);

  const refreshDocRow = useCallback((node: PNode) => {
    const updated = toRefDocumentRow(node);
    setDocRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
  }, []);

  const flashRow = useCallback((api: any, uid: string, field: string) => {
    const rowNode = api?.getRowNode(uid);
    if (api && rowNode) api.flashCells({ rowNodes: [rowNode], columns: [field] });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      applyAgencyIdToAll: (value: string) => {
        for (const docNode of records) {
          setRefDocumentField(docNode, "serviceProviderCode", value);
        }
        setDocRows(records.map(toRefDocumentRow));
        if (selectedNode) refreshEntityTypeRows(selectedNode);
        onChange();
      },
    }),
    [records, selectedNode, refreshEntityTypeRows, onChange]
  );

  const onSelectionChanged = useCallback(() => {
    const selected = docGridRef.current?.api.getSelectedRows() ?? [];
    const uid = selected[0]?.uid ?? null;
    setSelectedUid(uid);
    const node = uid ? findRefDocumentByUid(records, uid) : null;
    refreshEntityTypeRows(node ?? null);
  }, [records, refreshEntityTypeRows]);

  const onDocCellValueChanged = useCallback(
    (e: CellValueChangedEvent<RefDocumentRow>) => {
      const node = findRefDocumentByUid(records, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setRefDocumentField(node, field, String(e.newValue ?? ""));
      refreshDocRow(node);
      if ((field === "docCode" || field === "serviceProviderCode") && selectedUid === e.data.uid) {
        refreshEntityTypeRows(node);
      }
      flashRow(docGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [records, selectedUid, refreshEntityTypeRows, refreshDocRow, flashRow, onChange]
  );

  const onEntityTypeCellValueChanged = useCallback(
    (e: CellValueChangedEvent<XDocEntityTypeRow>) => {
      if (!selectedNode) return;
      const node = findXDocEntityTypeByUid(selectedNode, e.data.uid);
      if (!node) return;
      const field = e.colDef.field as string;
      setXDocEntityTypeField(node, field, String(e.newValue ?? ""));
      const updated = toXDocEntityTypeRow(node);
      setEntityTypeRows((prev) => prev.map((r) => (r.uid === updated.uid ? updated : r)));
      flashRow(entityTypeGridRef.current?.api, e.data.uid, field);
      onChange();
    },
    [selectedNode, flashRow, onChange]
  );

  const addDocRow = useCallback(() => {
    const num = nextRefIdNumber(records);
    const node = createRefDocumentNode(num, agencyId);
    records.push(node);
    const row = toRefDocumentRow(node);
    pendingDocFocusUid.current = row.uid;
    setDocRows((prev) => [...prev, row]);
    onChange();
  }, [records, agencyId, onChange]);

  const deleteSelectedDocRows = useCallback(() => {
    const selected = (docGridRef.current?.api.getSelectedRows() ?? []) as RefDocumentRow[];
    for (const row of selected) {
      const node = findRefDocumentByUid(records, row.uid);
      if (node) deleteRefDocument(records, node);
    }
    const deletedUids = new Set(selected.map((r) => r.uid));
    setDocRows((prev) => prev.filter((r) => !deletedUids.has(r.uid)));
    if (selectedUid && deletedUids.has(selectedUid)) {
      setSelectedUid(null);
      setEntityTypeRows([]);
    }
    onChange();
  }, [records, selectedUid, onChange]);

  const addEntityTypeRow = useCallback(() => {
    if (!selectedNode) return;
    const docRow = toRefDocumentRow(selectedNode);
    const node = createXDocEntityTypeNode(docRow.docCode, docRow.serviceProviderCode);
    getXDocEntityTypeNodes(selectedNode).push(node);
    const row = toXDocEntityTypeRow(node);
    pendingEntityTypeFocusUid.current = row.uid;
    setEntityTypeRows((prev) => [...prev, row]);
    refreshDocRow(selectedNode);
    onChange();
  }, [selectedNode, refreshDocRow, onChange]);

  const deleteSelectedEntityTypeRows = useCallback(() => {
    if (!selectedNode) return;
    const selected = (entityTypeGridRef.current?.api.getSelectedRows() ?? []) as XDocEntityTypeRow[];
    for (const row of selected) {
      const node = findXDocEntityTypeByUid(selectedNode, row.uid);
      if (node) deleteXDocEntityType(selectedNode, node);
    }
    refreshEntityTypeRows(selectedNode);
    refreshDocRow(selectedNode);
    onChange();
  }, [selectedNode, refreshEntityTypeRows, refreshDocRow, onChange]);

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
            title={topPanelCollapsed ? "Expand Documents" : "Collapse Documents"}
          >
            {topPanelCollapsed ? "▸" : "▾"}
          </button>
          <button className="btn" onClick={addDocRow}>
            + Add Document
          </button>
          <button className="btn btn-danger" onClick={deleteSelectedDocRows}>
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            Documents ({docRows.length})
            {topPanelCollapsed && selectedNode && (
              <>
                {" — "}
                <strong>{toRefDocumentRow(selectedNode).documentType || "(unnamed)"}</strong>
              </>
            )}
          </span>
        </div>
        {!topPanelCollapsed && (
          <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
            <AgGridReact<RefDocumentRow>
              ref={docGridRef}
              rowData={docRows}
              columnDefs={docColumnDefs}
              rowHeight={ROW_HEIGHT}
              headerHeight={HEADER_HEIGHT}
              getRowId={(p) => p.data.uid}
              rowSelection="single"
              onSelectionChanged={onSelectionChanged}
              onCellValueChanged={onDocCellValueChanged}
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
          <button className="btn" onClick={addEntityTypeRow} disabled={!selectedNode}>
            + Add Entity Type
          </button>
          <button
            className="btn btn-danger"
            onClick={deleteSelectedEntityTypeRows}
            disabled={!selectedNode}
          >
            Delete Selected
          </button>
          <span className="grid-toolbar-label">
            {selectedNode
              ? `Entity Types for "${toRefDocumentRow(selectedNode).documentType || "(unnamed)"}" (${entityTypeRows.length})`
              : "Select a Document above to see its entity types"}
          </span>
        </div>
        <div className={gridThemeClass} style={{ flex: 1, width: "100%", minHeight: 0 }}>
          <AgGridReact<XDocEntityTypeRow>
            ref={entityTypeGridRef}
            rowData={entityTypeRows}
            columnDefs={entityTypeColumnDefs}
            rowHeight={ROW_HEIGHT}
            headerHeight={HEADER_HEIGHT}
            getRowId={(p) => p.data.uid}
            rowSelection="multiple"
            onCellValueChanged={onEntityTypeCellValueChanged}
            stopEditingWhenCellsLoseFocus
          />
        </div>
      </div>
    </div>
  );
});

export default RefDocumentGrid;
