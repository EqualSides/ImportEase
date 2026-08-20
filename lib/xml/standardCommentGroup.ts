/**
 * StandardCommentGroupModel.xml parse/serialize (see full-schema-reference.md).
 *
 * A new "star" shape, not a deeper nesting level: one group has FIVE
 * separate flat child collections hanging directly off it — checklists,
 * comment types, inspections, records, and workflows — rather than one
 * child collection that itself nests further. All five collections share
 * an identical row shape (the schema's XCommentGroupEntityModel: refId,
 * serviceProviderCode, entitySeqNbr, auditModel, entityData, entityType,
 * groupName); only the wrapper tag name and the conventional entityType
 * value differ per arm. ARM_DEFS below is the single source of truth for
 * that per-arm variance so the rest of the module (and the UI) can treat
 * all five uniformly via an `ArmKey` parameter instead of five near-
 * duplicate code paths.
 *
 * Confirmed against a real 2-record sample
 * (fixtures/standard-comment-group/scmg-real.xml: one group exercising
 * checklist/commentType/inspection/record, one exercising commentType/
 * inspection*0/record/workflow — together covering all five arms). The
 * group's own refId is reused across records ("1@StandardCommentGroupModel"
 * on both), same non-unique-refId situation as every other refId-bearing
 * category, so row identity uses the synthetic uid, not refId. The group
 * also carries five isXSelected Y/N flags (independent of whether that
 * arm's collection is actually populated) and an untouched
 * standardCommentGroupI18Ns sibling collection.
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
export type ParsedStandardCommentGroupFile = ParsedListFile;

export type ArmKey = "checklist" | "commentType" | "inspection" | "record" | "workflow";

export const ARM_DEFS: Record<
  ArmKey,
  { containerTag: string; itemTag: string; entityType: string; label: string }
> = {
  checklist: { containerTag: "checklistModels", itemTag: "checklistModel", entityType: "GUIDESHEET", label: "Checklist" },
  commentType: { containerTag: "commentTypeModels", itemTag: "commentTypeModel", entityType: "COMMENT", label: "Comment Type" },
  inspection: { containerTag: "inspectionModels", itemTag: "inspectionModel", entityType: "INSPECTION", label: "Inspection" },
  record: { containerTag: "recordModels", itemTag: "recordModel", entityType: "CAP", label: "Record Type" },
  workflow: { containerTag: "workflowModels", itemTag: "workflowModel", entityType: "WORKFLOW", label: "Workflow" },
};

export const ARM_KEYS: ArmKey[] = ["checklist", "commentType", "inspection", "record", "workflow"];

const COLLECTION_TAGS = new Set([
  "checklistModels",
  "commentTypeModels",
  "inspectionModels",
  "recordModels",
  "workflowModels",
  "standardCommentGroupI18Ns",
]);

/** Cheap content sniff — real export files aren't necessarily named "StandardCommentGroupModel.xml". */
export function isStandardCommentGroupXml(xmlText: string): boolean {
  return (
    /<list[\s>]/.test(xmlText) &&
    /<standardCommentGroup[\s>]/.test(xmlText) &&
    /<commentTypeModels[\s>/]/.test(xmlText)
  );
}

export function parseStandardCommentGroupXml(xmlText: string): ParsedStandardCommentGroupFile {
  return parseListXml(xmlText, "standardCommentGroup");
}

export function serializeStandardCommentGroupXml(
  file: ParsedStandardCommentGroupFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedStandardCommentGroupXml(file: ParsedStandardCommentGroupFile): string {
  return serializeStandardCommentGroupXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations — one group, five parallel flat arms
// ---------------------------------------------------------------------------

export interface StandardCommentGroupRow {
  uid: string;
  refId: string;
  groupName: string;
  serviceProviderCode: string;
  isChecklistSelected: string;
  isCommentTypeSelected: string;
  isInspectionSelected: string;
  isRecordTypeSelected: string;
  isWorkflowSelected: string;
  checklistCount: number;
  commentTypeCount: number;
  inspectionCount: number;
  recordCount: number;
  workflowCount: number;
}

function getOrCreateArmNodesArray(groupNode: PNode, arm: ArmKey): PNode[] {
  const def = ARM_DEFS[arm];
  const children = getChildren(groupNode);
  let container = findChildByTag(children, def.containerTag);
  if (!container) {
    container = { [def.containerTag]: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function getArmNodes(groupNode: PNode, arm: ArmKey): PNode[] {
  return getOrCreateArmNodesArray(groupNode, arm);
}

function armCount(groupNode: PNode, arm: ArmKey): number {
  const def = ARM_DEFS[arm];
  return getOrCreateArmNodesArray(groupNode, arm).filter((c) => Object.keys(c).includes(def.itemTag))
    .length;
}

export function toStandardCommentGroupRow(node: PNode): StandardCommentGroupRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    groupName: getChildText(children, "groupName"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    isChecklistSelected: getChildText(children, "isChecklistSelected"),
    isCommentTypeSelected: getChildText(children, "isCommentTypeSelected"),
    isInspectionSelected: getChildText(children, "isInspectionSelected"),
    isRecordTypeSelected: getChildText(children, "isRecordTypeSelected"),
    isWorkflowSelected: getChildText(children, "isWorkflowSelected"),
    checklistCount: armCount(node, "checklist"),
    commentTypeCount: armCount(node, "commentType"),
    inspectionCount: armCount(node, "inspection"),
    recordCount: armCount(node, "record"),
    workflowCount: armCount(node, "workflow"),
  };
}

export interface CommentGroupEntityRow {
  uid: string;
  refId: string;
  entityData: string;
  entityType: string;
  entitySeqNbr: string;
  groupName: string;
  serviceProviderCode: string;
}

export function toCommentGroupEntityRow(node: PNode): CommentGroupEntityRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    entityData: getChildText(children, "entityData"),
    entityType: getChildText(children, "entityType"),
    entitySeqNbr: getChildText(children, "entitySeqNbr"),
    groupName: getChildText(children, "groupName"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: StandardCommentGroupRow[]): string {
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

export function nextRefIdNumber(records: PNode[], suffix: "StandardCommentGroupModel" | "XCommentGroupEntityModel"): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findStandardCommentGroupByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findCommentGroupEntityByUid(
  groupNode: PNode,
  arm: ArmKey,
  uid: string
): PNode | undefined {
  return findNodeByUid(getOrCreateArmNodesArray(groupNode, arm), uid);
}

export const STANDARD_COMMENT_GROUP_EDITABLE_FIELDS = [
  "groupName",
  "serviceProviderCode",
  "isChecklistSelected",
  "isCommentTypeSelected",
  "isInspectionSelected",
  "isRecordTypeSelected",
  "isWorkflowSelected",
] as const;

export const COMMENT_GROUP_ENTITY_EDITABLE_FIELDS = [
  "entityData",
  "entityType",
  "entitySeqNbr",
  "groupName",
  "serviceProviderCode",
] as const;

/** Editing the group's groupName cascades into every arm's own groupName. */
export function setStandardCommentGroupField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "groupName") {
    for (const arm of ARM_KEYS) {
      for (const itemNode of getOrCreateArmNodesArray(node, arm)) {
        setChildText(getChildren(itemNode), "groupName", value);
      }
    }
  }
}

export function setCommentGroupEntityField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createStandardCommentGroupNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "groupName", "");
  children.push(createAuditModelNode());
  children.push({ checklistModels: [] });
  children.push({ commentTypeModels: [] });
  children.push({ inspectionModels: [] });
  setChildText(children, "isChecklistSelected", "Y");
  setChildText(children, "isCommentTypeSelected", "Y");
  setChildText(children, "isInspectionSelected", "Y");
  setChildText(children, "isRecordTypeSelected", "Y");
  setChildText(children, "isWorkflowSelected", "Y");
  children.push({ recordModels: [] });
  children.push({ workflowModels: [] });
  const node: PNode = { standardCommentGroup: children };
  setAttr(node, "refId", `${refIdNum}@StandardCommentGroupModel`);
  return node;
}

export function createCommentGroupEntityNode(
  refIdNum: number,
  arm: ArmKey,
  groupName: string,
  serviceProviderCode = ""
): PNode {
  const def = ARM_DEFS[arm];
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "entitySeqNbr", "");
  children.push(createAuditModelNode());
  setChildText(children, "entityData", "");
  setChildText(children, "entityType", def.entityType);
  setChildText(children, "groupName", groupName);
  const node: PNode = { [def.itemTag]: children };
  setAttr(node, "refId", `${refIdNum}@XCommentGroupEntityModel`);
  return node;
}

export function deleteStandardCommentGroup(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteCommentGroupEntity(groupNode: PNode, arm: ArmKey, entityNode: PNode) {
  const arr = getOrCreateArmNodesArray(groupNode, arm);
  const idx = arr.indexOf(entityNode);
  if (idx >= 0) arr.splice(idx, 1);
}
