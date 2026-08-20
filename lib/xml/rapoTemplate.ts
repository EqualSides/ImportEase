/**
 * RAPOTemplateModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Parent/child category — a template with a repeating list of attributes
 * under it. Confirmed against a real 2-record sample
 * (fixtures/rapo-template/rt-real.xml): no `refId` on either level. Real
 * records also carry `formLayoutEditorVirtualModels` and `pageStatusModels`
 * sibling collections on the parent (screen-layout/import-tooling
 * metadata) — this module never reads or edits those, so they round-trip
 * untouched via the generic tree serializer regardless of what they
 * contain.
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
export type ParsedRAPOTemplateFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "apoTemplateAttributes",
  "apoTemplateAttributeValues",
  "rapoTemplateAttributeI18NModels",
  "formLayoutEditorVirtualModels",
  "pageStatusModels",
]);

/** Cheap content sniff — real export files aren't necessarily named "RAPOTemplateModel.xml". */
export function isRAPOTemplateXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<rapoTemplateModel[\s>]/.test(xmlText);
}

export function parseRAPOTemplateXml(xmlText: string): ParsedRAPOTemplateFile {
  return parseListXml(xmlText, "rapoTemplateModel");
}

export function serializeRAPOTemplateXml(
  file: ParsedRAPOTemplateFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedRAPOTemplateXml(file: ParsedRAPOTemplateFile): string {
  return serializeRAPOTemplateXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations
// ---------------------------------------------------------------------------

export interface RAPOTemplateRow {
  uid: string;
  refId: string;
  templateName: string;
  templateType: string;
  templateDescription: string;
  sourceSeqNbr: string;
  attributeCount: number;
}

function getOrCreateAttributeNodesArray(templateNode: PNode): PNode[] {
  const children = getChildren(templateNode);
  let container = findChildByTag(children, "apoTemplateAttributes");
  if (!container) {
    container = { apoTemplateAttributes: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toRAPOTemplateRow(node: PNode): RAPOTemplateRow {
  const children = getChildren(node);
  const attributeCount = getOrCreateAttributeNodesArray(node).filter((c) =>
    Object.keys(c).includes("apoTemplateAttribute")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    templateName: getChildText(children, "templateName"),
    templateType: getChildText(children, "templateType"),
    templateDescription: getChildText(children, "templateDescription"),
    sourceSeqNbr: getChildText(children, "sourceSeqNbr"),
    attributeCount,
  };
}

export interface ApoTemplateAttributeRow {
  uid: string;
  refId: string;
  attributeName: string;
  attributeLabel: string;
  attributeGroup: string;
  attributeSubGroup: string;
  attributeDescription: string;
  dataType: string;
  displayOrder: string;
  requiredFlag: string;
  searchableFlag: string;
  templateName: string;
  templateType: string;
}

export function toApoTemplateAttributeRow(node: PNode): ApoTemplateAttributeRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    attributeName: getChildText(children, "attributeName"),
    attributeLabel: getChildText(children, "attributeLabel"),
    attributeGroup: getChildText(children, "attributeGroup"),
    attributeSubGroup: getChildText(children, "attributeSubGroup"),
    attributeDescription: getChildText(children, "attributeDescription"),
    dataType: getChildText(children, "dataType"),
    displayOrder: getChildText(children, "displayOrder"),
    requiredFlag: getChildText(children, "requiredFlag"),
    searchableFlag: getChildText(children, "searchableFlag"),
    templateName: getChildText(children, "templateName"),
    templateType: getChildText(children, "templateType"),
  };
}

// Not part of the sensitive-data ⚠️ set, and this category has no
// serviceProviderCode/servProvCode field at either level in the real
// schema — Agency ID has no natural home here, so applyAgencyIdToAll is a
// no-op for this category (still implemented on the grid for interface
// consistency with every other category's handle).
export function inferCommonAgencyId(_rows: RAPOTemplateRow[]): string {
  return "";
}

export function nextRefIdNumber(
  records: PNode[],
  suffix: "RAPOTemplateModel" | "ApoTemplateAttributeModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findRAPOTemplateByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findApoTemplateAttributeByUid(templateNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateAttributeNodesArray(templateNode), uid);
}

export function getApoTemplateAttributeNodes(templateNode: PNode): PNode[] {
  return getOrCreateAttributeNodesArray(templateNode);
}

export const RAPO_TEMPLATE_EDITABLE_FIELDS = [
  "templateName",
  "templateType",
  "templateDescription",
  "sourceSeqNbr",
] as const;

export const APO_TEMPLATE_ATTRIBUTE_EDITABLE_FIELDS = [
  "attributeName",
  "attributeLabel",
  "attributeGroup",
  "attributeSubGroup",
  "attributeDescription",
  "dataType",
  "displayOrder",
  "requiredFlag",
  "searchableFlag",
  "templateName",
  "templateType",
] as const;

/** Editing the template's name/type cascades into every attribute's own duplicate copies of those fields. */
export function setRAPOTemplateField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "templateName" || field === "templateType") {
    for (const attr of getOrCreateAttributeNodesArray(node)) {
      setChildText(getChildren(attr), field, value);
    }
  }
}

export function setApoTemplateAttributeField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createRAPOTemplateNode(refIdNum: number): PNode {
  const children: PNode[] = [];
  setChildText(children, "sourceSeqNbr", "");
  setChildText(children, "templateName", "");
  setChildText(children, "templateType", "");
  children.push(createAuditModelNode());
  children.push({ formLayoutEditorVirtualModels: [] });
  children.push({ pageStatusModels: [] });
  children.push({ apoTemplateAttributes: [] });
  setChildText(children, "templateDescription", "");
  const node: PNode = { rapoTemplateModel: children };
  setAttr(node, "refId", `${refIdNum}@RAPOTemplateModel`);
  return node;
}

export function createApoTemplateAttributeNode(
  refIdNum: number,
  templateName: string,
  templateType: string
): PNode {
  const children: PNode[] = [];
  setChildText(children, "attributeName", "");
  setChildText(children, "sourceSeqNbr", "");
  setChildText(children, "templateName", templateName);
  setChildText(children, "templateType", templateType);
  setChildText(children, "attributeGroup", "");
  setChildText(children, "attributeLabel", "");
  setChildText(children, "attributeSubGroup", "");
  children.push({ apoTemplateAttributeValues: [] });
  children.push(createAuditModelNode());
  setChildText(children, "dataType", "");
  setChildText(children, "displayOrder", "");
  children.push({ rapoTemplateAttributeI18NModels: [] });
  setChildText(children, "requiredFlag", "");
  setChildText(children, "searchableFlag", "");
  setChildText(children, "vchFlag", "");
  const node: PNode = { apoTemplateAttribute: children };
  setAttr(node, "refId", `${refIdNum}@ApoTemplateAttributeModel`);
  return node;
}

export function deleteRAPOTemplate(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteApoTemplateAttribute(templateNode: PNode, attributeNode: PNode) {
  const arr = getOrCreateAttributeNodesArray(templateNode);
  const idx = arr.indexOf(attributeNode);
  if (idx >= 0) arr.splice(idx, 1);
}
