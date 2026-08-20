/**
 * SmartChoiceGroupModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Third three-level category (see lib/xml/refLookupTable.ts and
 * lib/xml/guideSheet.ts for the first two): a smart choice group has a
 * repeating list of smart choices (one per Accela function name), and each
 * smart choice has its own repeating list of options. Conventional
 * `xxxModels`-style containers at both levels, no wrapper oddity — same
 * shape family as GuideSheet.
 *
 * Confirmed against a real 2-record sample
 * (fixtures/smart-choice-group/scg-real.xml: two groups, each with 52 smart
 * choices, of which one smart choice per group carries two options). No
 * `refId` attribute on smart choices or options in the real sample — only
 * the group itself carries one, and (consistent with every other category
 * that has refId) it's reused across records ("1@SmartChoiceGroupModel" on
 * both), so row identity uses the synthetic uid (getNodeUid in
 * lib/xml/pnode.ts), not refId.
 *
 * Each group also carries an untouched `structureTypeModels` sibling
 * collection (a large embedded reference blob unrelated to smart choices)
 * that this module never reads or writes but must round-trip unmodified.
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
export type ParsedSmartChoiceGroupFile = ParsedListFile;

const COLLECTION_TAGS = new Set(["smartChoiceModels", "smartChoiceOptionModels"]);

/** Cheap content sniff — real export files aren't necessarily named "SmartChoiceGroupModel.xml". */
export function isSmartChoiceGroupXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<smartChoiceGroup[\s>]/.test(xmlText);
}

export function parseSmartChoiceGroupXml(xmlText: string): ParsedSmartChoiceGroupFile {
  return parseListXml(xmlText, "smartChoiceGroup");
}

export function serializeSmartChoiceGroupXml(
  file: ParsedSmartChoiceGroupFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedSmartChoiceGroupXml(file: ParsedSmartChoiceGroupFile): string {
  return serializeSmartChoiceGroupXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations — three levels: group -> smart choice -> option
// ---------------------------------------------------------------------------

export interface SmartChoiceGroupRow {
  uid: string;
  refId: string;
  groupCode: string;
  serviceProviderCode: string;
  choiceCount: number;
}

function getOrCreateSmartChoiceNodesArray(groupNode: PNode): PNode[] {
  const children = getChildren(groupNode);
  let container = findChildByTag(children, "smartChoiceModels");
  if (!container) {
    container = { smartChoiceModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toSmartChoiceGroupRow(node: PNode): SmartChoiceGroupRow {
  const children = getChildren(node);
  const choiceCount = getOrCreateSmartChoiceNodesArray(node).filter((c) =>
    Object.keys(c).includes("smartChoice")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    groupCode: getChildText(children, "groupCode"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    choiceCount,
  };
}

export interface SmartChoiceRow {
  uid: string;
  refId: string;
  functionName: string;
  groupName: string;
  defaultValue: string;
  displayFlg: string;
  displayOrder: string;
  requiredFlg: string;
  validateFlg: string;
  serviceProviderCode: string;
  optionCount: number;
}

function getOrCreateOptionNodesArray(choiceNode: PNode): PNode[] {
  const children = getChildren(choiceNode);
  let container = findChildByTag(children, "smartChoiceOptionModels");
  if (!container) {
    container = { smartChoiceOptionModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toSmartChoiceRow(node: PNode): SmartChoiceRow {
  const children = getChildren(node);
  const optionCount = getOrCreateOptionNodesArray(node).filter((c) =>
    Object.keys(c).includes("smartChoiceOption")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    functionName: getChildText(children, "functionName"),
    groupName: getChildText(children, "groupName"),
    defaultValue: getChildText(children, "defaultValue"),
    displayFlg: getChildText(children, "displayFlg"),
    displayOrder: getChildText(children, "displayOrder"),
    requiredFlg: getChildText(children, "requiredFlg"),
    validateFlg: getChildText(children, "validateFlg"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    optionCount,
  };
}

export interface SmartChoiceOptionRow {
  uid: string;
  refId: string;
  functionOption: string;
  functionName: string;
  groupName: string;
  optionQuantity: string;
  serviceProviderCode: string;
}

export function toSmartChoiceOptionRow(node: PNode): SmartChoiceOptionRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    functionOption: getChildText(children, "functionOption"),
    functionName: getChildText(children, "functionName"),
    groupName: getChildText(children, "groupName"),
    optionQuantity: getChildText(children, "optionQuantity"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: SmartChoiceGroupRow[]): string {
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
  suffix: "SmartChoiceGroupModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findSmartChoiceGroupByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findSmartChoiceByUid(groupNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateSmartChoiceNodesArray(groupNode), uid);
}

export function findSmartChoiceOptionByUid(choiceNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateOptionNodesArray(choiceNode), uid);
}

export function getSmartChoiceNodes(groupNode: PNode): PNode[] {
  return getOrCreateSmartChoiceNodesArray(groupNode);
}

export function getSmartChoiceOptionNodes(choiceNode: PNode): PNode[] {
  return getOrCreateOptionNodesArray(choiceNode);
}

export const SMART_CHOICE_GROUP_EDITABLE_FIELDS = ["groupCode", "serviceProviderCode"] as const;

export const SMART_CHOICE_EDITABLE_FIELDS = [
  "functionName",
  "groupName",
  "defaultValue",
  "displayFlg",
  "displayOrder",
  "requiredFlg",
  "validateFlg",
  "serviceProviderCode",
] as const;

export const SMART_CHOICE_OPTION_EDITABLE_FIELDS = [
  "functionOption",
  "functionName",
  "groupName",
  "optionQuantity",
  "serviceProviderCode",
] as const;

/** Editing the group's groupCode cascades into every smart choice's and every option's groupName. */
export function setSmartChoiceGroupField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "groupCode") {
    for (const choice of getOrCreateSmartChoiceNodesArray(node)) {
      setChildText(getChildren(choice), "groupName", value);
      for (const opt of getOrCreateOptionNodesArray(choice)) {
        setChildText(getChildren(opt), "groupName", value);
      }
    }
  }
}

/** Editing a smart choice's functionName cascades into that choice's own options' functionName. */
export function setSmartChoiceField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "functionName") {
    for (const opt of getOrCreateOptionNodesArray(node)) {
      setChildText(getChildren(opt), field, value);
    }
  }
}

export function setSmartChoiceOptionField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createSmartChoiceGroupNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "groupCode", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push({ smartChoiceModels: [] });
  const node: PNode = { smartChoiceGroup: children };
  setAttr(node, "refId", `${refIdNum}@SmartChoiceGroupModel`);
  return node;
}

export function createSmartChoiceNode(groupName: string, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "functionName", "");
  setChildText(children, "groupName", groupName);
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push(createAuditModelNode());
  setChildText(children, "defaultValue", "");
  setChildText(children, "displayFlg", "");
  setChildText(children, "displayOrder", "");
  setChildText(children, "requiredFlg", "");
  children.push({ smartChoiceOptionModels: [] });
  setChildText(children, "validateFlg", "");
  return { smartChoice: children };
}

export function createSmartChoiceOptionNode(
  functionName: string,
  groupName: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "functionName", functionName);
  setChildText(children, "functionOption", "");
  setChildText(children, "groupName", groupName);
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push(createAuditModelNode());
  setChildText(children, "optionQuantity", "1");
  return { smartChoiceOption: children };
}

export function deleteSmartChoiceGroup(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteSmartChoice(groupNode: PNode, choiceNode: PNode) {
  const arr = getOrCreateSmartChoiceNodesArray(groupNode);
  const idx = arr.indexOf(choiceNode);
  if (idx >= 0) arr.splice(idx, 1);
}

export function deleteSmartChoiceOption(choiceNode: PNode, optionNode: PNode) {
  const arr = getOrCreateOptionNodesArray(choiceNode);
  const idx = arr.indexOf(optionNode);
  if (idx >= 0) arr.splice(idx, 1);
}
