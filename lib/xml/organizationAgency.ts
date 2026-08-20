/**
 * OrganizationAgencyModel.xml parse/serialize (see full-schema-reference.md).
 *
 * Flat category — no repeating child list, just one record per agency/
 * department code. Confirmed against a real 12-record sample
 * (fixtures/org-agency/oa-real.xml): every record reuses the same
 * `refId="1@OrganizationAgencyModel"` attribute, exactly the non-unique-refId
 * situation docs/schema-standard-choice.md warned about for Standard Choice
 * — row identity here uses the same synthetic-uid strategy (getNodeUid in
 * lib/xml/pnode.ts), not refId, for the same reason.
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
export type ParsedOrganizationAgencyFile = ParsedListFile;

const COLLECTION_TAGS = new Set(["agencyI18NModels"]);

/** Cheap content sniff — real export files aren't necessarily named "OrganizationAgencyModel.xml". */
export function isOrganizationAgencyXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<organizationagency[\s>]/.test(xmlText);
}

export function parseOrganizationAgencyXml(xmlText: string): ParsedOrganizationAgencyFile {
  return parseListXml(xmlText, "organizationagency");
}

export function serializeOrganizationAgencyXml(
  file: ParsedOrganizationAgencyFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedOrganizationAgencyXml(file: ParsedOrganizationAgencyFile): string {
  return serializeOrganizationAgencyXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// Index signature (in addition to the named fields) so this satisfies
// components/FlatGrid.tsx's FlatGridRow shape without a cast — every field
// here is a plain string, so the two are compatible.
export interface OrganizationAgencyRow {
  [field: string]: string;
  uid: string;
  refId: string;
  agencyCode: string;
  agencyName: string;
  serviceProviderCode: string;
}

export function toOrganizationAgencyRow(node: PNode): OrganizationAgencyRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    agencyCode: getChildText(children, "agencyCode"),
    agencyName: getChildText(children, "agencyName"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: OrganizationAgencyRow[]): string {
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
  return nextRefIdNumberGeneric(records, "OrganizationAgencyModel");
}

export function findOrganizationAgencyByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export const ORGANIZATION_AGENCY_EDITABLE_FIELDS = [
  "agencyCode",
  "agencyName",
  "serviceProviderCode",
] as const;

export function setOrganizationAgencyField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createOrganizationAgencyNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "agencyCode", "");
  children.push({ agencyI18NModels: [] });
  setChildText(children, "agencyName", "");
  children.push(createAuditModelNode());
  const node: PNode = { organizationagency: children };
  setAttr(node, "refId", `${refIdNum}@OrganizationAgencyModel`);
  return node;
}

// Identity-based (not refId-based — every record in real exports reuses the
// same refId, see the module doc comment).
export function deleteOrganizationAgency(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}
