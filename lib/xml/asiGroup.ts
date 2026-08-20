/**
 * ASIGroupModel.xml parse/serialize (see full-schema-reference.md).
 *
 * A fourth three-level category (see lib/xml/refLookupTable.ts,
 * lib/xml/guideSheet.ts, lib/xml/smartChoiceGroup.ts for the first
 * three): a group has a repeating list of ASI (Application Specific
 * Info) field definitions, and each field has its own repeating list of
 * dropdown option values. Conventional `xxxModels` containers at every
 * level, no wrapper oddity.
 *
 * The group also carries three untouched sibling arms this module never
 * reads or writes: asiSecurityModels (genuine security data — confirmed
 * populated in the full 685-record real file, though not in this
 * category's fixture, same treatment as VirProcess's processSecurityModels),
 * sharedDropDownModels, and templateLayoutConfigModels (the latter two
 * are auxiliary display/association features, not guessed at here since
 * building editable support for them isn't warranted by what the primary
 * asi/dropdown structure needs).
 *
 * Confirmed against a real 3-record sample (fixtures/asi-group/asig-real.xml:
 * "FP_OCC_MAST" — one field, zero dropdown values, one template layout
 * config; "LIC_IND" — one field, one dropdown value, one template layout
 * config; a second "LIC_IND"-coded record — four fields, zero dropdown
 * values, one template layout config; group codes are reused across
 * separate top-level records here, same non-unique-identity situation
 * seen elsewhere, confirmed via synthetic uid).
 *
 * No `refId` attribute anywhere in the real sample, at any of the three
 * levels. Cascades: a group's appSpecInfoGroupCode cascades into every
 * field's own r1CheckboxCode and every dropdown value's groupCode
 * (confirmed identical to the group code in the real sample);
 * r1CheckboxGroup and r1CheckboxType cascade into every field's own
 * r1CheckboxGroup/r1CheckboxType (duplicate fields on each field
 * definition).
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
  setChildText,
} from "./pnode";

export type { PNode, ListAttrs };
export type ParsedASIGroupFile = ParsedListFile;

const COLLECTION_TAGS = new Set([
  "asiModels",
  "asiDropdownModels",
  "asiSecurityModels",
  "sharedDropDownModels",
  "templateLayoutConfigModels",
  "refAppSpecInfoFieldI18NModels",
  "appSpecInfoFieldI18NModels",
  "templateLayoutConfigI18NModels",
]);

/** Cheap content sniff — real export files aren't necessarily named "ASIGroupModel.xml". */
export function isASIGroupXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<asiGroup[\s>]/.test(xmlText);
}

export function parseASIGroupXml(xmlText: string): ParsedASIGroupFile {
  return parseListXml(xmlText, "asiGroup");
}

export function serializeASIGroupXml(
  file: ParsedASIGroupFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedASIGroupXml(file: ParsedASIGroupFile): string {
  return serializeASIGroupXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations — three levels: group -> field -> dropdown value
// ---------------------------------------------------------------------------

export interface ASIGroupRow {
  uid: string;
  appSpecInfoGroupCode: string;
  r1CheckboxGroup: string;
  r1CheckboxType: string;
  serviceProviderCode: string;
  isASITSelected: string;
  isSecuritySelected: string;
  fieldCount: number;
}

function getOrCreateFieldNodesArray(groupNode: PNode): PNode[] {
  const children = getChildren(groupNode);
  let container = findChildByTag(children, "asiModels");
  if (!container) {
    container = { asiModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toASIGroupRow(node: PNode): ASIGroupRow {
  const children = getChildren(node);
  const fieldCount = getOrCreateFieldNodesArray(node).filter((c) =>
    Object.keys(c).includes("asiModel")
  ).length;
  return {
    uid: getNodeUid(node),
    appSpecInfoGroupCode: getChildText(children, "appSpecInfoGroupCode"),
    r1CheckboxGroup: getChildText(children, "r1CheckboxGroup"),
    r1CheckboxType: getChildText(children, "r1CheckboxType"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    isASITSelected: getChildText(children, "isASITSelected"),
    isSecuritySelected: getChildText(children, "isSecuritySelected"),
    fieldCount,
  };
}

export interface ASIFieldRow {
  uid: string;
  r1CheckboxCode: string;
  r1CheckboxDesc: string;
  r1CheckboxGroup: string;
  r1CheckboxType: string;
  r1CheckboxInd: string;
  r1DisplayOrder: string;
  r1GroupDisplayOrder: string;
  subGroupAlias: string;
  displayLength: string;
  maxLength: string;
  r1AttributeValueReqFlag: string;
  r1ReqFeeCalc: string;
  r1SearchableFlag: string;
  r1SearchableForAca: string;
  r1SupervisorEditOnlyFlag: string;
  vchDispFlag: string;
  locationQueryFlag: string;
  r1TableGroupName: string;
  servProvCode: string;
  valueCount: number;
}

function getOrCreateDropdownNodesArray(fieldNode: PNode): PNode[] {
  const children = getChildren(fieldNode);
  let container = findChildByTag(children, "asiDropdownModels");
  if (!container) {
    container = { asiDropdownModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function toASIFieldRow(node: PNode): ASIFieldRow {
  const children = getChildren(node);
  const valueCount = getOrCreateDropdownNodesArray(node).filter((c) =>
    Object.keys(c).includes("asiDropdownModel")
  ).length;
  return {
    uid: getNodeUid(node),
    r1CheckboxCode: getChildText(children, "r1CheckboxCode"),
    r1CheckboxDesc: getChildText(children, "r1CheckboxDesc"),
    r1CheckboxGroup: getChildText(children, "r1CheckboxGroup"),
    r1CheckboxType: getChildText(children, "r1CheckboxType"),
    r1CheckboxInd: getChildText(children, "r1CheckboxInd"),
    r1DisplayOrder: getChildText(children, "r1DisplayOrder"),
    r1GroupDisplayOrder: getChildText(children, "r1GroupDisplayOrder"),
    subGroupAlias: getChildText(children, "subGroupAlias"),
    displayLength: getChildText(children, "displayLength"),
    maxLength: getChildText(children, "maxLength"),
    r1AttributeValueReqFlag: getChildText(children, "r1AttributeValueReqFlag"),
    r1ReqFeeCalc: getChildText(children, "r1ReqFeeCalc"),
    r1SearchableFlag: getChildText(children, "r1SearchableFlag"),
    r1SearchableForAca: getChildText(children, "r1SearchableForAca"),
    r1SupervisorEditOnlyFlag: getChildText(children, "r1SupervisorEditOnlyFlag"),
    vchDispFlag: getChildText(children, "vchDispFlag"),
    locationQueryFlag: getChildText(children, "locationQueryFlag"),
    r1TableGroupName: getChildText(children, "r1TableGroupName"),
    servProvCode: getChildText(children, "servProvCode"),
    valueCount,
  };
}

export interface ASIDropdownValueRow {
  uid: string;
  fieldName: string;
  value: string;
  subGroupCode: string;
  type: string;
  groupCode: string;
  serviceProviderCode: string;
}

export function toASIDropdownValueRow(node: PNode): ASIDropdownValueRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    fieldName: getChildText(children, "fieldName"),
    value: getChildText(children, "value"),
    subGroupCode: getChildText(children, "subGroupCode"),
    type: getChildText(children, "type"),
    groupCode: getChildText(children, "groupCode"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export function inferCommonAgencyId(rows: ASIGroupRow[]): string {
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

/** No refId anywhere in this category's real sample — no nextRefIdNumber export needed. */

export function findASIGroupByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findASIFieldByUid(groupNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateFieldNodesArray(groupNode), uid);
}

export function findASIDropdownValueByUid(fieldNode: PNode, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateDropdownNodesArray(fieldNode), uid);
}

export function getASIFieldNodes(groupNode: PNode): PNode[] {
  return getOrCreateFieldNodesArray(groupNode);
}

export function getASIDropdownValueNodes(fieldNode: PNode): PNode[] {
  return getOrCreateDropdownNodesArray(fieldNode);
}

export const ASI_GROUP_EDITABLE_FIELDS = [
  "appSpecInfoGroupCode",
  "r1CheckboxGroup",
  "r1CheckboxType",
  "serviceProviderCode",
  "isASITSelected",
  "isSecuritySelected",
] as const;

export const ASI_FIELD_EDITABLE_FIELDS = [
  "r1CheckboxDesc",
  "r1CheckboxCode",
  "r1CheckboxGroup",
  "r1CheckboxType",
  "r1CheckboxInd",
  "r1DisplayOrder",
  "r1GroupDisplayOrder",
  "subGroupAlias",
  "displayLength",
  "maxLength",
  "r1AttributeValueReqFlag",
  "r1ReqFeeCalc",
  "r1SearchableFlag",
  "r1SearchableForAca",
  "r1SupervisorEditOnlyFlag",
  "vchDispFlag",
  "locationQueryFlag",
  "r1TableGroupName",
  "servProvCode",
] as const;

export const ASI_DROPDOWN_VALUE_EDITABLE_FIELDS = [
  "value",
  "fieldName",
  "subGroupCode",
  "type",
  "groupCode",
  "serviceProviderCode",
] as const;

/** Editing the group's appSpecInfoGroupCode cascades into every field's own
 * r1CheckboxCode and every dropdown value's groupCode; r1CheckboxGroup and
 * r1CheckboxType cascade into every field's own copies of those fields. */
export function setASIGroupField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "appSpecInfoGroupCode") {
    for (const fieldNode of getOrCreateFieldNodesArray(node)) {
      setChildText(getChildren(fieldNode), "r1CheckboxCode", value);
      for (const ddNode of getOrCreateDropdownNodesArray(fieldNode)) {
        setChildText(getChildren(ddNode), "groupCode", value);
      }
    }
  } else if (field === "r1CheckboxGroup" || field === "r1CheckboxType") {
    for (const fieldNode of getOrCreateFieldNodesArray(node)) {
      setChildText(getChildren(fieldNode), field, value);
    }
  }
}

export function setASIFieldField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function setASIDropdownValueField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createASIGroupNode(serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "appSpecInfoGroupCode", "");
  setChildText(children, "r1CheckboxGroup", "");
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  children.push({ asiModels: [] });
  children.push({ asiSecurityModels: [] });
  setChildText(children, "isASITSelected", "Y");
  setChildText(children, "isSecuritySelected", "Y");
  setChildText(children, "r1CheckboxType", "");
  children.push({ sharedDropDownModels: [] });
  children.push({ templateLayoutConfigModels: [] });
  return { asiGroup: children };
}

export function createASIFieldNode(
  r1CheckboxCode: string,
  r1CheckboxGroup: string,
  r1CheckboxType: string,
  servProvCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "r1CheckboxCode", r1CheckboxCode);
  setChildText(children, "r1CheckboxDesc", "");
  setChildText(children, "r1CheckboxGroup", r1CheckboxGroup);
  setChildText(children, "r1CheckboxType", r1CheckboxType);
  setChildText(children, "servProvCode", servProvCode);
  children.push({ asiDropdownModels: [] });
  setChildText(children, "displayLength", "0");
  setChildText(children, "locationQueryFlag", "N");
  setChildText(children, "maxLength", "0");
  setChildText(children, "r1AttributeValueReqFlag", "N");
  setChildText(children, "r1CheckboxInd", "");
  setChildText(children, "r1DisplayOrder", "");
  setChildText(children, "r1GroupDisplayOrder", "");
  setChildText(children, "r1ReqFeeCalc", "N");
  setChildText(children, "r1SearchableFlag", "N");
  setChildText(children, "r1SearchableForAca", "N");
  setChildText(children, "r1SupervisorEditOnlyFlag", "N");
  children.push(createAuditModelNode());
  children.push({ refAppSpecInfoFieldI18NModels: [] });
  setChildText(children, "subGroupAlias", "");
  setChildText(children, "vchDispFlag", "N");
  return { asiModel: children };
}

export function createASIDropdownValueNode(
  fieldName: string,
  groupCode: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "fieldName", fieldName);
  setChildText(children, "groupCode", groupCode);
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "subGroupCode", "");
  setChildText(children, "type", "");
  setChildText(children, "value", "");
  children.push({ appSpecInfoFieldI18NModels: [] });
  children.push(createAuditModelNode());
  return { asiDropdownModel: children };
}

export function deleteASIGroup(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteASIField(groupNode: PNode, fieldNode: PNode) {
  const arr = getOrCreateFieldNodesArray(groupNode);
  const idx = arr.indexOf(fieldNode);
  if (idx >= 0) arr.splice(idx, 1);
}

export function deleteASIDropdownValue(fieldNode: PNode, valueNode: PNode) {
  const arr = getOrCreateDropdownNodesArray(fieldNode);
  const idx = arr.indexOf(valueNode);
  if (idx >= 0) arr.splice(idx, 1);
}
