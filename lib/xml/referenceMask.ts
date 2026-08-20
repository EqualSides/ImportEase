/**
 * ReferenceMaskModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Flat category — one record per mask pattern, no repeating child list.
 * Confirmed against a real 3-record sample (fixtures/reference-mask/rm-real.xml):
 * no `refId` attribute on this category in practice.
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
export type ParsedReferenceMaskFile = ParsedListFile;

const COLLECTION_TAGS = new Set<string>([]);

/** Cheap content sniff — real export files aren't necessarily named "ReferenceMaskModel.xml". */
export function isReferenceMaskXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<mask[\s>]/.test(xmlText);
}

export function parseReferenceMaskXml(xmlText: string): ParsedReferenceMaskFile {
  return parseListXml(xmlText, "mask");
}

export function serializeReferenceMaskXml(
  file: ParsedReferenceMaskFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedReferenceMaskXml(file: ParsedReferenceMaskFile): string {
  return serializeReferenceMaskXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// Index signature so this satisfies components/FlatGrid.tsx's FlatGridRow
// shape without a cast — every field here is a plain string.
export interface ReferenceMaskRow {
  [field: string]: string;
  uid: string;
  refId: string;
  name: string;
  type: string;
  description: string;
  pattern: string;
  maxLength: string;
  minLength: string;
  radixValue: string;
  seqName: string;
  serviceProviderCode: string;
}

export function toReferenceMaskRow(node: PNode): ReferenceMaskRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    name: getChildText(children, "name"),
    type: getChildText(children, "type"),
    description: getChildText(children, "description"),
    pattern: getChildText(children, "pattern"),
    maxLength: getChildText(children, "maxLength"),
    minLength: getChildText(children, "minLength"),
    radixValue: getChildText(children, "radixValue"),
    seqName: getChildText(children, "seqName"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: ReferenceMaskRow[]): string {
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

export function nextRefIdNumber(records: PNode[]): number {
  return nextRefIdNumberGeneric(records, "ReferenceMaskModel");
}

export function findReferenceMaskByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export const REFERENCE_MASK_EDITABLE_FIELDS = [
  "name",
  "type",
  "description",
  "pattern",
  "maxLength",
  "minLength",
  "radixValue",
  "seqName",
  "serviceProviderCode",
] as const;

export function setReferenceMaskField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createReferenceMaskNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "name", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "type", "");
  children.push(createAuditModelNode());
  setChildText(children, "description", "");
  setChildText(children, "maxLength", "");
  setChildText(children, "minLength", "");
  setChildText(children, "pattern", "");
  setChildText(children, "radixValue", "");
  setChildText(children, "seqName", "");
  const node: PNode = { mask: children };
  setAttr(node, "refId", `${refIdNum}@ReferenceMaskModel`);
  return node;
}

export function deleteReferenceMask(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}
