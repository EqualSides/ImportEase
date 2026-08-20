/**
 * EmailMessageModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Flat category — one record per notification template, no repeating child
 * list. Confirmed against a real 3-record sample (fixtures/email-message/
 * em-real.xml) picked to include a record whose contentsBody carries CRLF
 * (`&#xD;`) entities, since that's exactly the kind of untouched-text byte
 * fidelity this app's parser/serializer strategy depends on. No `refId`
 * attribute on this category in practice.
 */
import {
  type ListAttrs,
  type ParsedListFile,
  type PNode,
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
export type ParsedEmailMessageFile = ParsedListFile;

const COLLECTION_TAGS = new Set(["refEmailMessageI18NModels"]);

/** Cheap content sniff — real export files aren't necessarily named "EmailMessageModel.xml". */
export function isEmailMessageXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<snoteContents[\s>]/.test(xmlText);
}

export function parseEmailMessageXml(xmlText: string): ParsedEmailMessageFile {
  return parseListXml(xmlText, "snoteContents");
}

export function serializeEmailMessageXml(
  file: ParsedEmailMessageFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedEmailMessageXml(file: ParsedEmailMessageFile): string {
  return serializeEmailMessageXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// Index signature so this satisfies components/FlatGrid.tsx's FlatGridRow
// shape without a cast — every field here is a plain string.
export interface EmailMessageRow {
  [field: string]: string;
  uid: string;
  refId: string;
  contentsCode: string;
  contentsSubject: string;
  contentsType: string;
  contentsBody: string;
  serviceProviderCode: string;
}

export function toEmailMessageRow(node: PNode): EmailMessageRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    contentsCode: getChildText(children, "contentsCode"),
    contentsSubject: getChildText(children, "contentsSubject"),
    contentsType: getChildText(children, "contentsType"),
    contentsBody: getChildText(children, "contentsBody"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: EmailMessageRow[]): string {
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
  return nextRefIdNumberGeneric(records, "EmailMessageModel");
}

export function findEmailMessageByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export const EMAIL_MESSAGE_EDITABLE_FIELDS = [
  "contentsCode",
  "contentsSubject",
  "contentsType",
  "contentsBody",
  "serviceProviderCode",
] as const;

export function setEmailMessageField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createEmailMessageNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "contentsCode", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "contentsBody", "");
  setChildText(children, "contentsSubject", "");
  setChildText(children, "contentsType", "");
  children.push({ refEmailMessageI18NModels: [] });
  const node: PNode = { snoteContents: children };
  setAttr(node, "refId", `${refIdNum}@EmailMessageModel`);
  return node;
}

export function deleteEmailMessage(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}
