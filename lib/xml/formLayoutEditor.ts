/**
 * FormLayoutEditorModel.xml parse/serialize (see full-schema-reference.md).
 *
 * A conventional 2-level parent/child category (screen -> screen element),
 * same shape as Ref Address Type Group/RAPO Template — but the real file
 * behind it is the largest single source file this app has been built
 * against (24MB, 430 screens, 10,373 elements total), so the fixture was
 * deliberately picked as two of the file's smallest real records rather
 * than anything representative of typical size.
 *
 * A screen also carries two untouched sibling arms this module never
 * reads or writes: formLayoutPermissionModels (genuine security data —
 * permissionAccess/permissionLevel/permissionValue — confirmed populated
 * in both fixture records) and formLayoutEditorI18NModels. `screenLayout2`
 * is a large HTML-fragment template string (the actual visual form layout,
 * HTML-entity-encoded) — treated as an ordinary opaque text field like any
 * other, never parsed or re-templated.
 *
 * Confirmed against a real 2-record sample
 * (fixtures/form-layout-editor/fle-real.xml: screen 2221 with one
 * element, screen 1991 with zero elements — confirming the self-closing
 * empty `formLayoutEditElementModels/` case). No `refId` attribute
 * anywhere in the real sample, at either level.
 *
 * Cascades: a screen's screenId cascades into every element's own
 * screenId; servProvCode cascades into every element's own servProvCode.
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
  parseListXml,
  serializeListXml,
  setChildText,
} from "./pnode";

export type { PNode, ListAttrs };
export type ParsedFormLayoutEditorFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "formLayoutEditElementModels",
  "formLayoutEditorI18NModels",
  "formLayoutPermissionModels",
  "FormLayoutEditElementI18NModels",
]);

/** Cheap content sniff — real export files aren't necessarily named "FormLayoutEditorModel.xml". */
export function isFormLayoutEditorXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<formLayoutEditor[\s>]/.test(xmlText);
}

export function parseFormLayoutEditorXml(xmlText: string): ParsedFormLayoutEditorFile {
  return parseListXml(xmlText, "formLayoutEditor");
}

export function serializeFormLayoutEditorXml(
  file: ParsedFormLayoutEditorFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedFormLayoutEditorXml(file: ParsedFormLayoutEditorFile): string {
  return serializeFormLayoutEditorXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations — two levels: screen -> element
// ---------------------------------------------------------------------------

export interface FormLayoutScreenRow {
  uid: string;
  screenId: string;
  screenName: string;
  screenLabel: string;
  screenType: string;
  screenGroupCode: string;
  servProvCode: string;
  contractNum: string;
  expandNum: string;
  refreshInterval: string;
  screenHeight: string;
  screenWidth: string;
  sizeUnit: string;
  useLayout2: string;
  isPermissionSelected: string;
  screenLayout2: string;
  elementCount: number;
}

function getOrCreateElementNodesArray(screenNode: PNode): PNode[] {
  const children = getChildren(screenNode);
  let container = findChildByTag(children, "formLayoutEditElementModels");
  if (!container) {
    container = { formLayoutEditElementModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toFormLayoutScreenRow(node: PNode): FormLayoutScreenRow {
  const children = getChildren(node);
  const elementCount = getOrCreateElementNodesArray(node).filter((c) =>
    Object.keys(c).includes("formLayoutEditElementModel")
  ).length;
  return {
    uid: getNodeUid(node),
    screenId: getChildText(children, "screenId"),
    screenName: getChildText(children, "screenName"),
    screenLabel: getChildText(children, "screenLabel"),
    screenType: getChildText(children, "screenType"),
    screenGroupCode: getChildText(children, "screenGroupCode"),
    servProvCode: getChildText(children, "servProvCode"),
    contractNum: getChildText(children, "contractNum"),
    expandNum: getChildText(children, "expandNum"),
    refreshInterval: getChildText(children, "refreshInterval"),
    screenHeight: getChildText(children, "screenHeight"),
    screenWidth: getChildText(children, "screenWidth"),
    sizeUnit: getChildText(children, "sizeUnit"),
    useLayout2: getChildText(children, "useLayout2"),
    isPermissionSelected: getChildText(children, "isPermissionSelected"),
    screenLayout2: getChildText(children, "screenLayout2"),
    elementCount,
  };
}

export interface FormLayoutElementRow {
  uid: string;
  screenElementName: string;
  screenElementLabel: string;
  screenGroupCode: string;
  screenSubgroupCode: string;
  elementLeft: string;
  elementTop: string;
  screenHeight: string;
  screenWidth: string;
  screenElementId: string;
  screenId: string;
  servProvCode: string;
}

export function toFormLayoutElementRow(node: PNode): FormLayoutElementRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    screenElementName: getChildText(children, "screenElementName"),
    screenElementLabel: getChildText(children, "screenElementLabel"),
    screenGroupCode: getChildText(children, "screenGroupCode"),
    screenSubgroupCode: getChildText(children, "screenSubgroupCode"),
    elementLeft: getChildText(children, "elementLeft"),
    elementTop: getChildText(children, "elementTop"),
    screenHeight: getChildText(children, "screenHeight"),
    screenWidth: getChildText(children, "screenWidth"),
    screenElementId: getChildText(children, "screenElementId"),
    screenId: getChildText(children, "screenId"),
    servProvCode: getChildText(children, "servProvCode"),
  };
}

export function inferCommonAgencyId(rows: FormLayoutScreenRow[]): string {
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

export function findFormLayoutScreenByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findFormLayoutElementByUid(screenNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateElementNodesArray(screenNode), uid);
}

export function getFormLayoutElementNodes(screenNode: PNode): PNode[] {
  return getOrCreateElementNodesArray(screenNode);
}

export const FORM_LAYOUT_SCREEN_EDITABLE_FIELDS = [
  "screenId",
  "screenName",
  "screenLabel",
  "screenType",
  "screenGroupCode",
  "servProvCode",
  "contractNum",
  "expandNum",
  "refreshInterval",
  "screenHeight",
  "screenWidth",
  "sizeUnit",
  "useLayout2",
  "isPermissionSelected",
  "screenLayout2",
] as const;

export const FORM_LAYOUT_ELEMENT_EDITABLE_FIELDS = [
  "screenElementName",
  "screenElementLabel",
  "screenGroupCode",
  "screenSubgroupCode",
  "elementLeft",
  "elementTop",
  "screenHeight",
  "screenWidth",
  "screenId",
  "servProvCode",
] as const;

/** Editing the screen's screenId/servProvCode cascades into every element's own copy. */
export function setFormLayoutScreenField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "screenId" || field === "servProvCode") {
    for (const el of getOrCreateElementNodesArray(node)) {
      setChildText(getChildren(el), field, value);
    }
  }
}

export function setFormLayoutElementField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createFormLayoutScreenNode(servProvCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "screenId", "");
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "contractNum", "0");
  setChildText(children, "expandNum", "0");
  children.push({ formLayoutEditElementModels: [] });
  children.push({ formLayoutEditorI18NModels: [] });
  children.push({ formLayoutPermissionModels: [] });
  setChildText(children, "isPermissionSelected", "N");
  children.push(createAuditModelNode());
  setChildText(children, "refreshInterval", "0");
  setChildText(children, "screenGroupCode", "");
  setChildText(children, "screenHeight", "0");
  setChildText(children, "screenLabel", "");
  setChildText(children, "screenLayout2", "");
  setChildText(children, "screenName", "");
  setChildText(children, "screenType", "");
  setChildText(children, "screenWidth", "0");
  setChildText(children, "sizeUnit", "0");
  setChildText(children, "useLayout2", "true");
  return { formLayoutEditor: children };
}

export function createFormLayoutElementNode(screenId: string, servProvCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "screenElementId", "");
  setChildText(children, "screenId", screenId);
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "elementLeft", "0");
  setChildText(children, "elementTop", "0");
  children.push({ FormLayoutEditElementI18NModels: [] });
  setChildText(children, "screenElementLabel", "");
  setChildText(children, "screenElementName", "");
  setChildText(children, "screenGroupCode", "");
  setChildText(children, "screenHeight", "0");
  setChildText(children, "screenSubgroupCode", "");
  setChildText(children, "screenWidth", "0");
  return { formLayoutEditElementModel: children };
}

export function deleteFormLayoutScreen(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteFormLayoutElement(screenNode: PNode, elementNode: PNode) {
  const arr = getOrCreateElementNodesArray(screenNode);
  const idx = arr.indexOf(elementNode);
  if (idx >= 0) arr.splice(idx, 1);
}
