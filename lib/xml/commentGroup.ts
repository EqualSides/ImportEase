/**
 * CommentGroupModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Parent/child category — a comment-type group with a repeating list of
 * standard comments under it. Confirmed against a real 2-record sample
 * (fixtures/comment-group/cg-real.xml): both levels use
 * `serviceProviderCode`, neither level carries a `refId`.
 *
 * IMPORTANT: this file's top-level record tag is `<standardCommentGroup>` —
 * the *same* tag StandardCommentGroupModel.xml uses (a much larger,
 * unrelated category with checklistModels/inspectionModels/recordModels/
 * workflowModels sub-structures, not yet built). The two are only
 * distinguishable by field content, not tag name, so isCommentGroupXml
 * additionally requires `<standardCommentModels>` — a child tag unique to
 * this category — rather than sniffing the record tag alone. If
 * StandardCommentGroupModel is ever built, its sniff must be equally
 * specific (e.g. requiring `<groupName>` or `<checklistModels>`) so the two
 * detectors stay mutually exclusive.
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
export type ParsedCommentGroupFile = ParsedListFile;

const COLLECTION_TAGS = new Set(["standardCommentModels", "standardCommentI18Ns"]);

/** See the module doc comment above — requires standardCommentModels to disambiguate from StandardCommentGroupModel.xml, which reuses the same <standardCommentGroup> record tag. */
export function isCommentGroupXml(xmlText: string): boolean {
  return (
    /<list[\s>]/.test(xmlText) &&
    /<standardCommentGroup[\s>]/.test(xmlText) &&
    /<standardCommentModels[\s>]/.test(xmlText)
  );
}

export function parseCommentGroupXml(xmlText: string): ParsedCommentGroupFile {
  return parseListXml(xmlText, "standardCommentGroup");
}

export function serializeCommentGroupXml(
  file: ParsedCommentGroupFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedCommentGroupXml(file: ParsedCommentGroupFile): string {
  return serializeCommentGroupXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations
// ---------------------------------------------------------------------------

export interface CommentGroupRow {
  uid: string;
  refId: string;
  commentType: string;
  serviceProviderCode: string;
  commentCount: number;
}

function getOrCreateCommentNodesArray(groupNode: PNode): PNode[] {
  const children = getChildren(groupNode);
  let container = children.find((c) => Object.keys(c).includes("standardCommentModels"));
  if (!container) {
    container = { standardCommentModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toCommentGroupRow(node: PNode): CommentGroupRow {
  const children = getChildren(node);
  const commentCount = getOrCreateCommentNodesArray(node).filter((c) =>
    Object.keys(c).includes("standardCommentModel")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    commentType: getChildText(children, "commentType"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    commentCount,
  };
}

export interface StandardCommentModelRow {
  uid: string;
  refId: string;
  commentName: string;
  comments: string;
  documentId: string;
  commentType: string;
  serviceProviderCode: string;
}

export function toStandardCommentModelRow(node: PNode): StandardCommentModelRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    commentName: getChildText(children, "commentName"),
    comments: getChildText(children, "comments"),
    documentId: getChildText(children, "documentId"),
    commentType: getChildText(children, "commentType"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: CommentGroupRow[]): string {
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
  suffix: "CommentGroupModel" | "StandardCommentModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findCommentGroupByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findStandardCommentModelByUid(groupNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateCommentNodesArray(groupNode), uid);
}

export function getStandardCommentModelNodes(groupNode: PNode): PNode[] {
  return getOrCreateCommentNodesArray(groupNode);
}

export const COMMENT_GROUP_EDITABLE_FIELDS = ["commentType", "serviceProviderCode"] as const;

export const STANDARD_COMMENT_MODEL_EDITABLE_FIELDS = [
  "commentName",
  "comments",
  "documentId",
  "commentType",
  "serviceProviderCode",
] as const;

export function setCommentGroupField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "commentType") {
    for (const t of getOrCreateCommentNodesArray(node)) {
      setChildText(getChildren(t), field, value);
    }
  }
}

export function setStandardCommentModelField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createCommentGroupNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "commentType", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push({ standardCommentModels: [] });
  const node: PNode = { standardCommentGroup: children };
  setAttr(node, "refId", `${refIdNum}@CommentGroupModel`);
  return node;
}

export function createStandardCommentModelNode(
  refIdNum: number,
  commentType: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "commentType", commentType);
  setChildText(children, "documentId", "");
  children.push(createAuditModelNode());
  setChildText(children, "commentName", "");
  setChildText(children, "comments", "");
  children.push({ standardCommentI18Ns: [] });
  const node: PNode = { standardCommentModel: children };
  setAttr(node, "refId", `${refIdNum}@StandardCommentModel`);
  return node;
}

export function deleteCommentGroup(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteStandardCommentModel(groupNode: PNode, commentNode: PNode) {
  const arr = getOrCreateCommentNodesArray(groupNode);
  const idx = arr.indexOf(commentNode);
  if (idx >= 0) arr.splice(idx, 1);
}
