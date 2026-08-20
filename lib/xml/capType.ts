/**
 * CapTypeModel.xml parse/serialize (see full-schema-reference.md).
 *
 * The largest and structurally widest category in the app (243 unique
 * tags across the real file; individual real records range from 6KB to
 * 535KB). Architecturally unlike every other category built so far: a
 * cap type is not a tree of repeating child collections, it's a *wide
 * flat record* — one row per record type (group/type/subType/category)
 * — with roughly a dozen real scalar business-config fields plus ~15
 * embedded **singleton** (non-repeating) sub-objects: capTypeACAModel,
 * capTypeAssetModel, capTypeGISModel, capTypeMaskModel,
 * capTypeRelationModel, capTypeSecurityModel, captypeStandardComment,
 * citizenAccessModel (itself wrapping a further embedded pageFlowModel),
 * pageStatusModels, and several always-empty-in-practice arrays
 * (capTypeI18NModels, capTypeRelationList, postSubmission4ACAModels,
 * refAuditFrequencyModels, referenceLicenseVerificationModels,
 * refLookupTables, stdConditionCapTypes).
 *
 * This module treats CapType as a flat grid (reuses FlatGrid, same as
 * Reference Mask/Email Message/Time Types) over just the confirmed real
 * top-level scalar fields, and never reads or writes any of those ~15
 * embedded sub-objects' own contents:
 * - capTypeSecurityModel is genuine security/permission data (same
 *   treatment as every other category's untouched xxxSecurityModel arm).
 * - pageStatusModels is Accela's own admin-UI form-config bookkeeping
 *   (which sub-panels are visible/skippable), not user record-type data.
 * - citizenAccessModel's nested pageFlowModel is an opaque embedded form
 *   layout with no confirmed real example small enough to safely derive
 *   a shape from (real records exercising it run into hundreds of KB).
 *
 * One real limitation worth being explicit about: capTypeRelationModel,
 * capTypeSecurityModel, captypeStandardComment, and citizenAccessModel
 * each carry their own duplicate copies of group/type/subType/category/
 * serviceProviderCode (confirmed identical to the top-level values in
 * every real sample inspected) — editing those five identity fields
 * cascades into each sibling's own matching field, since the field names
 * are directly confirmed, not guessed. captypeStandardComment's
 * entityData4CapType (a derived "Group▪Type▪SubType▪Category" display
 * string, e.g. "Buildingu266BCommercialu266BElectricu266BTemporary Well")
 * and the top-level recordTypeString are NOT regenerated on cascade —
 * the exact encoding isn't confident enough to reproduce on write, so
 * these two fields are left stale after an identity edit. This is a
 * known, documented gap rather than a silent one.
 *
 * Confirmed against a real 2-record sample (fixtures/cap-type/ct-real.xml:
 * the file's single smallest real record, "Enforcement/Incident/NA/NA"
 * — minimal field population; and "Building/Commercial/Electric/Temporary
 * Well" — a mid-sized record exercising the fuller scalar field set,
 * including addrGroup, appStatusGroupCode, defaultCapStatus, docCode,
 * expirationCode, specInfoCode, udCode3).
 */
import {
  type ListAttrs,
  type ParsedListFile,
  type PNode,
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
export type ParsedCapTypeFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "capTypeI18NModels",
  "capTypeRelationList",
  "capTypeRelations",
  "capTypeSecurityPolicyModels",
  "capTypeSecurityStatusPolicyModels",
  "xcommentGroupEntitys",
  "refXEntityPermissionModels",
  "refLookupTables",
  "pageStatusModels",
  "postSubmission4ACAModels",
  "refAuditFrequencyModels",
  "referenceLicenseVerificationModels",
  "stdConditionCapTypes",
]);

/** Cheap content sniff — real export files aren't necessarily named "CapTypeModel.xml". */
export function isCapTypeXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<capType[\s>]/.test(xmlText);
}

export function parseCapTypeXml(xmlText: string): ParsedCapTypeFile {
  return parseListXml(xmlText, "capType");
}

export function serializeCapTypeXml(
  file: ParsedCapTypeFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedCapTypeXml(file: ParsedCapTypeFile): string {
  return serializeCapTypeXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projection + mutation — flat, one row per record type
// ---------------------------------------------------------------------------

export interface CapTypeRow {
  uid: string;
  refId: string;
  group: string;
  type: string;
  subType: string;
  category: string;
  serviceProviderCode: string;
  alias: string;
  asChildOnly: string;
  addrGroup: string;
  appStatusGroupCode: string;
  defaultCapStatus: string;
  docCode: string;
  expirationCode: string;
  feeScheduleName: string;
  inspectionGroupCode: string;
  isRenewalOverride: string;
  isSearchable: string;
  moduleName: string;
  processCode: string;
  resId: string;
  smartChoiceCode: string;
  specInfoCode: string;
  udCode3: string;
  isCheckedLiscenedVerification: string;
  isCloneOptionSelected: string;
}

export function toCapTypeRow(node: PNode): CapTypeRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    group: getChildText(children, "group"),
    type: getChildText(children, "type"),
    subType: getChildText(children, "subType"),
    category: getChildText(children, "category"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    alias: getChildText(children, "alias"),
    asChildOnly: getChildText(children, "asChildOnly"),
    addrGroup: getChildText(children, "addrGroup"),
    appStatusGroupCode: getChildText(children, "appStatusGroupCode"),
    defaultCapStatus: getChildText(children, "defaultCapStatus"),
    docCode: getChildText(children, "docCode"),
    expirationCode: getChildText(children, "expirationCode"),
    feeScheduleName: getChildText(children, "feeScheduleName"),
    inspectionGroupCode: getChildText(children, "inspectionGroupCode"),
    isRenewalOverride: getChildText(children, "isRenewalOverride"),
    isSearchable: getChildText(children, "isSearchable"),
    moduleName: getChildText(children, "moduleName"),
    processCode: getChildText(children, "processCode"),
    resId: getChildText(children, "resId"),
    smartChoiceCode: getChildText(children, "smartChoiceCode"),
    specInfoCode: getChildText(children, "specInfoCode"),
    udCode3: getChildText(children, "udCode3"),
    isCheckedLiscenedVerification: getChildText(children, "isCheckedLiscenedVerification"),
    isCloneOptionSelected: getChildText(children, "isCloneOptionSelected"),
  };
}

export function inferCommonAgencyId(rows: CapTypeRow[]): string {
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
  return nextRefIdNumberGeneric(records, "CapTypeModel");
}

export function findCapTypeByUid(records: PNode[], uid: string): PNode | undefined {
  return records.find((n) => getNodeUid(n) === uid);
}

export const CAP_TYPE_EDITABLE_FIELDS = [
  "group",
  "type",
  "subType",
  "category",
  "serviceProviderCode",
  "alias",
  "asChildOnly",
  "addrGroup",
  "appStatusGroupCode",
  "defaultCapStatus",
  "docCode",
  "expirationCode",
  "feeScheduleName",
  "inspectionGroupCode",
  "isRenewalOverride",
  "isSearchable",
  "moduleName",
  "processCode",
  "resId",
  "smartChoiceCode",
  "specInfoCode",
  "udCode3",
  "isCheckedLiscenedVerification",
  "isCloneOptionSelected",
] as const;

const IDENTITY_FIELDS = new Set(["group", "type", "subType", "category", "serviceProviderCode"]);

/** These four singleton sibling objects carry their own confirmed-identical
 * copies of group/type/subType/category/serviceProviderCode — see the
 * module doc comment for what is (and isn't) kept in sync on identity edits. */
const IDENTITY_MIRROR_CONTAINERS = [
  "capTypeRelationModel",
  "capTypeSecurityModel",
  "captypeStandardComment",
  "citizenAccessModel",
];

export function setCapTypeField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (IDENTITY_FIELDS.has(field)) {
    for (const containerTag of IDENTITY_MIRROR_CONTAINERS) {
      const container = findChildByTag(children, containerTag);
      if (container) setChildText(getChildren(container), field, value);
    }
  }
}

export function createCapTypeNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "group", "");
  setChildText(children, "type", "");
  setChildText(children, "subType", "");
  setChildText(children, "category", "");
  setChildText(children, "alias", "");
  setChildText(children, "asChildOnly", "N");
  const node: PNode = { capType: children };
  setAttr(node, "refId", `${refIdNum}@CapTypeModel`);
  return node;
}

export function deleteCapType(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}
