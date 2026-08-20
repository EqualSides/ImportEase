/**
 * RefInspectionResultGroupModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Parent/child category — a result group with a repeating list of specific
 * results under it. Confirmed against a real 1-record sample
 * (fixtures/ref-inspection-result-group/rirg-real.xml): both levels use
 * `serviceProviderCode` (no field-name split), the parent carries no
 * `refId` but each child `inspectionResultGroupModel` does.
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
export type ParsedRefInspectionResultGroupFile = ParsedListFile;

const COLLECTION_TAGS = new Set(["inspectionResultGroupModels", "inspResultGroupI18Ns"]);

/** Cheap content sniff — real export files aren't necessarily named "RefInspectionResultGroupModel.xml". */
export function isRefInspectionResultGroupXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<refInspResultGroup[\s>]/.test(xmlText);
}

export function parseRefInspectionResultGroupXml(
  xmlText: string
): ParsedRefInspectionResultGroupFile {
  return parseListXml(xmlText, "refInspResultGroup");
}

export function serializeRefInspectionResultGroupXml(
  file: ParsedRefInspectionResultGroupFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedRefInspectionResultGroupXml(
  file: ParsedRefInspectionResultGroupFile
): string {
  return serializeRefInspectionResultGroupXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations
// ---------------------------------------------------------------------------

export interface RefInspectionResultGroupRow {
  uid: string;
  refId: string;
  inspResultGroup: string;
  resultCatrgory: string;
  serviceProviderCode: string;
  resultCount: number;
}

function getOrCreateResultNodesArray(groupNode: PNode): PNode[] {
  const children = getChildren(groupNode);
  let container = children.find((c) => Object.keys(c).includes("inspectionResultGroupModels"));
  if (!container) {
    container = { inspectionResultGroupModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toRefInspectionResultGroupRow(node: PNode): RefInspectionResultGroupRow {
  const children = getChildren(node);
  const resultCount = getOrCreateResultNodesArray(node).filter((c) =>
    Object.keys(c).includes("inspectionResultGroupModel")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    inspResultGroup: getChildText(children, "inspResultGroup"),
    resultCatrgory: getChildText(children, "resultCatrgory"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    resultCount,
  };
}

export interface InspectionResultGroupModelRow {
  uid: string;
  refId: string;
  inspResult: string;
  inspResultType: string;
  inspResultDisplayOrder: string;
  inspResultGroup: string;
  resultCatrgory: string;
  serviceProviderCode: string;
}

export function toInspectionResultGroupModelRow(node: PNode): InspectionResultGroupModelRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    inspResult: getChildText(children, "inspResult"),
    inspResultType: getChildText(children, "inspResultType"),
    inspResultDisplayOrder: getChildText(children, "inspResultDisplayOrder"),
    inspResultGroup: getChildText(children, "inspResultGroup"),
    resultCatrgory: getChildText(children, "resultCatrgory"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: RefInspectionResultGroupRow[]): string {
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
  suffix: "RefInspectionResultGroupModel" | "InspectionResultGroupModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findRefInspectionResultGroupByUid(
  records: PNode[],
  uid: string
): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findInspectionResultGroupModelByUid(
  groupNode: PNode,
  uid: string
): PNode | undefined {
  return findNodeByUid(getOrCreateResultNodesArray(groupNode), uid);
}

export function getInspectionResultGroupModelNodes(groupNode: PNode): PNode[] {
  return getOrCreateResultNodesArray(groupNode);
}

export const REF_INSPECTION_RESULT_GROUP_EDITABLE_FIELDS = [
  "inspResultGroup",
  "resultCatrgory",
  "serviceProviderCode",
] as const;

export const INSPECTION_RESULT_GROUP_MODEL_EDITABLE_FIELDS = [
  "inspResult",
  "inspResultType",
  "inspResultDisplayOrder",
  "inspResultGroup",
  "resultCatrgory",
  "serviceProviderCode",
] as const;

export function setRefInspectionResultGroupField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "inspResultGroup" || field === "resultCatrgory") {
    for (const t of getOrCreateResultNodesArray(node)) {
      setChildText(getChildren(t), field, value);
    }
  }
}

export function setInspectionResultGroupModelField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createRefInspectionResultGroupNode(
  refIdNum: number,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "inspResultGroup", "");
  setChildText(children, "resultCatrgory", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push({ inspectionResultGroupModels: [] });
  const node: PNode = { refInspResultGroup: children };
  setAttr(node, "refId", `${refIdNum}@RefInspectionResultGroupModel`);
  return node;
}

export function createInspectionResultGroupModelNode(
  refIdNum: number,
  inspResultGroup: string,
  resultCatrgory: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "inspResultGroup", inspResultGroup);
  setChildText(children, "inspResult", "");
  setChildText(children, "resultCatrgory", resultCatrgory);
  children.push(createAuditModelNode());
  setChildText(children, "inspResultDisplayOrder", "");
  children.push({ inspResultGroupI18Ns: [] });
  setChildText(children, "inspResultType", "");
  const node: PNode = { inspectionResultGroupModel: children };
  setAttr(node, "refId", `${refIdNum}@InspectionResultGroupModel`);
  return node;
}

export function deleteRefInspectionResultGroup(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteInspectionResultGroupModel(groupNode: PNode, resultNode: PNode) {
  const arr = getOrCreateResultNodesArray(groupNode);
  const idx = arr.indexOf(resultNode);
  if (idx >= 0) arr.splice(idx, 1);
}
