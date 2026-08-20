/**
 * InspRelateInspModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Flat category — one record per inspection-sequencing rule, no repeating
 * child list. `childInspType`/`parentInspType` are single-value wrappers
 * (`<childInspType><virtualString>...</virtualString></childInspType>`) —
 * see getNestedText/setNestedText in lib/xml/pnode.ts, which read/write
 * through that wrapping so these behave like any other text cell in the
 * grid. Confirmed against a real 1-record sample
 * (fixtures/insp-relate-insp/iri-real.xml) — this category has no `refId`
 * attribute at all in practice.
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
  getNestedText,
  getNodeUid,
  nextRefIdNumber as nextRefIdNumberGeneric,
  parseListXml,
  serializeListXml,
  setAttr,
  setChildText,
  setNestedText,
} from "./pnode";

export type { PNode, ListAttrs };
export type ParsedInspRelateInspFile = ParsedListFile;

const COLLECTION_TAGS = new Set<string>([]);

/** Cheap content sniff — real export files aren't necessarily named "InspRelateInspModel.xml". */
export function isInspRelateInspXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<inspRelateInsp[\s>]/.test(xmlText);
}

export function parseInspRelateInspXml(xmlText: string): ParsedInspRelateInspFile {
  return parseListXml(xmlText, "inspRelateInsp");
}

export function serializeInspRelateInspXml(
  file: ParsedInspRelateInspFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedInspRelateInspXml(file: ParsedInspRelateInspFile): string {
  return serializeInspRelateInspXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// Index signature so this satisfies components/FlatGrid.tsx's FlatGridRow
// shape without a cast — every field here is a plain string.
export interface InspRelateInspRow {
  [field: string]: string;
  uid: string;
  refId: string;
  parentInspType: string;
  childInspType: string;
  inspResult: string;
  inspResultGroup: string;
  type: string;
  inAdvance: string;
  intervalDay: string;
  isAuto: string;
  isRelated: string;
  initDateType: string;
  initStatus: string;
  servProvCode: string;
}

export function toInspRelateInspRow(node: PNode): InspRelateInspRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    parentInspType: getNestedText(children, "parentInspType", "virtualString"),
    childInspType: getNestedText(children, "childInspType", "virtualString"),
    inspResult: getChildText(children, "inspResult"),
    inspResultGroup: getChildText(children, "inspResultGroup"),
    type: getChildText(children, "type"),
    inAdvance: getChildText(children, "inAdvance"),
    intervalDay: getChildText(children, "intervalDay"),
    isAuto: getChildText(children, "isAuto"),
    isRelated: getChildText(children, "isRelated"),
    initDateType: getChildText(children, "initDateType"),
    initStatus: getChildText(children, "initStatus"),
    servProvCode: getChildText(children, "servProvCode"),
  };
}

export function inferCommonAgencyId(rows: InspRelateInspRow[]): string {
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
  return nextRefIdNumberGeneric(records, "InspRelateInspModel");
}

export function findInspRelateInspByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export const INSP_RELATE_INSP_EDITABLE_FIELDS = [
  "parentInspType",
  "childInspType",
  "inspResult",
  "inspResultGroup",
  "type",
  "inAdvance",
  "intervalDay",
  "isAuto",
  "isRelated",
  "initDateType",
  "initStatus",
  "servProvCode",
] as const;

const WRAPPED_FIELDS = new Set(["parentInspType", "childInspType"]);

export function setInspRelateInspField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  if (WRAPPED_FIELDS.has(field)) {
    setNestedText(children, field, "virtualString", value);
  } else {
    setChildText(children, field, value);
  }
}

export function createInspRelateInspNode(refIdNum: number, servProvCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "type", "");
  setNestedText(children, "childInspType", "virtualString", "");
  setChildText(children, "childSeqNbr", "");
  setChildText(children, "inAdvance", "");
  setChildText(children, "initDateType", "");
  setChildText(children, "initStatus", "");
  setChildText(children, "inspResult", "");
  setChildText(children, "inspResultGroup", "");
  setChildText(children, "intervalDay", "");
  setChildText(children, "isAuto", "");
  setChildText(children, "isRelated", "");
  setNestedText(children, "parentInspType", "virtualString", "");
  setChildText(children, "parentSeqNbr", "");
  const node: PNode = { inspRelateInsp: children };
  setAttr(node, "refId", `${refIdNum}@InspRelateInspModel`);
  return node;
}

// Identity-based, same rationale as every other model in this app (see
// getNodeUid in lib/xml/pnode.ts) — kept consistent even though this
// category's real sample never repeats refId, since a blank-file session
// with several added rows would otherwise share the same generated one.
export function deleteInspRelateInsp(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}
