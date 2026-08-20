/**
 * SequenceModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Parent/child category — a sequence definition with a repeating list of
 * per-interval counters under it. Confirmed against a real 2-record sample
 * (fixtures/sequence/seq-real.xml, one with an empty interval list and one
 * with a populated one): both levels use `serviceProviderCode` (no field-
 * name split, like RefAddressTypeGroup) and every record reuses the same
 * `refId="1@SequenceModel"` — the same non-unique-refId situation
 * Standard Choice/Organization-Agency have, so row identity uses the
 * synthetic uid (getNodeUid in lib/xml/pnode.ts), not refId.
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
export type ParsedSequenceFile = ParsedListFile;

const COLLECTION_TAGS = new Set(["sequenceIntervalModels"]);

/** Cheap content sniff — real export files aren't necessarily named "SequenceModel.xml". */
export function isSequenceXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<sequence[\s>]/.test(xmlText);
}

export function parseSequenceXml(xmlText: string): ParsedSequenceFile {
  return parseListXml(xmlText, "sequence");
}

export function serializeSequenceXml(
  file: ParsedSequenceFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedSequenceXml(file: ParsedSequenceFile): string {
  return serializeSequenceXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations
// ---------------------------------------------------------------------------

export interface SequenceRow {
  uid: string;
  refId: string;
  name: string;
  type: string;
  description: string;
  cacheSize: string;
  increaseValue: string;
  intervalType: string;
  minValue: string;
  resetAction: string;
  resetValue: string;
  serviceProviderCode: string;
  intervalCount: number;
}

function getOrCreateIntervalNodesArray(seqNode: PNode): PNode[] {
  const children = getChildren(seqNode);
  let container = children.find((c) => Object.keys(c).includes("sequenceIntervalModels"));
  if (!container) {
    container = { sequenceIntervalModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toSequenceRow(node: PNode): SequenceRow {
  const children = getChildren(node);
  const intervalCount = getOrCreateIntervalNodesArray(node).filter((c) =>
    Object.keys(c).includes("sequenceInterval")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    name: getChildText(children, "name"),
    type: getChildText(children, "type"),
    description: getChildText(children, "description"),
    cacheSize: getChildText(children, "cacheSize"),
    increaseValue: getChildText(children, "increaseValue"),
    intervalType: getChildText(children, "intervalType"),
    minValue: getChildText(children, "minValue"),
    resetAction: getChildText(children, "resetAction"),
    resetValue: getChildText(children, "resetValue"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    intervalCount,
  };
}

export interface SequenceIntervalRow {
  uid: string;
  refId: string;
  intervalName: string;
  sequenceName: string;
  sequenceType: string;
  lastSequenceNbr: string;
  serviceProviderCode: string;
}

export function toSequenceIntervalRow(node: PNode): SequenceIntervalRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    intervalName: getChildText(children, "intervalName"),
    sequenceName: getChildText(children, "sequenceName"),
    sequenceType: getChildText(children, "sequenceType"),
    lastSequenceNbr: getChildText(children, "lastSequenceNbr"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: SequenceRow[]): string {
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
  suffix: "SequenceModel" | "SequenceIntervalModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findSequenceByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findSequenceIntervalByUid(seqNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateIntervalNodesArray(seqNode), uid);
}

export function getSequenceIntervalNodes(seqNode: PNode): PNode[] {
  return getOrCreateIntervalNodesArray(seqNode);
}

export const SEQUENCE_EDITABLE_FIELDS = [
  "name",
  "type",
  "description",
  "cacheSize",
  "increaseValue",
  "intervalType",
  "minValue",
  "resetAction",
  "resetValue",
  "serviceProviderCode",
] as const;

export const SEQUENCE_INTERVAL_EDITABLE_FIELDS = [
  "intervalName",
  "sequenceName",
  "sequenceType",
  "lastSequenceNbr",
  "serviceProviderCode",
] as const;

/**
 * Editing the parent's `name`/`type` cascades to the matching fields on
 * every interval child (`sequenceName`/`sequenceType` — each interval
 * carries a duplicate copy of the parent's identity, same shape as
 * RefAddressTypeGroup's addrGroup/addrGroupSeq cascade).
 */
export function setSequenceField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "name" || field === "type") {
    const targetField = field === "name" ? "sequenceName" : "sequenceType";
    for (const iv of getOrCreateIntervalNodesArray(node)) {
      setChildText(getChildren(iv), targetField, value);
    }
  }
}

export function setSequenceIntervalField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createSequenceNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "name", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "type", "");
  children.push(createAuditModelNode());
  setChildText(children, "cacheSize", "");
  setChildText(children, "description", "");
  setChildText(children, "increaseValue", "");
  setChildText(children, "intervalType", "");
  setChildText(children, "minValue", "");
  setChildText(children, "resetAction", "");
  setChildText(children, "resetValue", "");
  children.push({ sequenceIntervalModels: [] });
  const node: PNode = { sequence: children };
  setAttr(node, "refId", `${refIdNum}@SequenceModel`);
  return node;
}

export function createSequenceIntervalNode(
  refIdNum: number,
  sequenceName: string,
  sequenceType: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "intervalName", "");
  setChildText(children, "sequenceName", sequenceName);
  setChildText(children, "sequenceType", sequenceType);
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push(createAuditModelNode());
  setChildText(children, "lastSequenceNbr", "0");
  const node: PNode = { sequenceInterval: children };
  setAttr(node, "refId", `${refIdNum}@SequenceIntervalModel`);
  return node;
}

export function deleteSequence(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteSequenceInterval(seqNode: PNode, intervalNode: PNode) {
  const arr = getOrCreateIntervalNodesArray(seqNode);
  const idx = arr.indexOf(intervalNode);
  if (idx >= 0) arr.splice(idx, 1);
}
