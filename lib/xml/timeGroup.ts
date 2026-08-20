/**
 * TimeGroupModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Parent/child category — a time group with a repeating list of assigned
 * time types under it. Real records can carry an embedded
 * `timeGroupSecurityModels` collection (⚠️ security/permission references,
 * per architecture-and-safety-update.md) — untouched fields round-trip
 * byte-for-byte regardless (see lib/xml/pnode.ts), so this module never
 * reads or edits that sub-structure. Confirmed against a real 1-record
 * sample with an empty security-models collection and one populated child
 * time type (fixtures/time-group/tg-real.xml). Both levels use
 * `servProvCode` (not `serviceProviderCode`), and the child duplicates the
 * parent's `timeGroupSeq` — editing the parent's identity field cascades
 * into the children, same shape as RefAddressTypeGroup/Sequence.
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
export type ParsedTimeGroupFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "timeGroupI18nModels",
  "timeGroupSecurityModels",
  "xtimeGroupTypeModels",
]);

/** Cheap content sniff — real export files aren't necessarily named "TimeGroupModel.xml". */
export function isTimeGroupXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<r1TimeGroup[\s>]/.test(xmlText);
}

export function parseTimeGroupXml(xmlText: string): ParsedTimeGroupFile {
  return parseListXml(xmlText, "r1TimeGroup");
}

export function serializeTimeGroupXml(
  file: ParsedTimeGroupFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedTimeGroupXml(file: ParsedTimeGroupFile): string {
  return serializeTimeGroupXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations
// ---------------------------------------------------------------------------

export interface TimeGroupRow {
  uid: string;
  refId: string;
  timeGroupName: string;
  timeGroupDesc: string;
  timeGroupSeq: string;
  servProvCode: string;
  typeCount: number;
}

function getOrCreateTimeTypeNodesArray(groupNode: PNode): PNode[] {
  const children = getChildren(groupNode);
  let container = children.find((c) => Object.keys(c).includes("xtimeGroupTypeModels"));
  if (!container) {
    container = { xtimeGroupTypeModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toTimeGroupRow(node: PNode): TimeGroupRow {
  const children = getChildren(node);
  const typeCount = getOrCreateTimeTypeNodesArray(node).filter((c) =>
    Object.keys(c).includes("xtimeGroupType")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    timeGroupName: getChildText(children, "timeGroupName"),
    timeGroupDesc: getChildText(children, "timeGroupDesc"),
    timeGroupSeq: getChildText(children, "timeGroupSeq"),
    servProvCode: getChildText(children, "servProvCode"),
    typeCount,
  };
}

export interface XTimeGroupTypeRow {
  uid: string;
  refId: string;
  timeTypeSeq: string;
  timeGroupSeq: string;
  servProvCode: string;
}

export function toXTimeGroupTypeRow(node: PNode): XTimeGroupTypeRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    timeTypeSeq: getChildText(children, "timeTypeSeq"),
    timeGroupSeq: getChildText(children, "timeGroupSeq"),
    servProvCode: getChildText(children, "servProvCode"),
  };
}

export function inferCommonAgencyId(rows: TimeGroupRow[]): string {
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

export function nextRefIdNumber(
  records: PNode[],
  suffix: "TimeGroupModel" | "XTimeGroupTypeModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findTimeGroupByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findXTimeGroupTypeByUid(groupNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateTimeTypeNodesArray(groupNode), uid);
}

export function getXTimeGroupTypeNodes(groupNode: PNode): PNode[] {
  return getOrCreateTimeTypeNodesArray(groupNode);
}

export const TIME_GROUP_EDITABLE_FIELDS = [
  "timeGroupName",
  "timeGroupDesc",
  "timeGroupSeq",
  "servProvCode",
] as const;

export const XTIME_GROUP_TYPE_EDITABLE_FIELDS = [
  "timeTypeSeq",
  "timeGroupSeq",
  "servProvCode",
] as const;

export function setTimeGroupField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "timeGroupSeq") {
    for (const t of getOrCreateTimeTypeNodesArray(node)) {
      setChildText(getChildren(t), field, value);
    }
  }
}

export function setXTimeGroupTypeField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createTimeGroupNode(refIdNum: number, servProvCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "timeGroupSeq", "");
  setChildText(children, "isGroupTypeSelected", "");
  setChildText(children, "recDate", new Date().toISOString());
  setChildText(children, "recFulNam", "IMPORTEASE");
  setChildText(children, "recStatus", "A");
  setChildText(children, "timeGroupDesc", "");
  children.push({ timeGroupI18nModels: [] });
  setChildText(children, "timeGroupName", "");
  children.push({ timeGroupSecurityModels: [] });
  children.push({ xtimeGroupTypeModels: [] });
  const node: PNode = { r1TimeGroup: children };
  setAttr(node, "refId", `${refIdNum}@TimeGroupModel`);
  return node;
}

export function createXTimeGroupTypeNode(
  refIdNum: number,
  timeGroupSeq: string,
  servProvCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "timeGroupSeq", timeGroupSeq);
  setChildText(children, "timeTypeSeq", "");
  setChildText(children, "recDate", new Date().toISOString());
  setChildText(children, "recFulNam", "IMPORTEASE");
  setChildText(children, "recStatus", "A");
  const node: PNode = { xtimeGroupType: children };
  setAttr(node, "refId", `${refIdNum}@XTimeGroupTypeModel`);
  return node;
}

export function deleteTimeGroup(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteXTimeGroupType(groupNode: PNode, typeNode: PNode) {
  const arr = getOrCreateTimeTypeNodesArray(groupNode);
  const idx = arr.indexOf(typeNode);
  if (idx >= 0) arr.splice(idx, 1);
}
