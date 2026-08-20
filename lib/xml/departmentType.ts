/**
 * DepartMentTypeModel.xml parse/serialize (see full-schema-reference.md).
 *
 * A flat category (reuses FlatGrid, same as Reference Mask/Email
 * Message/Cap Type) — one row per department type, identified by a
 * seven-part composite key (serviceProviderCode/agencyCode/bureauCode/
 * divisionCode/groupCode/officeCode/sectionCode). Each row embeds SIX
 * singleton reference sub-objects (bureauModel, divisionModel,
 * groupModel, officeModel, organizationAgencyModel, sectionModel) that
 * each duplicate a piece of the composite key plus a human-readable
 * description — organizationAgencyModel in particular is the exact same
 * shape as the standalone Organization/Agency category already built.
 * None of the six are read or written by this module beyond the
 * identity-field cascade described below; their description/audit
 * fields ride along untouched.
 *
 * Confirmed against a real 2-record sample
 * (fixtures/department-type/dt-real.xml: the two smallest real records
 * in the 60-record source file — "Accela" (all-NA placeholder) and "PW
 * Bonds"). No `refId` at the top level; organizationAgencyModel alone
 * carries one ("1@OrganizationAgencyModel", reused across both records
 * — same non-unique-refId situation as the standalone category).
 *
 * `departMentTypeKey` is a derived slash-joined display string (e.g.
 * "CLARKCO/PW/BONDS/NA/NA/NA/NA") — like Cap Type's recordTypeString,
 * it is intentionally left stale on an identity-field edit rather than
 * regenerated, since the exact join semantics aren't confident enough
 * to reproduce on write.
 *
 * Cascades: editing agencyCode/bureauCode/divisionCode/groupCode/
 * officeCode/sectionCode/serviceProviderCode writes into every sibling
 * sub-object's own matching field (confirmed present by field name in
 * the real sample — not guessed).
 */
import {
  type ListAttrs,
  type ParsedListFile,
  type PNode,
  findChildByTag,
  formatAccelaDateTime,
  getChildren,
  getChildText,
  getNodeUid,
  parseListXml,
  serializeListXml,
  setChildText,
} from "./pnode";

export type { PNode, ListAttrs };
export type ParsedDepartmentTypeFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "bureauI18Ns",
  "divisnI18Ns",
  "dpttyI18Ns",
  "wgroupI18Ns",
  "officeI18Ns",
  "agencyI18NModels",
  "wsectinI18Ns",
]);

/** Cheap content sniff — real export files aren't necessarily named "DepartMentTypeModel.xml". */
export function isDepartmentTypeXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<departMentType[\s>]/.test(xmlText);
}

export function parseDepartmentTypeXml(xmlText: string): ParsedDepartmentTypeFile {
  return parseListXml(xmlText, "departMentType");
}

export function serializeDepartmentTypeXml(
  file: ParsedDepartmentTypeFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedDepartmentTypeXml(file: ParsedDepartmentTypeFile): string {
  return serializeDepartmentTypeXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projection + mutation — flat, one row per department type
// ---------------------------------------------------------------------------

export interface DepartmentTypeRow {
  [field: string]: string;
  uid: string;
  refId: string;
  departMentTypeName: string;
  agencyCode: string;
  bureauCode: string;
  divisionCode: string;
  groupCode: string;
  officeCode: string;
  sectionCode: string;
  subgroupCode: string;
  serviceProviderCode: string;
  subGroupDescription: string;
  departMentTypeKey: string;
}

export function toDepartmentTypeRow(node: PNode): DepartmentTypeRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: "",
    departMentTypeName: getChildText(children, "departMentTypeName"),
    agencyCode: getChildText(children, "agencyCode"),
    bureauCode: getChildText(children, "bureauCode"),
    divisionCode: getChildText(children, "divisionCode"),
    groupCode: getChildText(children, "groupCode"),
    officeCode: getChildText(children, "officeCode"),
    sectionCode: getChildText(children, "sectionCode"),
    subgroupCode: getChildText(children, "subgroupCode"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    subGroupDescription: getChildText(children, "subGroupDescription"),
    departMentTypeKey: getChildText(children, "departMentTypeKey"),
  };
}

export function inferCommonAgencyId(rows: DepartmentTypeRow[]): string {
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

export function nextRefIdNumber(_records: PNode[]): number {
  return 1;
}

export function findDepartmentTypeByUid(records: PNode[], uid: string): PNode | undefined {
  return records.find((n) => getNodeUid(n) === uid);
}

const IDENTITY_MIRROR_FIELDS = new Set([
  "agencyCode",
  "bureauCode",
  "divisionCode",
  "groupCode",
  "officeCode",
  "sectionCode",
  "serviceProviderCode",
]);

const SIBLING_CONTAINERS = [
  "bureauModel",
  "divisionModel",
  "groupModel",
  "officeModel",
  "organizationAgencyModel",
  "sectionModel",
];

export function setDepartmentTypeField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (IDENTITY_MIRROR_FIELDS.has(field)) {
    for (const containerTag of SIBLING_CONTAINERS) {
      const container = findChildByTag(children, containerTag);
      if (!container) continue;
      const containerChildren = getChildren(container);
      // Only write the field if this sibling actually carries a copy of it
      // (e.g. bureauModel has bureauCode but not sectionCode).
      if (findChildByTag(containerChildren, field)) {
        setChildText(containerChildren, field, value);
      }
    }
  }
}

export function createDepartmentTypeNode(_refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "agencyCode", "");
  setChildText(children, "bureauCode", "");
  setChildText(children, "divisionCode", "");
  setChildText(children, "groupCode", "");
  setChildText(children, "officeCode", "");
  setChildText(children, "sectionCode", "");
  setChildText(children, "subgroupCode", "");
  setChildText(children, "departMentTypeName", "");
  setChildText(children, "subGroupDescription", "");
  return { departMentType: children };
}

export function deleteDepartmentType(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}
