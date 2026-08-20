/**
 * RefExpressionModel.xml parse/serialize (see full-schema-reference.md).
 *
 * "Expression Builder" — the fourth heterogeneous-arm category (see
 * lib/xml/refFeeSchedule.ts for the first, lib/xml/virProcess.ts for the
 * third): one expression has THREE structurally-different editable arms —
 * calculations (expressCalculations/expressCalculation), conditions
 * (expressCriterias/expressCriteria), and referenced fields
 * (expressFields/expressField) — plus two always-empty sibling arms in
 * the real sample, expressPortlets and xexpressEMSEScripts, left
 * untouched since there's no real example to derive an editable shape
 * from (same treatment as RefFeeSchedule's always-empty
 * refFeeItemgroups). pageStatusModels is Accela's own admin-UI
 * bookkeeping (same shape/treatment as Cap Type's pageStatusModels), not
 * security data, and is also left untouched.
 *
 * Confirmed against a real 2-record sample
 * (fixtures/expression-builder/expr-real.xml: "LIC_MGT_A_BUSICONT_PHONE",
 * one calculation + four fields, zero criteria — the criteria arm
 * self-closes as `<expressCriterias/>` when empty; "LIC_ACCR_A_MobileFoodUnits",
 * two calculations + two criteria + eight fields — this is the only
 * record in the real 141-record source file with the criteria arm
 * populated at all, a known coverage limit disclosed here rather than
 * silently worked around). The second record also covers `executeOrder`
 * and `expressionBehavior`, both absent from the first record and
 * confirmed optional.
 *
 * scriptText is a large free-text embedded script (not a nested object)
 * and is treated as an ordinary editable text field, same as any other
 * comment/description-shaped field elsewhere in this app.
 *
 * No `refId` anywhere in the real sample, at the expression level or any
 * arm. Editing the expression's expressionName cascades into every
 * calculation's/criteria's/field's own expressionName (confirmed
 * identical across all three arms in the real sample); serviceProviderCode
 * cascades the same way into all three arms' own serviceProviderCode.
 */
import {
  type ListAttrs,
  type ParsedListFile,
  type PNode,
  createAuditModelNode,
  findChildByTag,
  findNodeByUid,
  formatAccelaDateTime,
  getChildren,
  getChildText,
  getNodeUid,
  parseListXml,
  serializeListXml,
  setChildText,
} from "./pnode";

export type { PNode, ListAttrs };
export type ParsedExpressionBuilderFile = ParsedListFile;

export type ArmKey = "calc" | "criteria" | "field";

const ARM_CONTAINER_TAG: Record<ArmKey, string> = {
  calc: "expressCalculations",
  criteria: "expressCriterias",
  field: "expressFields",
};

const ARM_ITEM_TAG: Record<ArmKey, string> = {
  calc: "expressCalculation",
  criteria: "expressCriteria",
  field: "expressField",
};

const COLLECTION_TAGS = new Set([
  "expressCalculations",
  "expressCriterias",
  "expressFields",
  "expressPortlets",
  "pageStatusModels",
  "xexpressEMSEScripts",
  "expressionI18Ns",
  "expressionCriteriaI18Ns",
]);

/** Cheap content sniff — real export files aren't necessarily named "RefExpressionModel.xml". */
export function isExpressionBuilderXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<expression[\s>]/.test(xmlText);
}

export function parseExpressionBuilderXml(xmlText: string): ParsedExpressionBuilderFile {
  return parseListXml(xmlText, "expression");
}

export function serializeExpressionBuilderXml(
  file: ParsedExpressionBuilderFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedExpressionBuilderXml(file: ParsedExpressionBuilderFile): string {
  return serializeExpressionBuilderXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations — one expression, three structurally-distinct arms
// ---------------------------------------------------------------------------

export interface ExpressionRow {
  uid: string;
  expressionName: string;
  serviceProviderCode: string;
  checkboxCode: string;
  entityKey1: string;
  entityKey2: string;
  entityKey3: string;
  executeIn: string;
  executeOrder: string;
  expressionBehavior: string;
  expressionMode: string;
  expressionVersion: string;
  scriptText: string;
  viewID: string;
  calcCount: number;
  criteriaCount: number;
  fieldCount: number;
}

function getOrCreateArmNodesArray(exprNode: PNode, arm: ArmKey): PNode[] {
  const children = getChildren(exprNode);
  const containerTag = ARM_CONTAINER_TAG[arm];
  let container = findChildByTag(children, containerTag);
  if (!container) {
    container = { [containerTag]: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function getArmNodes(exprNode: PNode, arm: ArmKey): PNode[] {
  return getOrCreateArmNodesArray(exprNode, arm);
}

function armCount(exprNode: PNode, arm: ArmKey): number {
  const itemTag = ARM_ITEM_TAG[arm];
  return getOrCreateArmNodesArray(exprNode, arm).filter((c) => Object.keys(c).includes(itemTag)).length;
}

export function toExpressionRow(node: PNode): ExpressionRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    expressionName: getChildText(children, "expressionName"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    checkboxCode: getChildText(children, "checkboxCode"),
    entityKey1: getChildText(children, "entityKey1"),
    entityKey2: getChildText(children, "entityKey2"),
    entityKey3: getChildText(children, "entityKey3"),
    executeIn: getChildText(children, "executeIn"),
    executeOrder: getChildText(children, "executeOrder"),
    expressionBehavior: getChildText(children, "expressionBehavior"),
    expressionMode: getChildText(children, "expressionMode"),
    expressionVersion: getChildText(children, "expressionVersion"),
    scriptText: getChildText(children, "scriptText"),
    viewID: getChildText(children, "viewID"),
    calcCount: armCount(node, "calc"),
    criteriaCount: armCount(node, "criteria"),
    fieldCount: armCount(node, "field"),
  };
}

export interface ExpressCalculationRow {
  uid: string;
  serviceProviderCode: string;
  expressionName: string;
  calSeq: string;
  calculateExp: string;
  fieldName: string;
  fieldPropterty: string;
}

export function toExpressCalculationRow(node: PNode): ExpressCalculationRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    expressionName: getChildText(children, "expressionName"),
    calSeq: getChildText(children, "calSeq"),
    calculateExp: getChildText(children, "calculateExp"),
    fieldName: getChildText(children, "fieldName"),
    fieldPropterty: getChildText(children, "fieldPropterty"),
  };
}

export interface ExpressCriteriaRow {
  uid: string;
  serviceProviderCode: string;
  expressionName: string;
  criteriaSeq: string;
  criteriaType: string;
  parentId: string;
  booleanOperator: string;
  criteriaValue: string;
  fieldName: string;
  fieldOperator: string;
}

export function toExpressCriteriaRow(node: PNode): ExpressCriteriaRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    expressionName: getChildText(children, "expressionName"),
    criteriaSeq: getChildText(children, "criteriaSeq"),
    criteriaType: getChildText(children, "criteriaType"),
    parentId: getChildText(children, "parentId"),
    booleanOperator: getChildText(children, "booleanOperator"),
    criteriaValue: getChildText(children, "criteriaValue"),
    fieldName: getChildText(children, "fieldName"),
    fieldOperator: getChildText(children, "fieldOperator"),
  };
}

export interface ExpressFieldRow {
  uid: string;
  serviceProviderCode: string;
  expressionName: string;
  usage: string;
  portletId: string;
  variableKey: string;
  event: string;
  isRequired: string;
  name: string;
  label: string;
  refColName: string;
  type: string;
}

export function toExpressFieldRow(node: PNode): ExpressFieldRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    expressionName: getChildText(children, "expressionName"),
    usage: getChildText(children, "usage"),
    portletId: getChildText(children, "portletId"),
    variableKey: getChildText(children, "variableKey"),
    event: getChildText(children, "event"),
    isRequired: getChildText(children, "isRequired"),
    name: getChildText(children, "name"),
    label: getChildText(children, "label"),
    refColName: getChildText(children, "refColName"),
    type: getChildText(children, "type"),
  };
}

export function inferCommonAgencyId(rows: ExpressionRow[]): string {
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

export function findExpressionByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findArmNodeByUid(exprNode: PNode, arm: ArmKey, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateArmNodesArray(exprNode, arm), uid);
}

export const EXPRESSION_EDITABLE_FIELDS = [
  "expressionName",
  "serviceProviderCode",
  "checkboxCode",
  "entityKey1",
  "entityKey2",
  "entityKey3",
  "executeIn",
  "executeOrder",
  "expressionBehavior",
  "expressionMode",
  "expressionVersion",
  "scriptText",
  "viewID",
] as const;

export const EXPRESS_CALCULATION_EDITABLE_FIELDS = [
  "calSeq",
  "calculateExp",
  "fieldName",
  "fieldPropterty",
  "expressionName",
  "serviceProviderCode",
] as const;

export const EXPRESS_CRITERIA_EDITABLE_FIELDS = [
  "criteriaSeq",
  "criteriaType",
  "parentId",
  "booleanOperator",
  "criteriaValue",
  "fieldName",
  "fieldOperator",
  "expressionName",
  "serviceProviderCode",
] as const;

export const EXPRESS_FIELD_EDITABLE_FIELDS = [
  "usage",
  "portletId",
  "variableKey",
  "event",
  "isRequired",
  "name",
  "label",
  "refColName",
  "type",
  "expressionName",
  "serviceProviderCode",
] as const;

/** Editing the expression's expressionName cascades into every
 * calculation's/criteria's/field's own expressionName. serviceProviderCode
 * cascades the same way into all three arms' own serviceProviderCode. */
export function setExpressionField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "expressionName" || field === "serviceProviderCode") {
    for (const arm of ["calc", "criteria", "field"] as ArmKey[]) {
      for (const item of getOrCreateArmNodesArray(node, arm)) {
        setChildText(getChildren(item), field, value);
      }
    }
  }
}

export function setExpressCalculationField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function setExpressCriteriaField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function setExpressFieldField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createExpressionNode(serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "expressionName", "");
  children.push(createAuditModelNode());
  setChildText(children, "checkboxCode", "");
  setChildText(children, "entityKey1", "");
  setChildText(children, "executeIn", "ALL");
  setChildText(children, "expressionMode", "Manual");
  setChildText(children, "expressionVersion", "");
  setChildText(children, "scriptText", "");
  setChildText(children, "viewID", "");
  children.push({ expressCalculations: [] });
  children.push({ expressCriterias: [] });
  children.push({ expressFields: [] });
  children.push({ expressPortlets: [] });
  children.push({ pageStatusModels: [] });
  children.push({ xexpressEMSEScripts: [] });
  return { expression: children };
}

export function createExpressCalculationNode(expressionName: string, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "expressionName", expressionName);
  setChildText(children, "calSeq", "");
  children.push(createAuditModelNode());
  setChildText(children, "calculateExp", "");
  setChildText(children, "fieldName", "");
  setChildText(children, "fieldPropterty", "");
  children.push({ expressionI18Ns: [] });
  return { expressCalculation: children };
}

export function createExpressCriteriaNode(expressionName: string, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "expressionName", expressionName);
  setChildText(children, "criteriaSeq", "");
  setChildText(children, "criteriaType", "IFCONDITION");
  setChildText(children, "parentId", "0");
  children.push(createAuditModelNode());
  setChildText(children, "booleanOperator", "&&");
  setChildText(children, "criteriaValue", "");
  setChildText(children, "fieldName", "");
  setChildText(children, "fieldOperator", "==");
  children.push({ expressionCriteriaI18Ns: [] });
  return { expressCriteria: children };
}

export function createExpressFieldNode(expressionName: string, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "expressionName", expressionName);
  setChildText(children, "usage", "VARIABLE");
  setChildText(children, "portletId", "");
  setChildText(children, "variableKey", "");
  children.push(createAuditModelNode());
  setChildText(children, "isRequired", "N");
  setChildText(children, "name", "");
  return { expressField: children };
}

export function deleteExpression(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteArmNode(exprNode: PNode, arm: ArmKey, node: PNode) {
  const arr = getOrCreateArmNodesArray(exprNode, arm);
  const idx = arr.indexOf(node);
  if (idx >= 0) arr.splice(idx, 1);
}
