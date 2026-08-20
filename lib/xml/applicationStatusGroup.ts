/**
 * ApplicationStatusGroupModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Parent/child category — a status group with a repeating list of statuses
 * under it. Confirmed against a real 2-record sample
 * (fixtures/application-status-group/asg-real.xml): both levels use
 * `serviceProviderCode` (no field-name split), the parent carries no
 * `refId`, but each child `appStatusGroupModel` does — and, like other
 * categories, that refId is reused (`1@AppStatusGroupModel` on both real
 * samples here) rather than unique, so row identity uses the synthetic uid
 * (getNodeUid in lib/xml/pnode.ts), not refId.
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
export type ParsedApplicationStatusGroupFile = ParsedListFile;

const COLLECTION_TAGS = new Set(["appStatusGroupModels", "appStatusGroupI18Ns"]);

/** Cheap content sniff — real export files aren't necessarily named "ApplicationStatusGroupModel.xml". */
export function isApplicationStatusGroupXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<applicationStatusGroup[\s>]/.test(xmlText);
}

export function parseApplicationStatusGroupXml(xmlText: string): ParsedApplicationStatusGroupFile {
  return parseListXml(xmlText, "applicationStatusGroup");
}

export function serializeApplicationStatusGroupXml(
  file: ParsedApplicationStatusGroupFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedApplicationStatusGroupXml(
  file: ParsedApplicationStatusGroupFile
): string {
  return serializeApplicationStatusGroupXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations
// ---------------------------------------------------------------------------

export interface ApplicationStatusGroupRow {
  uid: string;
  refId: string;
  appStatusGroupCode: string;
  serviceProviderCode: string;
  statusCount: number;
}

function getOrCreateStatusNodesArray(groupNode: PNode): PNode[] {
  const children = getChildren(groupNode);
  let container = children.find((c) => Object.keys(c).includes("appStatusGroupModels"));
  if (!container) {
    container = { appStatusGroupModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toApplicationStatusGroupRow(node: PNode): ApplicationStatusGroupRow {
  const children = getChildren(node);
  const statusCount = getOrCreateStatusNodesArray(node).filter((c) =>
    Object.keys(c).includes("appStatusGroupModel")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    appStatusGroupCode: getChildText(children, "appStatusGroupCode"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    statusCount,
  };
}

export interface AppStatusGroupModelRow {
  uid: string;
  refId: string;
  status: string;
  statusType: string;
  appStatusGroupCode: string;
  serviceProviderCode: string;
}

export function toAppStatusGroupModelRow(node: PNode): AppStatusGroupModelRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    status: getChildText(children, "status"),
    statusType: getChildText(children, "statusType"),
    appStatusGroupCode: getChildText(children, "appStatusGroupCode"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: ApplicationStatusGroupRow[]): string {
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
  suffix: "ApplicationStatusGroupModel" | "AppStatusGroupModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findApplicationStatusGroupByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findAppStatusGroupModelByUid(groupNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateStatusNodesArray(groupNode), uid);
}

export function getAppStatusGroupModelNodes(groupNode: PNode): PNode[] {
  return getOrCreateStatusNodesArray(groupNode);
}

export const APPLICATION_STATUS_GROUP_EDITABLE_FIELDS = [
  "appStatusGroupCode",
  "serviceProviderCode",
] as const;

export const APP_STATUS_GROUP_MODEL_EDITABLE_FIELDS = [
  "status",
  "statusType",
  "appStatusGroupCode",
  "serviceProviderCode",
] as const;

export function setApplicationStatusGroupField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "appStatusGroupCode") {
    for (const t of getOrCreateStatusNodesArray(node)) {
      setChildText(getChildren(t), field, value);
    }
  }
}

export function setAppStatusGroupModelField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createApplicationStatusGroupNode(
  refIdNum: number,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "appStatusGroupCode", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push({ appStatusGroupModels: [] });
  const node: PNode = { applicationStatusGroup: children };
  setAttr(node, "refId", `${refIdNum}@ApplicationStatusGroupModel`);
  return node;
}

export function createAppStatusGroupModelNode(
  refIdNum: number,
  appStatusGroupCode: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "appStatusGroupCode", appStatusGroupCode);
  setChildText(children, "status", "");
  children.push({ appStatusGroupI18Ns: [] });
  children.push(createAuditModelNode());
  setChildText(children, "statusType", "");
  const node: PNode = { appStatusGroupModel: children };
  setAttr(node, "refId", `${refIdNum}@AppStatusGroupModel`);
  return node;
}

export function deleteApplicationStatusGroup(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteAppStatusGroupModel(groupNode: PNode, statusNode: PNode) {
  const arr = getOrCreateStatusNodesArray(groupNode);
  const idx = arr.indexOf(statusNode);
  if (idx >= 0) arr.splice(idx, 1);
}
