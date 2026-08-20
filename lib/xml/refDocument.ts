/**
 * RefDocumentModel.xml parse/serialize (see full-schema-reference.md).
 *
 * A conventional 2-level parent/child category (document requirement ->
 * entity type), same shape as Ref Address Type Group/RAPO Template.
 * docCode is NOT a unique key — many rows in the real file share the same
 * docCode with different docSeqNumber values (each is a separate document
 * requirement entry for that record type), confirmed by the real sample.
 *
 * A document also carries three untouched sibling fields/arms this
 * module never reads or writes: documentsecurityModels (genuine
 * security data), refDocumentI18NModels, and templateAttribute (an
 * embedded singleton reference object, confirmed populated in 255 of
 * the real file's records — same "large embedded reference blob, never
 * touched" treatment as Ref Fee Schedule's unitDescModel).
 *
 * Confirmed against a real 2-record sample
 * (fixtures/ref-document/rd-real.xml: "LIC_ACC_A"/seq 1935 with zero
 * entity types, "BD_BUILDING"/seq 712 with one entity type). The parent
 * carries a `refId` attribute in the real sample; the child
 * (XDocEntityType) does not.
 *
 * Cascades: a document's docCode cascades into every entity type's own
 * docGroup (confirmed identical to the doc code in the real sample —
 * "BD_BUILDING" docCode -> "BD_BUILDING" docGroup); serviceProviderCode
 * cascades into every entity type's own serviceProviderCode.
 */
import {
  type ListAttrs,
  type ParsedListFile,
  type PNode,
  createAuditModelNode,
  findChildByTag,
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
export type ParsedRefDocumentFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "XDocEntityTypes",
  "refDocumentI18NModels",
  "documentsecurityModels",
]);

/** Cheap content sniff — real export files aren't necessarily named "RefDocumentModel.xml". */
export function isRefDocumentXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<refDocument[\s>]/.test(xmlText);
}

export function parseRefDocumentXml(xmlText: string): ParsedRefDocumentFile {
  return parseListXml(xmlText, "refDocument");
}

export function serializeRefDocumentXml(
  file: ParsedRefDocumentFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedRefDocumentXml(file: ParsedRefDocumentFile): string {
  return serializeRefDocumentXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations — two levels: document -> entity type
// ---------------------------------------------------------------------------

export interface RefDocumentRow {
  uid: string;
  refId: string;
  docCode: string;
  docSeqNumber: string;
  documentType: string;
  serviceProviderCode: string;
  resDocCode: string;
  documentComment: string;
  documentName: string;
  docStatusGroup: string;
  guideGroup: string;
  reviewStatusGroup: string;
  autoDownload: string;
  restrictDocTypeForACA: string;
  deleteRole: string;
  titleRestrictRole: string;
  uploadRole: string;
  viewRole: string;
  entityTypeCount: number;
}

function getOrCreateEntityTypeNodesArray(docNode: PNode): PNode[] {
  const children = getChildren(docNode);
  let container = findChildByTag(children, "XDocEntityTypes");
  if (!container) {
    container = { XDocEntityTypes: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toRefDocumentRow(node: PNode): RefDocumentRow {
  const children = getChildren(node);
  const entityTypeCount = getOrCreateEntityTypeNodesArray(node).filter((c) =>
    Object.keys(c).includes("XDocEntityType")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    docCode: getChildText(children, "docCode"),
    docSeqNumber: getChildText(children, "docSeqNumber"),
    documentType: getChildText(children, "documentType"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    resDocCode: getChildText(children, "resDocCode"),
    documentComment: getChildText(children, "documentComment"),
    documentName: getChildText(children, "documentName"),
    docStatusGroup: getChildText(children, "docStatusGroup"),
    guideGroup: getChildText(children, "guideGroup"),
    reviewStatusGroup: getChildText(children, "reviewStatusGroup"),
    autoDownload: getChildText(children, "autoDownload"),
    restrictDocTypeForACA: getChildText(children, "restrictDocTypeForACA"),
    deleteRole: getChildText(children, "deleteRole"),
    titleRestrictRole: getChildText(children, "titleRestrictRole"),
    uploadRole: getChildText(children, "uploadRole"),
    viewRole: getChildText(children, "viewRole"),
    entityTypeCount,
  };
}

export interface XDocEntityTypeRow {
  uid: string;
  entType: string;
  entValue: string;
  licType: string;
  docGroup: string;
  resID: string;
  serviceProviderCode: string;
}

export function toXDocEntityTypeRow(node: PNode): XDocEntityTypeRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    entType: getChildText(children, "entType"),
    entValue: getChildText(children, "entValue"),
    licType: getChildText(children, "licType"),
    docGroup: getChildText(children, "docGroup"),
    resID: getChildText(children, "resID"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: RefDocumentRow[]): string {
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

export function nextRefIdNumber(records: PNode[]): number {
  return nextRefIdNumberGeneric(records, "RefDocumentModel");
}

export function findRefDocumentByUid(records: PNode[], uid: string): PNode | undefined {
  return records.find((n) => getNodeUid(n) === uid);
}

export function findXDocEntityTypeByUid(docNode: PNode, uid: string): PNode | undefined {
  return getOrCreateEntityTypeNodesArray(docNode).find((n) => getNodeUid(n) === uid);
}

export function getXDocEntityTypeNodes(docNode: PNode): PNode[] {
  return getOrCreateEntityTypeNodesArray(docNode);
}

export const REF_DOCUMENT_EDITABLE_FIELDS = [
  "docCode",
  "docSeqNumber",
  "documentType",
  "serviceProviderCode",
  "resDocCode",
  "documentComment",
  "documentName",
  "docStatusGroup",
  "guideGroup",
  "reviewStatusGroup",
  "autoDownload",
  "restrictDocTypeForACA",
  "deleteRole",
  "titleRestrictRole",
  "uploadRole",
  "viewRole",
] as const;

export const XDOC_ENTITY_TYPE_EDITABLE_FIELDS = [
  "entType",
  "entValue",
  "licType",
  "docGroup",
  "resID",
  "serviceProviderCode",
] as const;

/** Editing the document's docCode cascades into every entity type's own
 * docGroup; serviceProviderCode cascades into every entity type's own copy. */
export function setRefDocumentField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "docCode") {
    for (const et of getOrCreateEntityTypeNodesArray(node)) {
      setChildText(getChildren(et), "docGroup", value);
    }
  } else if (field === "serviceProviderCode") {
    for (const et of getOrCreateEntityTypeNodesArray(node)) {
      setChildText(getChildren(et), "serviceProviderCode", value);
    }
  }
}

export function setXDocEntityTypeField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createRefDocumentNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "docCode", "");
  setChildText(children, "docSeqNumber", "");
  setChildText(children, "resDocCode", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push(createAuditModelNode());
  setChildText(children, "autoDownload", "N");
  setChildText(children, "deleteRole", "0000000000");
  children.push({ XDocEntityTypes: [] });
  children.push({ refDocumentI18NModels: [] });
  setChildText(children, "documentType", "");
  children.push({ documentsecurityModels: [] });
  setChildText(children, "restrictDocTypeForACA", "N");
  setChildText(children, "titleRestrictRole", "0000000000");
  setChildText(children, "uploadRole", "0000000000");
  setChildText(children, "viewRole", "0000000000");
  const node: PNode = { refDocument: children };
  setAttr(node, "refId", `${refIdNum}@RefDocumentModel`);
  return node;
}

export function createXDocEntityTypeNode(docGroup: string, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "resID", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push(createAuditModelNode());
  setChildText(children, "docGroup", docGroup);
  setChildText(children, "entType", "");
  setChildText(children, "entValue", "");
  setChildText(children, "licType", "");
  return { XDocEntityType: children };
}

export function deleteRefDocument(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteXDocEntityType(docNode: PNode, entityTypeNode: PNode) {
  const arr = getOrCreateEntityTypeNodesArray(docNode);
  const idx = arr.indexOf(entityTypeNode);
  if (idx >= 0) arr.splice(idx, 1);
}
