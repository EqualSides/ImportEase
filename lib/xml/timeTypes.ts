/**
 * TimeTypesModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Flat category — one record per billable time type. Real records can carry
 * an embedded `timeTypeSecurityModels` collection (⚠️ security/permission
 * references, per architecture-and-safety-update.md) — untouched fields
 * round-trip byte-for-byte regardless (see lib/xml/pnode.ts), so this module
 * never reads or edits that sub-structure, only the plain fields below.
 * Confirmed against a real 1-record sample with no security models present
 * (fixtures/time-types/tt-real.xml). This category uses `servProvCode`
 * (not `serviceProviderCode`).
 */
import {
  type ListAttrs,
  type ParsedListFile,
  type PNode,
  findNodeByUid,
  formatAccelaDateTime,
  getAttr,
  getChildren,
  getChildText,
  getNodeUid,
  nextRefIdNumber as nextRefIdNumberGeneric,
  parseListXml,
  serializeListXml,
  setAttr,
  setChildText,
} from "./pnode";

export type { PNode, ListAttrs };
export type ParsedTimeTypesFile = ParsedListFile;

const COLLECTION_TAGS = new Set(["timeProfileTypeModels", "timeTypeSecurityModels", "timeTypeI18Ns"]);

/** Cheap content sniff — real export files aren't necessarily named "TimeTypesModel.xml". */
export function isTimeTypesXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<r1TimeTypes[\s>]/.test(xmlText);
}

export function parseTimeTypesXml(xmlText: string): ParsedTimeTypesFile {
  return parseListXml(xmlText, "r1TimeTypes");
}

export function serializeTimeTypesXml(
  file: ParsedTimeTypesFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedTimeTypesXml(file: ParsedTimeTypesFile): string {
  return serializeTimeTypesXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// Index signature so this satisfies components/FlatGrid.tsx's FlatGridRow
// shape without a cast — every field here is a plain string.
export interface TimeTypesRow {
  [field: string]: string;
  uid: string;
  refId: string;
  timeTypeName: string;
  recordType: string;
  billableFlag: string;
  defaultPctAdj: string;
  defaultRate: string;
  r1PerCategory: string;
  r1PerGroup: string;
  r1PerSubType: string;
  r1PerType: string;
  timeTypeSeq: string;
  servProvCode: string;
}

export function toTimeTypesRow(node: PNode): TimeTypesRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    timeTypeName: getChildText(children, "timeTypeName"),
    recordType: getChildText(children, "recordType"),
    billableFlag: getChildText(children, "billableFlag"),
    defaultPctAdj: getChildText(children, "defaultPctAdj"),
    defaultRate: getChildText(children, "defaultRate"),
    r1PerCategory: getChildText(children, "r1PerCategory"),
    r1PerGroup: getChildText(children, "r1PerGroup"),
    r1PerSubType: getChildText(children, "r1PerSubType"),
    r1PerType: getChildText(children, "r1PerType"),
    timeTypeSeq: getChildText(children, "timeTypeSeq"),
    servProvCode: getChildText(children, "servProvCode"),
  };
}

export function inferCommonAgencyId(rows: TimeTypesRow[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r.servProvCode.trim();
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

export function nextRefIdNumber(records: PNode[]): number {
  return nextRefIdNumberGeneric(records, "TimeTypesModel");
}

export function findTimeTypesByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export const TIME_TYPES_EDITABLE_FIELDS = [
  "timeTypeName",
  "recordType",
  "billableFlag",
  "defaultPctAdj",
  "defaultRate",
  "r1PerCategory",
  "r1PerGroup",
  "r1PerSubType",
  "r1PerType",
  "timeTypeSeq",
  "servProvCode",
] as const;

export function setTimeTypesField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createTimeTypesNode(refIdNum: number, servProvCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "timeTypeSeq", "");
  setChildText(children, "billableFlag", "");
  setChildText(children, "defaultPctAdj", "");
  setChildText(children, "defaultRate", "");
  setChildText(children, "r1PerCategory", "");
  setChildText(children, "r1PerGroup", "");
  setChildText(children, "r1PerSubType", "");
  setChildText(children, "r1PerType", "");
  setChildText(children, "recDate", new Date().toISOString());
  setChildText(children, "recFulNam", "IMPORTEASE");
  setChildText(children, "recStatus", "A");
  setChildText(children, "recordType", "");
  children.push({ timeProfileTypeModels: [] });
  setChildText(children, "timeTypeName", "");
  children.push({ timeTypeSecurityModels: [] });
  children.push({ timeTypeI18Ns: [] });
  const node: PNode = { r1TimeTypes: children };
  setAttr(node, "refId", `${refIdNum}@TimeTypesModel`);
  return node;
}

export function deleteTimeTypes(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}
