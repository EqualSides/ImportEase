/**
 * GuideSheetModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Second three-level category (see lib/xml/refLookupTable.ts for the
 * first): a guide sheet has a repeating list of items, and each item has
 * its own repeating list of status groups. Unlike RefLookupTable, this
 * shape is a conventional `xxxModels` container at every level (no
 * singular-wrapper-around-plural oddity) — `GuideSheetItems` wraps
 * `GuideSheetItem` children, each of which has its own `statusGroupModels`
 * wrapping `statusGroup` children.
 *
 * Confirmed against a real 2-record sample (fixtures/guide-sheet/gs-real.xml:
 * one guide sheet with an empty item list, one with a single item carrying
 * a single status group). All three levels carry a `refId` attribute in
 * the real sample, and — consistent with every other category that has
 * refId — the top-level refId is reused across records
 * (`1@GuideSheetModel` on both), so row identity uses the synthetic uid
 * (getNodeUid in lib/xml/pnode.ts), not refId.
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
  setAttr,
  setChildText,
} from "./pnode";

export type { PNode, ListAttrs };
export type ParsedGuideSheetFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "GuideSheetItems",
  "statusGroupModels",
  "guideSheetI18Ns",
  "guideSheetItemI18N",
  "guideSheetItemStatusGroupI18NModels",
  "guideSheetItemStatusGroupI18Ns",
]);

/** Cheap content sniff — real export files aren't necessarily named "GuideSheetModel.xml". */
export function isGuideSheetXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<guideSheet[\s>]/.test(xmlText);
}

export function parseGuideSheetXml(xmlText: string): ParsedGuideSheetFile {
  return parseListXml(xmlText, "guideSheet");
}

export function serializeGuideSheetXml(
  file: ParsedGuideSheetFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedGuideSheetXml(file: ParsedGuideSheetFile): string {
  return serializeGuideSheetXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations — three levels: sheet -> item -> status group
// ---------------------------------------------------------------------------

export interface GuideSheetRow {
  uid: string;
  refId: string;
  guideType: string;
  guideDesc: string;
  guideStatus: string;
  serviceProviderCode: string;
  itemCount: number;
}

function getOrCreateItemNodesArray(sheetNode: PNode): PNode[] {
  const children = getChildren(sheetNode);
  let container = findChildByTag(children, "GuideSheetItems");
  if (!container) {
    container = { GuideSheetItems: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toGuideSheetRow(node: PNode): GuideSheetRow {
  const children = getChildren(node);
  const itemCount = getOrCreateItemNodesArray(node).filter((c) =>
    Object.keys(c).includes("GuideSheetItem")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    guideType: getChildText(children, "guideType"),
    guideDesc: getChildText(children, "guideDesc"),
    guideStatus: getChildText(children, "guideStatus"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    itemCount,
  };
}

export interface GuideSheetItemRow {
  uid: string;
  refId: string;
  guideItemText: string;
  guideItemSeqNbr: string;
  guideItemDisplay_order: string;
  guideItemStatus: string;
  guideItemStatusGroupName: string;
  isCritical: string;
  isRequired: string;
  guideType: string;
  serviceProviderCode: string;
  statusGroupCount: number;
}

function getOrCreateStatusGroupNodesArray(itemNode: PNode): PNode[] {
  const children = getChildren(itemNode);
  let container = findChildByTag(children, "statusGroupModels");
  if (!container) {
    container = { statusGroupModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toGuideSheetItemRow(node: PNode): GuideSheetItemRow {
  const children = getChildren(node);
  const statusGroupCount = getOrCreateStatusGroupNodesArray(node).filter((c) =>
    Object.keys(c).includes("statusGroup")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    guideItemText: getChildText(children, "guideItemText"),
    guideItemSeqNbr: getChildText(children, "guideItemSeqNbr"),
    guideItemDisplay_order: getChildText(children, "guideItemDisplay_order"),
    guideItemStatus: getChildText(children, "guideItemStatus"),
    guideItemStatusGroupName: getChildText(children, "guideItemStatusGroupName"),
    isCritical: getChildText(children, "isCritical"),
    isRequired: getChildText(children, "isRequired"),
    guideType: getChildText(children, "guideType"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    statusGroupCount,
  };
}

export interface GuideSheetItemStatusGroupRow {
  uid: string;
  refId: string;
  statusGroup: string;
  ststus: string;
  guideItemStatusDispOrder: string;
  guideItemStatusResultType: string;
  majorViolation: string;
  serviceProviderCode: string;
}

export function toGuideSheetItemStatusGroupRow(node: PNode): GuideSheetItemStatusGroupRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    statusGroup: getChildText(children, "statusGroup"),
    ststus: getChildText(children, "ststus"),
    guideItemStatusDispOrder: getChildText(children, "guideItemStatusDispOrder"),
    guideItemStatusResultType: getChildText(children, "guideItemStatusResultType"),
    majorViolation: getChildText(children, "majorViolation"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: GuideSheetRow[]): string {
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
  suffix: "GuideSheetModel" | "GuideSheetItemModel" | "GuideSheetItemStatusGroupModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findGuideSheetByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findGuideSheetItemByUid(sheetNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateItemNodesArray(sheetNode), uid);
}

export function findGuideSheetItemStatusGroupByUid(
  itemNode: PNode,
  uid: string
): PNode | undefined {
  return findNodeByUid(getOrCreateStatusGroupNodesArray(itemNode), uid);
}

export function getGuideSheetItemNodes(sheetNode: PNode): PNode[] {
  return getOrCreateItemNodesArray(sheetNode);
}

export function getGuideSheetItemStatusGroupNodes(itemNode: PNode): PNode[] {
  return getOrCreateStatusGroupNodesArray(itemNode);
}

export const GUIDE_SHEET_EDITABLE_FIELDS = [
  "guideType",
  "guideDesc",
  "guideStatus",
  "serviceProviderCode",
] as const;

export const GUIDE_SHEET_ITEM_EDITABLE_FIELDS = [
  "guideItemText",
  "guideItemSeqNbr",
  "guideItemDisplay_order",
  "guideItemStatus",
  "guideItemStatusGroupName",
  "isCritical",
  "isRequired",
  "guideType",
  "serviceProviderCode",
] as const;

export const GUIDE_SHEET_ITEM_STATUS_GROUP_EDITABLE_FIELDS = [
  "statusGroup",
  "ststus",
  "guideItemStatusDispOrder",
  "guideItemStatusResultType",
  "majorViolation",
  "serviceProviderCode",
] as const;

/** Editing the sheet's guideType cascades into every item's own guideType (a duplicate field on each item). */
export function setGuideSheetField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "guideType") {
    for (const item of getOrCreateItemNodesArray(node)) {
      setChildText(getChildren(item), field, value);
    }
  }
}

/** Editing an item's guideItemStatusGroupName cascades into that item's own status groups' `statusGroup` field. */
export function setGuideSheetItemField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "guideItemStatusGroupName") {
    for (const sg of getOrCreateStatusGroupNodesArray(node)) {
      setChildText(getChildren(sg), "statusGroup", value);
    }
  }
}

export function setGuideSheetItemStatusGroupField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createGuideSheetNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "guideType", "");
  children.push(createAuditModelNode());
  children.push({ guideSheetI18Ns: [] });
  children.push({ GuideSheetItems: [] });
  setChildText(children, "guideDesc", "");
  setChildText(children, "guideStatus", "");
  const node: PNode = { guideSheet: children };
  setAttr(node, "refId", `${refIdNum}@GuideSheetModel`);
  return node;
}

export function createGuideSheetItemNode(
  refIdNum: number,
  guideType: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "guideItemSeqNbr", "");
  children.push(createAuditModelNode());
  setChildText(children, "guideItemAsiVisible", "");
  setChildText(children, "guideItemCarryOverFlag", "");
  setChildText(children, "guideItemDisplay_order", "");
  setChildText(children, "guideItemStatus", "");
  children.push({ statusGroupModels: [] });
  setChildText(children, "guideItemStatusGroupName", "");
  setChildText(children, "guideItemStatusVisible", "");
  setChildText(children, "guideItemText", "");
  setChildText(children, "guideItemTextVisible", "");
  children.push({ guideSheetItemI18N: [] });
  setChildText(children, "guideType", guideType);
  setChildText(children, "isCritical", "");
  setChildText(children, "isRequired", "");
  const node: PNode = { GuideSheetItem: children };
  setAttr(node, "refId", `${refIdNum}@GuideSheetItemModel`);
  return node;
}

export function createGuideSheetItemStatusGroupNode(
  refIdNum: number,
  statusGroup: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "statusGroup", statusGroup);
  setChildText(children, "ststus", "");
  children.push(createAuditModelNode());
  setChildText(children, "guideItemStatusDispOrder", "");
  setChildText(children, "guideItemStatusResultType", "");
  children.push({ guideSheetItemStatusGroupI18NModels: [] });
  setChildText(children, "majorViolation", "");
  const node: PNode = { statusGroup: children };
  setAttr(node, "refId", `${refIdNum}@GuideSheetItemStatusGroupModel`);
  return node;
}

export function deleteGuideSheet(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteGuideSheetItem(sheetNode: PNode, itemNode: PNode) {
  const arr = getOrCreateItemNodesArray(sheetNode);
  const idx = arr.indexOf(itemNode);
  if (idx >= 0) arr.splice(idx, 1);
}

export function deleteGuideSheetItemStatusGroup(itemNode: PNode, statusGroupNode: PNode) {
  const arr = getOrCreateStatusGroupNodesArray(itemNode);
  const idx = arr.indexOf(statusGroupNode);
  if (idx >= 0) arr.splice(idx, 1);
}
