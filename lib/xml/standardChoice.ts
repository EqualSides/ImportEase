import { XMLParser } from "fast-xml-parser";

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
 */

export type PNode = Record<string, any>;

const ATTR_KEY = ":@";
const TEXT_KEY = "#text";

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

// Tags that self-close (`<tag/>`) when empty, rather than `<tag></tag>`.
const COLLECTION_TAGS = new Set([
  "standardChoiceValueModels",
  "standardChoiceValueI18NModels",
  "pageStatusModels",
]);

export interface ListAttrs {
  version: string;
  minorVersion: string;
  exportUser: string;
  exportDateTime: string;
  description: string;
}

export interface ParsedStandardChoiceFile {
  listAttrs: ListAttrs;
  records: PNode[];
}

// ---------------------------------------------------------------------------
// Low-level PNode helpers
// ---------------------------------------------------------------------------

function getTagName(node: PNode): string | null {
  const keys = Object.keys(node).filter((k) => k !== ATTR_KEY && k !== TEXT_KEY);
  return keys[0] ?? null;
}

function getChildren(node: PNode): PNode[] {
  const tag = getTagName(node);
  if (!tag) return [];
  if (!Array.isArray(node[tag])) node[tag] = [];
  return node[tag] as PNode[];
}

function getAttr(node: PNode, name: string): string | undefined {
  return node[ATTR_KEY]?.[`@_${name}`];
}

function setAttr(node: PNode, name: string, value: string) {
  if (!node[ATTR_KEY]) node[ATTR_KEY] = {};
  node[ATTR_KEY][`@_${name}`] = value;
}

function findChildByTag(children: PNode[], tag: string): PNode | undefined {
  return children.find((c) => getTagName(c) === tag);
}

function getText(node: PNode): string {
  const tag = getTagName(node);
  if (!tag) return "";
  const kids = node[tag];
  if (!Array.isArray(kids) || kids.length === 0) return "";
  const textNode = kids.find((k: PNode) => TEXT_KEY in k);
  return textNode ? decodeText(String(textNode[TEXT_KEY])) : "";
}

function getChildText(children: PNode[], tag: string): string {
  const child = findChildByTag(children, tag);
  return child ? getText(child) : "";
}

/**
 * `value` is the logical (decoded) string as seen in the grid — it gets
 * entity-encoded here before being stored. Untouched fields never pass
 * through this function, so their stored text stays exactly as the parser
 * produced it (see the module doc comment on entity handling).
 */
function setChildText(children: PNode[], tag: string, value: string) {
  const child = findChildByTag(children, tag);
  const nextChildren = value === "" ? [] : [{ [TEXT_KEY]: escapeText(value) }];
  if (child) {
    child[tag] = nextChildren;
  } else {
    children.push({ [tag]: nextChildren });
  }
}

/** Returns the live (mutable) array of `standardChoiceValue` nodes for a `standardChoice` node. */
function getOrCreateValueNodesArray(standardChoiceNode: PNode): PNode[] {
  const children = getChildren(standardChoiceNode);
  let container = findChildByTag(children, "standardChoiceValueModels");
  if (!container) {
    container = { standardChoiceValueModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

function collectRefIdNumbers(node: PNode, suffix: string, out: number[]) {
  const refId = getAttr(node, "refId");
  if (refId && refId.endsWith("@" + suffix)) {
    const n = parseInt(refId.split("@")[0], 10);
    if (!Number.isNaN(n)) out.push(n);
  }
  const tag = getTagName(node);
  if (!tag) return;
  const kids = node[tag];
  if (!Array.isArray(kids)) return;
  for (const child of kids) {
    if (!(TEXT_KEY in child)) collectRefIdNumbers(child, suffix, out);
  }
}

/** Next free refId sequence number for the given model suffix, scanned across the whole file. */
export function nextRefIdNumber(
  records: PNode[],
  suffix: "StandardChoiceModel" | "StandardChoiceValueModel"
): number {
  const nums: number[] = [];
  for (const r of records) collectRefIdNumbers(r, suffix, nums);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

// ---------------------------------------------------------------------------
// Entity encode/decode — only ever applied at the edit boundary (setChildText
// encodes, getText decodes). Parsed-but-untouched text is never round-tripped
// through either function, so it keeps its exact original encoding; running
// it through escapeText on every serialize (as an earlier version of this
// file did) double-escapes already-encoded text like "&amp;" -> "&amp;amp;".
// ---------------------------------------------------------------------------

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeText(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (_match, name: string) => {
    switch (name) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default:
        return _match;
    }
  });
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  trimValues: false,
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
};

/** Cheap content sniff — real export files aren't necessarily named "StandardChoiceModel.xml". */
export function isStandardChoiceXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<standardChoice[\s>]/.test(xmlText);
}

export function parseStandardChoiceXml(xmlText: string): ParsedStandardChoiceFile {
  const parser = new XMLParser(parserOptions);
  const parsed: PNode[] = parser.parse(xmlText);
  const listNode = parsed.find((n) => getTagName(n) === "list");
  if (!listNode) throw new Error("No <list> root element found");

  const attrs = listNode[ATTR_KEY] ?? {};
  const listAttrs: ListAttrs = {
    version: attrs["@_version"] ?? "",
    minorVersion: attrs["@_minorVersion"] ?? "",
    exportUser: attrs["@_exportUser"] ?? "",
    exportDateTime: attrs["@_exportDateTime"] ?? "",
    description: attrs["@_description"] ?? "",
  };

  const records: PNode[] = (getChildren(listNode) ?? []).filter(
    (n: PNode) => getTagName(n) === "standardChoice"
  );

  return { listAttrs, records };
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

function serializeNode(node: PNode): string {
  if (TEXT_KEY in node) {
    // Already in stored (encoded) form — see the encode/decode comment above.
    return String(node[TEXT_KEY]);
  }
  const tag = getTagName(node);
  if (!tag) return "";

  const children: PNode[] = Array.isArray(node[tag]) ? node[tag] : [];
  const attrs = node[ATTR_KEY] as Record<string, string> | undefined;
  const attrStr = attrs
    ? Object.entries(attrs)
        .map(([k, v]) => ` ${k.slice(2)}="${String(v)}"`)
        .join("")
    : "";

  if (children.length === 0) {
    if (COLLECTION_TAGS.has(tag)) return `<${tag}${attrStr}/>`;
    return `<${tag}${attrStr}></${tag}>`;
  }

  const inner = children.map(serializeNode).join("");
  return `<${tag}${attrStr}>${inner}</${tag}>`;
}

const LIST_ATTR_ORDER: (keyof ListAttrs)[] = [
  "version",
  "minorVersion",
  "exportUser",
  "exportDateTime",
  "description",
];

export function serializeStandardChoiceXml(
  file: ParsedStandardChoiceFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  const attrs: ListAttrs = { ...file.listAttrs, ...overrides };
  const attrStr = LIST_ATTR_ORDER.map((k) => ` ${k}="${attrs[k]}"`).join("");
  const inner = file.records.map(serializeNode).join("");
  return `${XML_DECLARATION}\n<list${attrStr}>${inner}</list>`;
}

function formatAccelaDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(hours)}:${pad(
    d.getMinutes()
  )} ${ampm}`;
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

export function toStandardChoiceRow(node: PNode): StandardChoiceRow {
  const children = getChildren(node);
  const valueCount = getOrCreateValueNodesArray(node).filter(
    (c) => getTagName(c) === "standardChoiceValue"
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

export function getNodeRefId(node: PNode): string {
  return getAttr(node, "refId") ?? "";
}

/**
 * `refId` is NOT a reliable unique key within a file — see the doc comment
 * on refId in docs/schema-standard-choice.md, and confirmed in practice:
 * some real exports (e.g. sc4richard.xml) reuse "1@StandardChoiceModel" on
 * every standardChoice record. Row identity (grid selection, add/delete,
 * paste targeting) uses this synthetic per-node id instead, lazily assigned
 * and stable for the node's lifetime in memory.
 */
const nodeUids = new WeakMap<PNode, string>();
let nodeUidCounter = 0;

export function getNodeUid(node: PNode): string {
  let uid = nodeUids.get(node);
  if (!uid) {
    uid = `n${++nodeUidCounter}`;
    nodeUids.set(node, uid);
  }
  return uid;
}

export function findStandardChoiceByUid(records: PNode[], uid: string): PNode | undefined {
  return records.find((n) => getNodeUid(n) === uid);
}

export function findStandardChoiceValueByUid(
  standardChoiceNode: PNode,
  uid: string
): PNode | undefined {
  return getOrCreateValueNodesArray(standardChoiceNode).find((n) => getNodeUid(n) === uid);
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

function createAuditModelNode(): PNode {
  const children: PNode[] = [];
  setChildText(children, "auditDate", new Date().toISOString());
  setChildText(children, "auditID", "IMPORTEASE");
  setChildText(children, "auditStatus", "A");
  return { auditModel: children };
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

// Identity-based (not refId-based — refId isn't guaranteed unique, see getNodeUid).
export function deleteStandardChoice(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteStandardChoiceValue(standardChoiceNode: PNode, valueNode: PNode) {
  const arr = getOrCreateValueNodesArray(standardChoiceNode);
  const idx = arr.indexOf(valueNode);
  if (idx >= 0) arr.splice(idx, 1);
}
