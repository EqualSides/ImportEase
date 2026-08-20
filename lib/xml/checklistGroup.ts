/**
 * CheckListGroupModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Parent/child category — a guide group with a repeating list of guide
 * sheet types under it. Confirmed against a real 1-record sample
 * (fixtures/checklist-group/clg-real.xml, with 2 child guide types): both
 * levels use `serviceProviderCode` (no field-name split, like
 * RefAddressTypeGroup/Sequence), and neither level carries a `refId`
 * attribute in the real sample.
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
export type ParsedCheckListGroupFile = ParsedListFile;

const COLLECTION_TAGS = new Set(["guideSheetGroupModels", "guideSheetGroupI18ns"]);

/** Cheap content sniff — real export files aren't necessarily named "CheckListGroupModel.xml". */
export function isCheckListGroupXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<checklistGroup[\s>]/.test(xmlText);
}

export function parseCheckListGroupXml(xmlText: string): ParsedCheckListGroupFile {
  return parseListXml(xmlText, "checklistGroup");
}

export function serializeCheckListGroupXml(
  file: ParsedCheckListGroupFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedCheckListGroupXml(file: ParsedCheckListGroupFile): string {
  return serializeCheckListGroupXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations
// ---------------------------------------------------------------------------

export interface CheckListGroupRow {
  uid: string;
  refId: string;
  guideGroup: string;
  serviceProviderCode: string;
  typeCount: number;
}

function getOrCreateGuideTypeNodesArray(groupNode: PNode): PNode[] {
  const children = getChildren(groupNode);
  let container = children.find((c) => Object.keys(c).includes("guideSheetGroupModels"));
  if (!container) {
    container = { guideSheetGroupModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toCheckListGroupRow(node: PNode): CheckListGroupRow {
  const children = getChildren(node);
  const typeCount = getOrCreateGuideTypeNodesArray(node).filter((c) =>
    Object.keys(c).includes("guideSheetGroupModel")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    guideGroup: getChildText(children, "guideGroup"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    typeCount,
  };
}

export interface GuideSheetGroupRow {
  uid: string;
  refId: string;
  guideType: string;
  guideGroup: string;
  guideAutoCreate: string;
  guideItemDisplayOrder: string;
  serviceProviderCode: string;
}

export function toGuideSheetGroupRow(node: PNode): GuideSheetGroupRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    guideType: getChildText(children, "guideType"),
    guideGroup: getChildText(children, "guideGroup"),
    guideAutoCreate: getChildText(children, "guideAutoCreate"),
    guideItemDisplayOrder: getChildText(children, "guideItemDisplayOrder"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: CheckListGroupRow[]): string {
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
  suffix: "CheckListGroupModel" | "GuideSheetGroupModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findCheckListGroupByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findGuideSheetGroupByUid(groupNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateGuideTypeNodesArray(groupNode), uid);
}

export function getGuideSheetGroupNodes(groupNode: PNode): PNode[] {
  return getOrCreateGuideTypeNodesArray(groupNode);
}

export const CHECKLIST_GROUP_EDITABLE_FIELDS = ["guideGroup", "serviceProviderCode"] as const;

export const GUIDE_SHEET_GROUP_EDITABLE_FIELDS = [
  "guideType",
  "guideGroup",
  "guideAutoCreate",
  "guideItemDisplayOrder",
  "serviceProviderCode",
] as const;

export function setCheckListGroupField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "guideGroup") {
    for (const t of getOrCreateGuideTypeNodesArray(node)) {
      setChildText(getChildren(t), field, value);
    }
  }
}

export function setGuideSheetGroupField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createCheckListGroupNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "guideGroup", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push({ guideSheetGroupModels: [] });
  const node: PNode = { checklistGroup: children };
  setAttr(node, "refId", `${refIdNum}@CheckListGroupModel`);
  return node;
}

export function createGuideSheetGroupNode(
  refIdNum: number,
  guideGroup: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "guideGroup", guideGroup);
  setChildText(children, "guideType", "");
  children.push(createAuditModelNode());
  setChildText(children, "guideAutoCreate", "");
  setChildText(children, "guideItemDisplayOrder", "");
  children.push({ guideSheetGroupI18ns: [] });
  const node: PNode = { guideSheetGroupModel: children };
  setAttr(node, "refId", `${refIdNum}@GuideSheetGroupModel`);
  return node;
}

export function deleteCheckListGroup(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteGuideSheetGroup(groupNode: PNode, typeNode: PNode) {
  const arr = getOrCreateGuideTypeNodesArray(groupNode);
  const idx = arr.indexOf(typeNode);
  if (idx >= 0) arr.splice(idx, 1);
}
