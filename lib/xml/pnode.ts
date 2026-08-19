import { XMLParser } from "fast-xml-parser";

/**
 * Generic order-preserving XML tree helpers shared by every `<list>`-rooted
 * Configuration Manager model (StandardChoiceModel, SharedDropDownListModel,
 * and future categories — see docs/schema-standard-choice.md for the
 * fidelity strategy this all serves). Nothing in this file knows about any
 * specific model's field names; that lives in each model's own module
 * (lib/xml/standardChoice.ts, lib/xml/sharedDropDownList.ts, ...).
 */

export type PNode = Record<string, any>;

export const ATTR_KEY = ":@";
export const TEXT_KEY = "#text";

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export interface ListAttrs {
  version: string;
  minorVersion: string;
  exportUser: string;
  exportDateTime: string;
  description: string;
}

export interface ParsedListFile {
  listAttrs: ListAttrs;
  records: PNode[];
}

// ---------------------------------------------------------------------------
// Low-level PNode helpers
// ---------------------------------------------------------------------------

export function getTagName(node: PNode): string | null {
  const keys = Object.keys(node).filter((k) => k !== ATTR_KEY && k !== TEXT_KEY);
  return keys[0] ?? null;
}

export function getChildren(node: PNode): PNode[] {
  const tag = getTagName(node);
  if (!tag) return [];
  if (!Array.isArray(node[tag])) node[tag] = [];
  return node[tag] as PNode[];
}

export function getAttr(node: PNode, name: string): string | undefined {
  return node[ATTR_KEY]?.[`@_${name}`];
}

export function setAttr(node: PNode, name: string, value: string) {
  if (!node[ATTR_KEY]) node[ATTR_KEY] = {};
  node[ATTR_KEY][`@_${name}`] = value;
}

export function findChildByTag(children: PNode[], tag: string): PNode | undefined {
  return children.find((c) => getTagName(c) === tag);
}

export function getText(node: PNode): string {
  const tag = getTagName(node);
  if (!tag) return "";
  const kids = node[tag];
  if (!Array.isArray(kids) || kids.length === 0) return "";
  const textNode = kids.find((k: PNode) => TEXT_KEY in k);
  return textNode ? decodeText(String(textNode[TEXT_KEY])) : "";
}

export function getChildText(children: PNode[], tag: string): string {
  const child = findChildByTag(children, tag);
  return child ? getText(child) : "";
}

/**
 * `value` is the logical (decoded) string as seen in the grid — it gets
 * entity-encoded here before being stored. Untouched fields never pass
 * through this function, so their stored text stays exactly as the parser
 * produced it (see the entity-handling note below).
 */
export function setChildText(children: PNode[], tag: string, value: string) {
  const child = findChildByTag(children, tag);
  const nextChildren = value === "" ? [] : [{ [TEXT_KEY]: escapeText(value) }];
  if (child) {
    child[tag] = nextChildren;
  } else {
    children.push({ [tag]: nextChildren });
  }
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
export function nextRefIdNumber(records: PNode[], suffix: string): number {
  const nums: number[] = [];
  for (const r of records) collectRefIdNumbers(r, suffix, nums);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

// ---------------------------------------------------------------------------
// Entity encode/decode — only ever applied at the edit boundary (setChildText
// encodes, getText decodes). Parsed-but-untouched text is never round-tripped
// through either function, so it keeps its exact original encoding; running
// it through escapeText on every serialize double-escapes already-encoded
// text like "&amp;" -> "&amp;amp;".
// ---------------------------------------------------------------------------

export function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function decodeText(s: string): string {
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

export const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  trimValues: false,
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
};

/** Parses a `<list ...>` rooted file, keeping only records at the given top-level tag. */
export function parseListXml(xmlText: string, recordTag: string): ParsedListFile {
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
    (n: PNode) => getTagName(n) === recordTag
  );

  return { listAttrs, records };
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/** Tags that self-close (`<tag/>`) when empty, rather than `<tag></tag>`. */
export function serializeNode(node: PNode, collectionTags: Set<string>): string {
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
    if (collectionTags.has(tag)) return `<${tag}${attrStr}/>`;
    return `<${tag}${attrStr}></${tag}>`;
  }

  const inner = children.map((c) => serializeNode(c, collectionTags)).join("");
  return `<${tag}${attrStr}>${inner}</${tag}>`;
}

const LIST_ATTR_ORDER: (keyof ListAttrs)[] = [
  "version",
  "minorVersion",
  "exportUser",
  "exportDateTime",
  "description",
];

export function serializeListXml(
  file: ParsedListFile,
  collectionTags: Set<string>,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  const attrs: ListAttrs = { ...file.listAttrs, ...overrides };
  const attrStr = LIST_ATTR_ORDER.map((k) => ` ${k}="${attrs[k]}"`).join("");
  const inner = file.records.map((r) => serializeNode(r, collectionTags)).join("");
  return `${XML_DECLARATION}\n<list${attrStr}>${inner}</list>`;
}

export function formatAccelaDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(hours)}:${pad(
    d.getMinutes()
  )} ${ampm}`;
}

export function createAuditModelNode(): PNode {
  const children: PNode[] = [];
  setChildText(children, "auditDate", new Date().toISOString());
  setChildText(children, "auditID", "IMPORTEASE");
  setChildText(children, "auditStatus", "A");
  return { auditModel: children };
}

// ---------------------------------------------------------------------------
// Row identity
// ---------------------------------------------------------------------------

/**
 * `refId` is NOT a reliable unique key within a file — confirmed in
 * practice (e.g. sc4richard.xml reuses "1@StandardChoiceModel" on every
 * standardChoice record). Row identity (grid selection, add/delete, paste
 * targeting) uses this synthetic per-node id instead, lazily assigned and
 * stable for the node's lifetime in memory.
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

export function getNodeRefId(node: PNode): string {
  return getAttr(node, "refId") ?? "";
}

export function findNodeByUid(nodes: PNode[], uid: string): PNode | undefined {
  return nodes.find((n) => getNodeUid(n) === uid);
}
