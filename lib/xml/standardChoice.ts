/**
 * StandardChoiceModel.xml parse/serialize.
 *
 * Fidelity strategy (see docs/schema-standard-choice.md and CLAUDE.md):
 * - Parse with fast-xml-parser's `preserveOrder` mode so every record keeps
 *   its original child-element order and unknown/undocumented fields (e.g.
 *   `valueSize` on a `standardChoice`, which isn't in the schema doc but
 *   appears in real exports) survive untouched instead of being dropped by
 *   a hand-maintained field list.
 * - `processEntities: false` + `trimValues: false` on parse means text
 *   content is kept as the literal source bytes (entities un-decoded,
 *   whitespace un-trimmed). Untouched fields are therefore never at risk of
 *   a decode/re-encode mismatch on export — we simply never touch them.
 * - Empty leaf fields (`<description></description>`) and empty
 *   collections (`<standardChoiceValueI18NModels/>`) parse to the exact
 *   same shape (`{ tag: [] }`) in fast-xml-parser's tree — there's no way
 *   to tell them apart from the parsed shape alone. `COLLECTION_TAGS` below
 *   is the static classification that resolves this on the way back out.
 * - The round-trip test (tests/roundtrip.test.ts) is intentionally a
 *   *structural* comparison, not a raw byte diff: Accela's own exporter is
 *   inconsistent about insignificant whitespace between sibling elements
 *   (no whitespace before the first record, a newline before each
 *   following one), and `exportUser`/`exportDateTime` are deliberately
 *   rewritten on every export per the schema doc's own guidance. Neither
 *   affects what Accela's importer reads back.
 *
 * The order-preserving tree walk (PNode) and everything generic about
 * `<list>`-rooted files lives in lib/xml/pnode.ts, shared with every other
 * model category — this file only has StandardChoice's own field schema.
 */
import {
  type ListAttrs,
  type ParsedListFile,
  type PNode,
  createAuditModelNode,
  findNodeByUid,
  getAttr,
  getChildren,
  getChildText,
  getNodeUid,
  nextRefIdNumber as nextRefIdNumberGeneric,
  parseListXml,
  serializeListXml,
  setAttr,
  setChildText,
  formatAccelaDateTime,
} from "./pnode";

export type { PNode, ListAttrs };
export type ParsedStandardChoiceFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "standardChoiceValueModels",
  "standardChoiceValueI18NModels",
  "pageStatusModels",
]);

/** Cheap content sniff — real export files aren't necessarily named "StandardChoiceModel.xml". */
export function isStandardChoiceXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<standardChoice[\s>]/.test(xmlText);
}

export function parseStandardChoiceXml(xmlText: string): ParsedStandardChoiceFile {
  return parseListXml(xmlText, "standardChoice");
}

export function serializeStandardChoiceXml(
  file: ParsedStandardChoiceFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

/** Serializes for a real export: stamps exportUser/exportDateTime as the tool producing the package. */
export function buildExportedXml(file: ParsedStandardChoiceFile): string {
  return serializeStandardChoiceXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations
// ---------------------------------------------------------------------------

export interface StandardChoiceRow {
  uid: string;
  refId: string;
  name: string;
  serviceProviderCode: string;
  defaultValue: string;
  description: string;
  type: string;
  valueSize: string;
  valueCount: number;
}

/** Returns the live (mutable) array of `standardChoiceValue` nodes for a `standardChoice` node. */
function getOrCreateValueNodesArray(standardChoiceNode: PNode): PNode[] {
  const children = getChildren(standardChoiceNode);
  let container = children.find((c) => Object.keys(c).includes("standardChoiceValueModels"));
  if (!container) {
    container = { standardChoiceValueModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toStandardChoiceRow(node: PNode): StandardChoiceRow {
  const children = getChildren(node);
  const valueCount = getOrCreateValueNodesArray(node).filter(
    (c) => Object.keys(c).includes("standardChoiceValue")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    name: getChildText(children, "name"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    defaultValue: getChildText(children, "defaultValue"),
    description: getChildText(children, "description"),
    type: getChildText(children, "type"),
    valueSize: getChildText(children, "valueSize"),
    valueCount,
  };
}

export interface StandardChoiceValueRow {
  uid: string;
  refId: string;
  value: string;
  description: string;
  sortOrder: string;
  sequenceNBR: string;
  standardChoiceName: string;
}

export function toStandardChoiceValueRow(node: PNode): StandardChoiceValueRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    value: getChildText(children, "value"),
    description: getChildText(children, "description"),
    sortOrder: getChildText(children, "sortOrder"),
    sequenceNBR: getChildText(children, "sequenceNBR"),
    standardChoiceName: getChildText(children, "standardChoiceName"),
  };
}

/** Most common non-empty Agency ID among a set of standardChoice rows. */
export function inferCommonAgencyId(rows: StandardChoiceRow[]): string {
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
  suffix: "StandardChoiceModel" | "StandardChoiceValueModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findStandardChoiceByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findStandardChoiceValueByUid(
  standardChoiceNode: PNode,
  uid: string
): PNode | undefined {
  return findNodeByUid(getOrCreateValueNodesArray(standardChoiceNode), uid);
}

export function getStandardChoiceValueNodes(standardChoiceNode: PNode): PNode[] {
  return getOrCreateValueNodesArray(standardChoiceNode);
}

export const STANDARD_CHOICE_EDITABLE_FIELDS = [
  "name",
  "serviceProviderCode",
  "defaultValue",
  "description",
  "type",
  "valueSize",
] as const;

export const STANDARD_CHOICE_VALUE_EDITABLE_FIELDS = [
  "value",
  "description",
  "sortOrder",
  "sequenceNBR",
] as const;

export function setStandardChoiceField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "name") {
    for (const v of getOrCreateValueNodesArray(node)) {
      setChildText(getChildren(v), "standardChoiceName", value);
    }
  }
}

export function setStandardChoiceValueField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createStandardChoiceNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "name", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push(createAuditModelNode());
  setChildText(children, "defaultValue", "");
  setChildText(children, "description", "");
  children.push({ standardChoiceValueModels: [] });
  const node: PNode = { standardChoice: children };
  setAttr(node, "refId", `${refIdNum}@StandardChoiceModel`);
  return node;
}

export function createStandardChoiceValueNode(
  refIdNum: number,
  parentName: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "sequenceNBR", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push(createAuditModelNode());
  setChildText(children, "description", "");
  setChildText(children, "standardChoiceName", parentName);
  children.push({ standardChoiceValueI18NModels: [] });
  setChildText(children, "value", "");
  const node: PNode = { standardChoiceValue: children };
  setAttr(node, "refId", `${refIdNum}@StandardChoiceValueModel`);
  return node;
}

// Identity-based (not refId-based — refId isn't guaranteed unique, see getNodeUid in pnode.ts).
export function deleteStandardChoice(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteStandardChoiceValue(standardChoiceNode: PNode, valueNode: PNode) {
  const arr = getOrCreateValueNodesArray(standardChoiceNode);
  const idx = arr.indexOf(valueNode);
  if (idx >= 0) arr.splice(idx, 1);
}
