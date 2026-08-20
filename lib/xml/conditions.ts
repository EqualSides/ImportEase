/**
 * ConditionsModel.xml parse/serialize (see full-schema-reference.md).
 *
 * The real export this app has been built against contains exactly ONE
 * condition record — unlike every other category, there was no second
 * real record available to confirm cross-record consistency (e.g.
 * whether a second record would share the same field population, or
 * whether any field observed empty here is ever populated elsewhere).
 * This is disclosed rather than worked around; the fixture
 * (fixtures/conditions/cond-real.xml) is that single real record,
 * unmodified.
 *
 * A flat category (reuses FlatGrid, same as Reference Mask/Cap Type/
 * Department Type) — one row per condition, no repeating child
 * collection this module edits. The real record embeds several
 * substantial sub-objects this module never reads or writes:
 * - conditionPermissionModels: genuine security/permission policy data
 *   (policySeq, rightGranted, virtualUserGroupModel) — confirmed
 *   populated with two real permission entries.
 * - conditionsTypeModel: itself embeds a *complete* StandardChoiceModel
 *   (conditionsOfApprovalsConfiguration) and a ConditionGroupTypeModel,
 *   plus its own conditionTypeSecurities arm with six more real
 *   permission-policy entries.
 * - conditionDetailModel, conditionRecordTypeModels: reference/config
 *   sub-objects with their own audit metadata.
 * - conditionInspectionRelationModels, conditionWorkflowRelationModels,
 *   templateAttributes: confirmed empty/self-closing in the real
 *   sample.
 *
 * No `refId` attribute on the top-level `<condition>` element itself in
 * the real sample (several of the embedded sub-objects carry their own).
 */
import {
  type ListAttrs,
  type ParsedListFile,
  type PNode,
  formatAccelaDateTime,
  getChildren,
  getChildText,
  getNodeUid,
  parseListXml,
  serializeListXml,
  setChildText,
} from "./pnode";

export type { PNode, ListAttrs };
export type ParsedConditionsFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "conditionInspectionRelationModels",
  "conditionWorkflowRelationModels",
  "templateAttributes",
  "conditionRecordTypeModels",
  "conditionPermissionModels",
  "conditionDetailI18NModels",
  "conditionGroup4ValueMaps",
  "conditionGroups",
  "conditionTypeSecurities",
  "standardChoiceValueModels",
  "standardChoiceValueI18NModels",
  "groupTypeRelations",
  "policyI18NModels",
]);

/** Cheap content sniff — real export files aren't necessarily named "ConditionsModel.xml". */
export function isConditionsXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<condition[\s>]/.test(xmlText);
}

export function parseConditionsXml(xmlText: string): ParsedConditionsFile {
  return parseListXml(xmlText, "condition");
}

export function serializeConditionsXml(
  file: ParsedConditionsFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedConditionsXml(file: ParsedConditionsFile): string {
  return serializeConditionsXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projection + mutation — flat, one row per condition
// ---------------------------------------------------------------------------

export interface ConditionRow {
  [field: string]: string;
  uid: string;
  refId: string;
  conditionNbr: string;
  conditionDesc: string;
  conditionComment: string;
  conditionGroup: string;
  conditionType: string;
  serviceProviderCode: string;
  conditionApproveFlag: string;
  displayConditionNotice: string;
  displayNoticeOnACA: string;
  displayNoticeOnACAFee: string;
  impactCode: string;
  includeInConditionName: string;
  includeInShortDescription: string;
  inheritable: string;
  isInspectionSelected: string;
  isPermissionSelected: string;
  isRecordTypesSelected: string;
  isWorkflowSelected: string;
}

export function toConditionRow(node: PNode): ConditionRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: "",
    conditionNbr: getChildText(children, "conditionNbr"),
    conditionDesc: getChildText(children, "conditionDesc"),
    conditionComment: getChildText(children, "conditionComment"),
    conditionGroup: getChildText(children, "conditionGroup"),
    conditionType: getChildText(children, "conditionType"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    conditionApproveFlag: getChildText(children, "conditionApproveFlag"),
    displayConditionNotice: getChildText(children, "displayConditionNotice"),
    displayNoticeOnACA: getChildText(children, "displayNoticeOnACA"),
    displayNoticeOnACAFee: getChildText(children, "displayNoticeOnACAFee"),
    impactCode: getChildText(children, "impactCode"),
    includeInConditionName: getChildText(children, "includeInConditionName"),
    includeInShortDescription: getChildText(children, "includeInShortDescription"),
    inheritable: getChildText(children, "inheritable"),
    isInspectionSelected: getChildText(children, "isInspectionSelected"),
    isPermissionSelected: getChildText(children, "isPermissionSelected"),
    isRecordTypesSelected: getChildText(children, "isRecordTypesSelected"),
    isWorkflowSelected: getChildText(children, "isWorkflowSelected"),
  };
}

export function inferCommonAgencyId(rows: ConditionRow[]): string {
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

export function nextRefIdNumber(_records: PNode[]): number {
  return 1;
}

export function findConditionByUid(records: PNode[], uid: string): PNode | undefined {
  return records.find((n) => getNodeUid(n) === uid);
}

export const CONDITION_EDITABLE_FIELDS = [
  "conditionNbr",
  "conditionDesc",
  "conditionComment",
  "conditionGroup",
  "conditionType",
  "serviceProviderCode",
  "conditionApproveFlag",
  "displayConditionNotice",
  "displayNoticeOnACA",
  "displayNoticeOnACAFee",
  "impactCode",
  "includeInConditionName",
  "includeInShortDescription",
  "inheritable",
  "isInspectionSelected",
  "isPermissionSelected",
  "isRecordTypesSelected",
  "isWorkflowSelected",
] as const;

export function setConditionField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createConditionNode(_refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "conditionNbr", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "conditionDesc", "");
  setChildText(children, "conditionComment", "");
  setChildText(children, "conditionGroup", "");
  setChildText(children, "conditionType", "");
  setChildText(children, "conditionApproveFlag", "N");
  setChildText(children, "displayConditionNotice", "N");
  setChildText(children, "displayNoticeOnACA", "N");
  setChildText(children, "displayNoticeOnACAFee", "N");
  setChildText(children, "impactCode", "");
  setChildText(children, "includeInConditionName", "N");
  setChildText(children, "includeInShortDescription", "N");
  setChildText(children, "inheritable", "N");
  setChildText(children, "isInspectionSelected", "N");
  setChildText(children, "isPermissionSelected", "N");
  setChildText(children, "isRecordTypesSelected", "N");
  setChildText(children, "isWorkflowSelected", "N");
  children.push({ conditionInspectionRelationModels: [] });
  children.push({ conditionWorkflowRelationModels: [] });
  children.push({ templateAttributes: [] });
  return { condition: children };
}

export function deleteCondition(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}
