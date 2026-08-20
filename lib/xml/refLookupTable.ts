/**
 * RefLookupTableModel.xml parse/serialize (see full-schema-reference.md).
 *
 * First three-level category this app handles — a lookup table has a
 * repeating list of columns, and each column has its own repeating list of
 * values (unlike every prior category, which bottoms out after one level of
 * children). Confirmed against a real 2-record sample
 * (fixtures/ref-lookup-table/rlt-real.xml: one single-column/single-value
 * table, one two-column/eight-value table).
 *
 * The value list has an unusual wrapping shape: each column holds exactly
 * one `<lookupTableValue>` child (singular, always present, never itself
 * repeated), and *that* wraps the actual repeating `<lookupTableValues>`
 * elements (plural tag, one per value row) — so "the value list container"
 * for a column is `lookupTableValue`'s own children array, not a
 * `xxxModels`-style container living directly on the column like every
 * other category's collection tag. getOrCreateValueNodesArray below reads
 * through that single-wrapper layer the same way getNestedText/setNestedText
 * in pnode.ts read through InspRelateInsp's virtualString wrapper.
 *
 * No `refId` attribute anywhere in the real sample, at any of the three
 * levels.
 */
import {
  type ListAttrs,
  type ParsedListFile,
  type PNode,
  createAuditModelNode,
  findChildByTag,
  findNodeByUid,
  formatAccelaDateTime,
  getAttr,
  getChildren,
  getChildText,
  getNodeUid,
  nextRefIdNumber as nextRefIdNumberGeneric,
  parseListXml,
  serializeListXml,
  setChildText,
} from "./pnode";

export type { PNode, ListAttrs };
export type ParsedRefLookupTableFile = ParsedListFile;

const COLLECTION_TAGS = new Set(["lookupTableColumns", "lookupTableValue", "lookupTableValueI18N"]);

/** Cheap content sniff — real export files aren't necessarily named "RefLookupTableModel.xml". */
export function isRefLookupTableXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<refLookupTable[\s>]/.test(xmlText);
}

export function parseRefLookupTableXml(xmlText: string): ParsedRefLookupTableFile {
  return parseListXml(xmlText, "refLookupTable");
}

export function serializeRefLookupTableXml(
  file: ParsedRefLookupTableFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedRefLookupTableXml(file: ParsedRefLookupTableFile): string {
  return serializeRefLookupTableXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations — three levels: table -> column -> value
// ---------------------------------------------------------------------------

export interface RefLookupTableRow {
  uid: string;
  refId: string;
  lookupTableName: string;
  category: string;
  group: string;
  lookupEntityType: string;
  subType: string;
  type: string;
  serviceProviderCode: string;
  columnCount: number;
}

function getOrCreateColumnNodesArray(tableNode: PNode): PNode[] {
  const children = getChildren(tableNode);
  let container = children.find((c) => Object.keys(c).includes("lookupTableColumns"));
  if (!container) {
    container = { lookupTableColumns: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toRefLookupTableRow(node: PNode): RefLookupTableRow {
  const children = getChildren(node);
  const columnCount = getOrCreateColumnNodesArray(node).filter((c) =>
    Object.keys(c).includes("lookupTableColumn")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    lookupTableName: getChildText(children, "lookupTableName"),
    category: getChildText(children, "category"),
    group: getChildText(children, "group"),
    lookupEntityType: getChildText(children, "lookupEntityType"),
    subType: getChildText(children, "subType"),
    type: getChildText(children, "type"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    columnCount,
  };
}

export interface LookupTableColumnRow {
  uid: string;
  refId: string;
  lookupColumnName: string;
  lookupColumnNumber: string;
  lookupColumnType: string;
  lookupGroup: string;
  lookupSubgroup: string;
  displayLength: string;
  maxLength: string;
  lookupTableName: string;
  serviceProviderCode: string;
  valueCount: number;
}

/** The one-wrapper-then-repeating-plural shape described in the module doc comment. */
function getOrCreateValueNodesArray(columnNode: PNode): PNode[] {
  const children = getChildren(columnNode);
  let wrapper = findChildByTag(children, "lookupTableValue");
  if (!wrapper) {
    wrapper = { lookupTableValue: [] };
    children.push(wrapper);
  }
  return getChildren(wrapper);
}

export function toLookupTableColumnRow(node: PNode): LookupTableColumnRow {
  const children = getChildren(node);
  const valueCount = getOrCreateValueNodesArray(node).filter((c) =>
    Object.keys(c).includes("lookupTableValues")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    lookupColumnName: getChildText(children, "lookupColumnName"),
    lookupColumnNumber: getChildText(children, "lookupColumnNumber"),
    lookupColumnType: getChildText(children, "lookupColumnType"),
    lookupGroup: getChildText(children, "lookupGroup"),
    lookupSubgroup: getChildText(children, "lookupSubgroup"),
    displayLength: getChildText(children, "displayLength"),
    maxLength: getChildText(children, "maxLength"),
    lookupTableName: getChildText(children, "lookupTableName"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    valueCount,
  };
}

export interface LookupTableValueRow {
  uid: string;
  refId: string;
  lookupColumnValue: string;
  lookupRowNumber: string;
  lookupColumnName: string;
  lookupColumnNumber: string;
  lookupGroup: string;
  lookupSubgroup: string;
  lookupTableName: string;
  serviceProviderCode: string;
}

export function toLookupTableValueRow(node: PNode): LookupTableValueRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    lookupColumnValue: getChildText(children, "lookupColumnValue"),
    lookupRowNumber: getChildText(children, "lookupRowNumber"),
    lookupColumnName: getChildText(children, "lookupColumnName"),
    lookupColumnNumber: getChildText(children, "lookupColumnNumber"),
    lookupGroup: getChildText(children, "lookupGroup"),
    lookupSubgroup: getChildText(children, "lookupSubgroup"),
    lookupTableName: getChildText(children, "lookupTableName"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: RefLookupTableRow[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r.serviceProviderCode.trim();
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

export function nextRefIdNumber(
  records: PNode[],
  suffix: "RefLookupTableModel" | "LookupTableColumnModel" | "LookupTableValueModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findRefLookupTableByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findLookupTableColumnByUid(tableNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateColumnNodesArray(tableNode), uid);
}

export function findLookupTableValueByUid(columnNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateValueNodesArray(columnNode), uid);
}

export function getLookupTableColumnNodes(tableNode: PNode): PNode[] {
  return getOrCreateColumnNodesArray(tableNode);
}

export function getLookupTableValueNodes(columnNode: PNode): PNode[] {
  return getOrCreateValueNodesArray(columnNode);
}

export const REF_LOOKUP_TABLE_EDITABLE_FIELDS = [
  "lookupTableName",
  "category",
  "group",
  "lookupEntityType",
  "subType",
  "type",
  "serviceProviderCode",
] as const;

export const LOOKUP_TABLE_COLUMN_EDITABLE_FIELDS = [
  "lookupColumnName",
  "lookupColumnNumber",
  "lookupColumnType",
  "lookupGroup",
  "lookupSubgroup",
  "displayLength",
  "maxLength",
  "lookupTableName",
  "serviceProviderCode",
] as const;

export const LOOKUP_TABLE_VALUE_EDITABLE_FIELDS = [
  "lookupColumnValue",
  "lookupRowNumber",
  "lookupColumnName",
  "lookupColumnNumber",
  "lookupGroup",
  "lookupSubgroup",
  "lookupTableName",
  "serviceProviderCode",
] as const;

/** Editing the table's name cascades into every column's and every value's lookupTableName. */
export function setRefLookupTableField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "lookupTableName") {
    for (const col of getOrCreateColumnNodesArray(node)) {
      setChildText(getChildren(col), field, value);
      for (const val of getOrCreateValueNodesArray(col)) {
        setChildText(getChildren(val), field, value);
      }
    }
  }
}

/** Editing a column's name/number/group/subgroup cascades into its own values only. */
export function setLookupTableColumnField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (
    field === "lookupColumnName" ||
    field === "lookupColumnNumber" ||
    field === "lookupGroup" ||
    field === "lookupSubgroup"
  ) {
    for (const val of getOrCreateValueNodesArray(node)) {
      setChildText(getChildren(val), field, value);
    }
  }
}

export function setLookupTableValueField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createRefLookupTableNode(_refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "lookupTableName", "");
  children.push(createAuditModelNode());
  setChildText(children, "category", "");
  setChildText(children, "group", "");
  setChildText(children, "lookupEntityType", "");
  children.push({ lookupTableColumns: [] });
  setChildText(children, "subType", "");
  setChildText(children, "type", "");
  return { refLookupTable: children };
}

export function createLookupTableColumnNode(
  _refIdNum: number,
  lookupTableName: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "lookupTableName", lookupTableName);
  setChildText(children, "lookupColumnNumber", "");
  children.push(createAuditModelNode());
  setChildText(children, "displayLength", "0");
  setChildText(children, "lookupColumnName", "");
  setChildText(children, "lookupColumnType", "");
  setChildText(children, "lookupGroup", "");
  setChildText(children, "lookupSubgroup", "");
  children.push({ lookupTableValue: [] });
  setChildText(children, "maxLength", "0");
  return { lookupTableColumn: children };
}

export function createLookupTableValueNode(
  _refIdNum: number,
  lookupTableName: string,
  lookupColumnName: string,
  lookupColumnNumber: string,
  lookupGroup: string,
  lookupSubgroup: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "lookupTableName", lookupTableName);
  setChildText(children, "lookupColumnNumber", lookupColumnNumber);
  setChildText(children, "lookupRowNumber", "");
  children.push(createAuditModelNode());
  setChildText(children, "lookupColumnName", lookupColumnName);
  setChildText(children, "lookupColumnValue", "");
  setChildText(children, "lookupGroup", lookupGroup);
  setChildText(children, "lookupSubgroup", lookupSubgroup);
  children.push({ lookupTableValueI18N: [] });
  return { lookupTableValues: children };
}

export function deleteRefLookupTable(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteLookupTableColumn(tableNode: PNode, columnNode: PNode) {
  const arr = getOrCreateColumnNodesArray(tableNode);
  const idx = arr.indexOf(columnNode);
  if (idx >= 0) arr.splice(idx, 1);
}

export function deleteLookupTableValue(columnNode: PNode, valueNode: PNode) {
  const arr = getOrCreateValueNodesArray(columnNode);
  const idx = arr.indexOf(valueNode);
  if (idx >= 0) arr.splice(idx, 1);
}
