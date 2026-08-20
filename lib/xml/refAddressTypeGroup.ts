/**
 * RefAddressTypeGroupModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Smallest parent/child category — a group record with a repeating list of
 * address types under it. Unlike Standard Choice/Shared Drop-down, the
 * Agency ID field is named `servProvCode` at *both* levels here (confirmed
 * against a real 1-record sample, fixtures/ref-addr-type-group/ratg-real.xml)
 * — no field-name split to handle, but still explicit per-model rather than
 * assumed, per architecture-and-safety-update.md's warning. Neither level
 * carries a `refId` attribute in the real sample.
 */
import {
  type ListAttrs,
  type ParsedListFile,
  type PNode,
  createAuditModelNode,
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
export type ParsedRefAddressTypeGroupFile = ParsedListFile;

const COLLECTION_TAGS = new Set(["refAddressTypeModels"]);

/** Cheap content sniff — real export files aren't necessarily named "RefAddressTypeGroupModel.xml". */
export function isRefAddressTypeGroupXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<RefAddressTypeGroup[\s>]/.test(xmlText);
}

export function parseRefAddressTypeGroupXml(xmlText: string): ParsedRefAddressTypeGroupFile {
  return parseListXml(xmlText, "RefAddressTypeGroup");
}

export function serializeRefAddressTypeGroupXml(
  file: ParsedRefAddressTypeGroupFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedRefAddressTypeGroupXml(file: ParsedRefAddressTypeGroupFile): string {
  return serializeRefAddressTypeGroupXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations
// ---------------------------------------------------------------------------

export interface RefAddressTypeGroupRow {
  uid: string;
  refId: string;
  addrGroup: string;
  addrGroupSeq: string;
  servProvCode: string;
  typeCount: number;
}

function getOrCreateTypeNodesArray(groupNode: PNode): PNode[] {
  const children = getChildren(groupNode);
  let container = children.find((c) => Object.keys(c).includes("refAddressTypeModels"));
  if (!container) {
    container = { refAddressTypeModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toRefAddressTypeGroupRow(node: PNode): RefAddressTypeGroupRow {
  const children = getChildren(node);
  const typeCount = getOrCreateTypeNodesArray(node).filter((c) =>
    Object.keys(c).includes("refAddressType")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    addrGroup: getChildText(children, "addrGroup"),
    addrGroupSeq: getChildText(children, "addrGroupSeq"),
    servProvCode: getChildText(children, "servProvCode"),
    typeCount,
  };
}

export interface RefAddressTypeRow {
  uid: string;
  refId: string;
  addrType: string;
  addrGroup: string;
  addrGroupSeq: string;
  servProvCode: string;
}

export function toRefAddressTypeRow(node: PNode): RefAddressTypeRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    addrType: getChildText(children, "addrType"),
    addrGroup: getChildText(children, "addrGroup"),
    addrGroupSeq: getChildText(children, "addrGroupSeq"),
    servProvCode: getChildText(children, "servProvCode"),
  };
}

export function inferCommonAgencyId(rows: RefAddressTypeGroupRow[]): string {
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
  suffix: "RefAddressTypeGroupModel" | "RefAddressTypeModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findRefAddressTypeGroupByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findRefAddressTypeByUid(groupNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateTypeNodesArray(groupNode), uid);
}

export function getRefAddressTypeNodes(groupNode: PNode): PNode[] {
  return getOrCreateTypeNodesArray(groupNode);
}

export const REF_ADDRESS_TYPE_GROUP_EDITABLE_FIELDS = [
  "addrGroup",
  "addrGroupSeq",
  "servProvCode",
] as const;

export const REF_ADDRESS_TYPE_EDITABLE_FIELDS = [
  "addrType",
  "addrGroup",
  "addrGroupSeq",
  "servProvCode",
] as const;

export function setRefAddressTypeGroupField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "addrGroup" || field === "addrGroupSeq") {
    for (const t of getOrCreateTypeNodesArray(node)) {
      setChildText(getChildren(t), field, value);
    }
  }
}

export function setRefAddressTypeField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createRefAddressTypeGroupNode(refIdNum: number, servProvCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "addrGroupSeq", "");
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "addrGroup", "");
  children.push(createAuditModelNode());
  children.push({ refAddressTypeModels: [] });
  const node: PNode = { RefAddressTypeGroup: children };
  setAttr(node, "refId", `${refIdNum}@RefAddressTypeGroupModel`);
  return node;
}

export function createRefAddressTypeNode(
  refIdNum: number,
  addrGroup: string,
  addrGroupSeq: string,
  servProvCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "addrGroupSeq", addrGroupSeq);
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "addrGroup", addrGroup);
  setChildText(children, "addrType", "");
  children.push(createAuditModelNode());
  const node: PNode = { refAddressType: children };
  setAttr(node, "refId", `${refIdNum}@RefAddressTypeModel`);
  return node;
}

export function deleteRefAddressTypeGroup(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteRefAddressType(groupNode: PNode, typeNode: PNode) {
  const arr = getOrCreateTypeNodesArray(groupNode);
  const idx = arr.indexOf(typeNode);
  if (idx >= 0) arr.splice(idx, 1);
}
