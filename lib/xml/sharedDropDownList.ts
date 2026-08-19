/**
 * SharedDropDownListModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Same parent/child shape as StandardChoiceModel (list of "shared drop-down
 * lists", each with a repeating list of values) — see lib/xml/standardChoice.ts
 * and lib/xml/pnode.ts for the general fidelity strategy this reuses.
 *
 * Two things this schema does differently from Standard Choice, both
 * load-bearing:
 * - The Agency ID field is named differently at each level: `serviceProviderCode`
 *   on the parent `sharedDropDownListModel`, but `servProvCode` on the child
 *   `sharedDropDownValue` — exactly the per-model field-name variance
 *   architecture-and-safety-update.md warned needs explicit handling, not a
 *   blind find-and-replace. setSharedDropDownField/setSharedDropDownValueField
 *   below each use their own model's field name.
 * - Each value can carry `childDrillDownValueMapModels`/
 *   `parentDrillDownValueMapModels` — deeply-nested, optional/rare hierarchical
 *   drill-down mappings (themselves referencing other standardChoice records).
 *   Per the schema doc these are populated in only a minority of real records.
 *   Building grid-editing for them is out of scope for this milestone (same
 *   "detect and preserve, don't build an editor for it" treatment Workflow
 *   gets) — they parse into the record's node tree like any other untouched
 *   field and round-trip through unedited, they're just not surfaced as grid
 *   columns.
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

export type ParsedSharedDropDownFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "sharedDropDownList",
  "standardChoiceValueI18NModels",
  "childDrillDownValueMapModels",
  "parentDrillDownValueMapModels",
]);

/** Cheap content sniff — real export files aren't necessarily named "SharedDropDownListModel.xml". */
export function isSharedDropDownXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<sharedDropDownListModel[\s>]/.test(xmlText);
}

export function parseSharedDropDownXml(xmlText: string): ParsedSharedDropDownFile {
  return parseListXml(xmlText, "sharedDropDownListModel");
}

export function serializeSharedDropDownXml(
  file: ParsedSharedDropDownFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

/** Serializes for a real export: stamps exportUser/exportDateTime as the tool producing the package. */
export function buildExportedSharedDropDownXml(file: ParsedSharedDropDownFile): string {
  return serializeSharedDropDownXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations
// ---------------------------------------------------------------------------

export interface SharedDropDownRow {
  uid: string;
  refId: string;
  name: string;
  serviceProviderCode: string;
  defaultValue: string;
  description: string;
  type: string;
  valueSize: string;
  valueCount: number;
}

/** Returns the live (mutable) array of `sharedDropDownValue` nodes for a `sharedDropDownListModel` node. */
function getOrCreateValueNodesArray(parentNode: PNode): PNode[] {
  const children = getChildren(parentNode);
  let container = children.find((c) => Object.keys(c).includes("sharedDropDownList"));
  if (!container) {
    container = { sharedDropDownList: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toSharedDropDownRow(node: PNode): SharedDropDownRow {
  const children = getChildren(node);
  const valueCount = getOrCreateValueNodesArray(node).filter((c) =>
    Object.keys(c).includes("sharedDropDownValue")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    name: getChildText(children, "name"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    defaultValue: getChildText(children, "defaultValue"),
    description: getChildText(children, "description"),
    type: getChildText(children, "type"),
    valueSize: getChildText(children, "valueSize"),
    valueCount,
  };
}

export interface SharedDropDownValueRow {
  uid: string;
  refId: string;
  bizdomainValue: string;
  bizdomain: string;
  valueDesc: string;
  sortOrder: string;
  bdvSeqNbr: string;
  bdvParentNbr: string;
  servProvCode: string;
}

export function toSharedDropDownValueRow(node: PNode): SharedDropDownValueRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    bizdomainValue: getChildText(children, "bizdomainValue"),
    bizdomain: getChildText(children, "bizdomain"),
    valueDesc: getChildText(children, "valueDesc"),
    sortOrder: getChildText(children, "sortOrder"),
    bdvSeqNbr: getChildText(children, "bdvSeqNbr"),
    bdvParentNbr: getChildText(children, "bdvParentNbr"),
    servProvCode: getChildText(children, "servProvCode"),
  };
}

/** Most common non-empty Agency ID among a set of sharedDropDownListModel rows. */
export function inferCommonAgencyId(rows: SharedDropDownRow[]): string {
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
  suffix: "SharedDropDownListModel" | "SharedDropDownValueModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findSharedDropDownByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findSharedDropDownValueByUid(parentNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateValueNodesArray(parentNode), uid);
}

export function getSharedDropDownValueNodes(parentNode: PNode): PNode[] {
  return getOrCreateValueNodesArray(parentNode);
}

export const SHARED_DROPDOWN_EDITABLE_FIELDS = [
  "name",
  "serviceProviderCode",
  "defaultValue",
  "description",
  "type",
  "valueSize",
] as const;

export const SHARED_DROPDOWN_VALUE_EDITABLE_FIELDS = [
  "bizdomainValue",
  "bizdomain",
  "valueDesc",
  "sortOrder",
  "bdvSeqNbr",
] as const;

/** Parent's Agency ID field is `serviceProviderCode` — see the module doc comment. */
export function setSharedDropDownField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

/** Child's Agency ID field is `servProvCode`, not `serviceProviderCode` — see the module doc comment. */
export function setSharedDropDownValueField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createSharedDropDownNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "name", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push(createAuditModelNode());
  setChildText(children, "defaultValue", "");
  setChildText(children, "description", "");
  setChildText(children, "type", "");
  children.push({ sharedDropDownList: [] });
  const node: PNode = { sharedDropDownListModel: children };
  setAttr(node, "refId", `${refIdNum}@SharedDropDownListModel`);
  return node;
}

export function createSharedDropDownValueNode(refIdNum: number, servProvCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "bdvSeqNbr", "");
  setChildText(children, "bizdomain", "");
  children.push(createAuditModelNode());
  setChildText(children, "servProvCode", servProvCode);
  children.push({ childDrillDownValueMapModels: [] });
  children.push({ parentDrillDownValueMapModels: [] });
  children.push({ standardChoiceValueI18NModels: [] });
  setChildText(children, "bizdomainValue", "");
  const node: PNode = { sharedDropDownValue: children };
  setAttr(node, "refId", `${refIdNum}@SharedDropDownValueModel`);
  return node;
}

// Identity-based (not refId-based — refId isn't guaranteed unique, see getNodeUid in pnode.ts).
export function deleteSharedDropDown(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteSharedDropDownValue(parentNode: PNode, valueNode: PNode) {
  const arr = getOrCreateValueNodesArray(parentNode);
  const idx = arr.indexOf(valueNode);
  if (idx >= 0) arr.splice(idx, 1);
}
