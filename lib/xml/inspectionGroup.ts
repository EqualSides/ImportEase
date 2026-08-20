/**
 * InspectionGroupModel.xml parse/serialize (see full-schema-reference.md).
 *
 * A conventional 2-level parent/child category (inspection group ->
 * inspection type), same shape as Ref Address Type Group/RAPO Template.
 *
 * A group also carries an untouched inspectionTypeSecurityModels sibling
 * arm (genuine security data — flagged in the sensitive-data gate, same
 * treatment as every other category's untouched xxxSecurityModel arm),
 * and five isXSelected Y/N flags (independent of that security arm).
 * Each inspection type itself carries several untouched sibling
 * collections (inspectionRequiredCheckListModels, inspectionTypeI18ns,
 * refInspectionDisciplines, xinspectionTypeCategorys) — all confirmed
 * empty/self-closing in the real fixture, never read or written here.
 *
 * Confirmed against a real 2-record sample
 * (fixtures/inspection-group/ig-real.xml: "NONE" and "PLN_GENERAL",
 * each with a single inspection type — the two smallest real records in
 * the 1.4MB source file). No `refId` attribute anywhere in the real
 * sample, at either level.
 *
 * Cascades: a group's inspCode cascades into every type's own inspCode;
 * inspGroupName cascades into every type's own inspGroupName;
 * servProvCode cascades into every type's own servProvCode.
 */
import {
  type ListAttrs,
  type ParsedListFile,
  type PNode,
  findChildByTag,
  formatAccelaDateTime,
  getChildren,
  getChildText,
  getNodeUid,
  parseListXml,
  serializeListXml,
  setChildText,
} from "./pnode";

export type { PNode, ListAttrs };
export type ParsedInspectionGroupFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "inspectionTypeModels",
  "inspectionTypeSecurityModels",
  "inspectionRequiredCheckListModels",
  "inspectionTypeI18ns",
  "refInspectionDisciplines",
  "xinspectionTypeCategorys",
]);

/** Cheap content sniff — real export files aren't necessarily named "InspectionGroupModel.xml". */
export function isInspectionGroupXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<inspectionGroup[\s>]/.test(xmlText);
}

export function parseInspectionGroupXml(xmlText: string): ParsedInspectionGroupFile {
  return parseListXml(xmlText, "inspectionGroup");
}

export function serializeInspectionGroupXml(
  file: ParsedInspectionGroupFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedInspectionGroupXml(file: ParsedInspectionGroupFile): string {
  return serializeInspectionGroupXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations — two levels: group -> inspection type
// ---------------------------------------------------------------------------

export interface InspectionGroupRow {
  uid: string;
  inspCode: string;
  inspGroupName: string;
  servProvCode: string;
  inspectionSec: string;
  isDepartmentSelected: string;
  isGradeGroupSelected: string;
  isGuideSheetSelected: string;
  isRelatedInspSelected: string;
  isResultGroupSelected: string;
  isSecutirySelected: string;
  typeCount: number;
}

function getOrCreateTypeNodesArray(groupNode: PNode): PNode[] {
  const children = getChildren(groupNode);
  let container = findChildByTag(children, "inspectionTypeModels");
  if (!container) {
    container = { inspectionTypeModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toInspectionGroupRow(node: PNode): InspectionGroupRow {
  const children = getChildren(node);
  const typeCount = getOrCreateTypeNodesArray(node).filter((c) =>
    Object.keys(c).includes("inspectionTypeModel")
  ).length;
  return {
    uid: getNodeUid(node),
    inspCode: getChildText(children, "inspCode"),
    inspGroupName: getChildText(children, "inspGroupName"),
    servProvCode: getChildText(children, "servProvCode"),
    inspectionSec: getChildText(children, "inspectionSec"),
    isDepartmentSelected: getChildText(children, "isDepartmentSelected"),
    isGradeGroupSelected: getChildText(children, "isGradeGroupSelected"),
    isGuideSheetSelected: getChildText(children, "isGuideSheetSelected"),
    isRelatedInspSelected: getChildText(children, "isRelatedInspSelected"),
    isResultGroupSelected: getChildText(children, "isResultGroupSelected"),
    isSecutirySelected: getChildText(children, "isSecutirySelected"),
    typeCount,
  };
}

export interface InspectionTypeRow {
  uid: string;
  inspType: string;
  inspResultGroup: string;
  inspPriority: string;
  inspRequired: string;
  inspEditable: string;
  allowFailedGuidesheet: string;
  allowMultiInspInAca: string;
  autoAssign: string;
  displayInAca: string;
  flowEnabled: string;
  grade: string;
  guideGroup: string;
  ivrNumber: string;
  totalScoreOption: string;
  r3AgencyCode: string;
  r3BureauCode: string;
  r3DivisionCode: string;
  r3GroupCode: string;
  r3OfficeCode: string;
  r3SectionCode: string;
  inspSeqNbr: string;
  inspCode: string;
  inspGroupName: string;
  servProvCode: string;
}

export function toInspectionTypeRow(node: PNode): InspectionTypeRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    inspType: getChildText(children, "inspType"),
    inspResultGroup: getChildText(children, "inspResultGroup"),
    inspPriority: getChildText(children, "inspPriority"),
    inspRequired: getChildText(children, "inspRequired"),
    inspEditable: getChildText(children, "inspEditable"),
    allowFailedGuidesheet: getChildText(children, "allowFailedGuidesheet"),
    allowMultiInspInAca: getChildText(children, "allowMultiInspInAca"),
    autoAssign: getChildText(children, "autoAssign"),
    displayInAca: getChildText(children, "displayInAca"),
    flowEnabled: getChildText(children, "flowEnabled"),
    grade: getChildText(children, "grade"),
    guideGroup: getChildText(children, "guideGroup"),
    ivrNumber: getChildText(children, "ivrNumber"),
    totalScoreOption: getChildText(children, "totalScoreOption"),
    r3AgencyCode: getChildText(children, "r3AgencyCode"),
    r3BureauCode: getChildText(children, "r3BureauCode"),
    r3DivisionCode: getChildText(children, "r3DivisionCode"),
    r3GroupCode: getChildText(children, "r3GroupCode"),
    r3OfficeCode: getChildText(children, "r3OfficeCode"),
    r3SectionCode: getChildText(children, "r3SectionCode"),
    inspSeqNbr: getChildText(children, "inspSeqNbr"),
    inspCode: getChildText(children, "inspCode"),
    inspGroupName: getChildText(children, "inspGroupName"),
    servProvCode: getChildText(children, "servProvCode"),
  };
}

export function inferCommonAgencyId(rows: InspectionGroupRow[]): string {
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

/** No refId anywhere in this category's real sample — no nextRefIdNumber export needed. */

export function findInspectionGroupByUid(records: PNode[], uid: string): PNode | undefined {
  return records.find((n) => getNodeUid(n) === uid);
}

export function findInspectionTypeByUid(groupNode: PNode, uid: string): PNode | undefined {
  return getOrCreateTypeNodesArray(groupNode).find((n) => getNodeUid(n) === uid);
}

export function getInspectionTypeNodes(groupNode: PNode): PNode[] {
  return getOrCreateTypeNodesArray(groupNode);
}

export const INSPECTION_GROUP_EDITABLE_FIELDS = [
  "inspCode",
  "inspGroupName",
  "servProvCode",
  "inspectionSec",
  "isDepartmentSelected",
  "isGradeGroupSelected",
  "isGuideSheetSelected",
  "isRelatedInspSelected",
  "isResultGroupSelected",
  "isSecutirySelected",
] as const;

export const INSPECTION_TYPE_EDITABLE_FIELDS = [
  "inspType",
  "inspResultGroup",
  "inspPriority",
  "inspRequired",
  "inspEditable",
  "allowFailedGuidesheet",
  "allowMultiInspInAca",
  "autoAssign",
  "displayInAca",
  "flowEnabled",
  "grade",
  "guideGroup",
  "ivrNumber",
  "totalScoreOption",
  "r3AgencyCode",
  "r3BureauCode",
  "r3DivisionCode",
  "r3GroupCode",
  "r3OfficeCode",
  "r3SectionCode",
  "inspSeqNbr",
  "inspCode",
  "inspGroupName",
  "servProvCode",
] as const;

/** Editing the group's inspCode/inspGroupName/servProvCode cascades into every type's own copy. */
export function setInspectionGroupField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "inspCode" || field === "inspGroupName" || field === "servProvCode") {
    for (const type of getOrCreateTypeNodesArray(node)) {
      setChildText(getChildren(type), field, value);
    }
  }
}

export function setInspectionTypeField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createInspectionGroupNode(servProvCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "inspCode", "");
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "inspGroupName", "");
  setChildText(children, "inspectionSec", "");
  children.push({ inspectionTypeModels: [] });
  children.push({ inspectionTypeSecurityModels: [] });
  setChildText(children, "isDepartmentSelected", "Y");
  setChildText(children, "isGradeGroupSelected", "Y");
  setChildText(children, "isGuideSheetSelected", "Y");
  setChildText(children, "isRelatedInspSelected", "Y");
  setChildText(children, "isResultGroupSelected", "Y");
  setChildText(children, "isSecutirySelected", "Y");
  return { inspectionGroup: children };
}

export function createInspectionTypeNode(
  inspCode: string,
  inspGroupName: string,
  servProvCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "inspSeqNbr", "");
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "allowFailedGuidesheet", "N");
  setChildText(children, "allowMultiInspInAca", "N");
  setChildText(children, "autoAssign", "N");
  setChildText(children, "displayInAca", "Y");
  setChildText(children, "flowEnabled", "N");
  setChildText(children, "inspCode", inspCode);
  setChildText(children, "inspEditable", "Y");
  setChildText(children, "inspGroupName", inspGroupName);
  setChildText(children, "inspRequired", "N");
  setChildText(children, "inspType", "");
  children.push({ inspectionRequiredCheckListModels: [] });
  children.push({ inspectionTypeI18ns: [] });
  children.push({ refInspectionDisciplines: [] });
  setChildText(children, "totalScoreOption", "SUM(list)");
  children.push({ xinspectionTypeCategorys: [] });
  return { inspectionTypeModel: children };
}

export function deleteInspectionGroup(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteInspectionType(groupNode: PNode, typeNode: PNode) {
  const arr = getOrCreateTypeNodesArray(groupNode);
  const idx = arr.indexOf(typeNode);
  if (idx >= 0) arr.splice(idx, 1);
}
