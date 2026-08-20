/**
 * RefFeeScheduleModel.xml parse/serialize (see full-schema-reference.md).
 *
 * A schedule has two structurally different child arms (unlike Standard
 * Comment Group's five identically-shaped arms): a repeating list of fee
 * items (refFeeItemModels/refFeeItem) and a repeating list of module
 * associations (feeScheduleModuleModels/feeScheduleModuleModel, no refId).
 * A third arm the schema exposes, refFeeItemgroups (a junction-table-style
 * item-group feature), is confirmed always empty/self-closing across the
 * entire real 159-record sample — never populated in practice for this
 * agency — so it is deliberately left untouched rather than guessed at
 * without a real example to derive its shape from.
 *
 * Each fee item embeds two large read-only reference blobs inline —
 * `refPaymentPeriodModel` and, most notably, `unitDescModel` (a *complete*
 * embedded StandardChoiceModel with its full ~35-value choice list,
 * denormalized in full on every single item). Neither is read or edited
 * by this module; they round-trip untouched exactly like every other
 * category's untouched sibling collections, simply because
 * setChildText/getChildText only ever touch the one named field they're
 * asked for.
 *
 * Confirmed against a real 2-record sample
 * (fixtures/ref-fee-schedule/rfs-real.xml: "TEST", one fee item + one
 * module association; "NO FEES", zero fee items + five module
 * associations — together covering both arms, including the empty-items
 * self-closing case).
 *
 * Cascades: a schedule's feeScheduleName cascades into every item's own
 * feeScheduleName AND every module's feeCode (confirmed identical to the
 * schedule name in the real sample, e.g. feeScheduleName "BD_TRADE" ->
 * module feeCode "BD_TRADE"); feeScheduleVersion cascades into every
 * item's own feeScheduleVersion only (modules carry no version field).
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
export type ParsedRefFeeScheduleFile = ParsedListFile;

export type ArmKey = "item" | "module";

const COLLECTION_TAGS = new Set([
  "refFeeItemModels",
  "feeScheduleModuleModels",
  "refFeeItemgroups",
  "refFeeScheduleI18NModels",
  "refFeeItemI18NModels",
  "refFeeCalcModels",
  "refPaymentPeriodI18NModels",
  "standardChoiceValueI18NModels",
]);

/** Cheap content sniff — real export files aren't necessarily named "RefFeeScheduleModel.xml". */
export function isRefFeeScheduleXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<refFeeSchedule[\s>]/.test(xmlText);
}

export function parseRefFeeScheduleXml(xmlText: string): ParsedRefFeeScheduleFile {
  return parseListXml(xmlText, "refFeeSchedule");
}

export function serializeRefFeeScheduleXml(
  file: ParsedRefFeeScheduleFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedRefFeeScheduleXml(file: ParsedRefFeeScheduleFile): string {
  return serializeRefFeeScheduleXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations — one schedule, two structurally-distinct arms
// ---------------------------------------------------------------------------

export interface RefFeeScheduleRow {
  uid: string;
  refId: string;
  feeScheduleName: string;
  feeScheduleVersion: string;
  effDate: string;
  expDate: string;
  feeScheduleAlias: string;
  feeScheduleComment: string;
  serviceProviderCode: string;
  itemCount: number;
  moduleCount: number;
}

function getOrCreateItemNodesArray(scheduleNode: PNode): PNode[] {
  const children = getChildren(scheduleNode);
  let container = findChildByTag(children, "refFeeItemModels");
  if (!container) {
    container = { refFeeItemModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

function getOrCreateModuleNodesArray(scheduleNode: PNode): PNode[] {
  const children = getChildren(scheduleNode);
  let container = findChildByTag(children, "feeScheduleModuleModels");
  if (!container) {
    container = { feeScheduleModuleModels: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function getArmNodes(scheduleNode: PNode, arm: ArmKey): PNode[] {
  return arm === "item"
    ? getOrCreateItemNodesArray(scheduleNode)
    : getOrCreateModuleNodesArray(scheduleNode);
}

export function toRefFeeScheduleRow(node: PNode): RefFeeScheduleRow {
  const children = getChildren(node);
  const itemCount = getOrCreateItemNodesArray(node).filter((c) =>
    Object.keys(c).includes("refFeeItem")
  ).length;
  const moduleCount = getOrCreateModuleNodesArray(node).filter((c) =>
    Object.keys(c).includes("feeScheduleModuleModel")
  ).length;
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    feeScheduleName: getChildText(children, "feeScheduleName"),
    feeScheduleVersion: getChildText(children, "feeScheduleVersion"),
    effDate: getChildText(children, "effDate"),
    expDate: getChildText(children, "expDate"),
    feeScheduleAlias: getChildText(children, "feeScheduleAlias"),
    feeScheduleComment: getChildText(children, "feeScheduleComment"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
    itemCount,
    moduleCount,
  };
}

export interface RefFeeItemRow {
  uid: string;
  refId: string;
  feeCod: string;
  feeDes: string;
  paymentPeriod: string;
  calProc: string;
  crDr: string;
  formula: string;
  displayOrder: string;
  subGroup: string;
  udes: string;
  defaultFlag: string;
  autoAssessFlag: string;
  acaRequiredFlag: string;
  roundFeeFlag: string;
  roundFeeType: string;
  feeAllocationType: string;
  feeCodeStatus: string;
  negativeFeeFlag: string;
  netFeeFlag: string;
  preProc: string;
  qtyIndicator: string;
  taxFlag: string;
  appendFlag: string;
  accCodeL1: string;
  accCodeL2: string;
  accCodeL3: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  feeScheduleName: string;
  feeScheduleVersion: string;
  serviceProviderCode: string;
}

export function toRefFeeItemRow(node: PNode): RefFeeItemRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    feeCod: getChildText(children, "feeCod"),
    feeDes: getChildText(children, "feeDes"),
    paymentPeriod: getChildText(children, "paymentPeriod"),
    calProc: getChildText(children, "calProc"),
    crDr: getChildText(children, "crDr"),
    formula: getChildText(children, "formula"),
    displayOrder: getChildText(children, "displayOrder"),
    subGroup: getChildText(children, "subGroup"),
    udes: getChildText(children, "udes"),
    defaultFlag: getChildText(children, "defaultFlag"),
    autoAssessFlag: getChildText(children, "autoAssessFlag"),
    acaRequiredFlag: getChildText(children, "acaRequiredFlag"),
    roundFeeFlag: getChildText(children, "roundFeeFlag"),
    roundFeeType: getChildText(children, "roundFeeType"),
    feeAllocationType: getChildText(children, "feeAllocationType"),
    feeCodeStatus: getChildText(children, "feeCodeStatus"),
    negativeFeeFlag: getChildText(children, "negativeFeeFlag"),
    netFeeFlag: getChildText(children, "netFeeFlag"),
    preProc: getChildText(children, "preProc"),
    qtyIndicator: getChildText(children, "qtyIndicator"),
    taxFlag: getChildText(children, "taxFlag"),
    appendFlag: getChildText(children, "appendFlag"),
    accCodeL1: getChildText(children, "accCodeL1"),
    accCodeL2: getChildText(children, "accCodeL2"),
    accCodeL3: getChildText(children, "accCodeL3"),
    udf1: getChildText(children, "udf1"),
    udf2: getChildText(children, "udf2"),
    udf3: getChildText(children, "udf3"),
    udf4: getChildText(children, "udf4"),
    feeScheduleName: getChildText(children, "feeScheduleName"),
    feeScheduleVersion: getChildText(children, "feeScheduleVersion"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export interface FeeScheduleModuleRow {
  uid: string;
  refId: string;
  feeCode: string;
  moduleName: string;
  servPrvCode: string;
}

export function toFeeScheduleModuleRow(node: PNode): FeeScheduleModuleRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    refId: getAttr(node, "refId") ?? "",
    feeCode: getChildText(children, "feeCode"),
    moduleName: getChildText(children, "moduleName"),
    servPrvCode: getChildText(children, "servPrvCode"),
  };
}

export function inferCommonAgencyId(rows: RefFeeScheduleRow[]): string {
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
  suffix: "RefFeeScheduleModel" | "RefFeeItemModel"
): number {
  return nextRefIdNumberGeneric(records, suffix);
}

export function findRefFeeScheduleByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findArmNodeByUid(scheduleNode: PNode, arm: ArmKey, uid: string): PNode | undefined {
  return findNodeByUid(getArmNodes(scheduleNode, arm), uid);
}

export const REF_FEE_SCHEDULE_EDITABLE_FIELDS = [
  "feeScheduleName",
  "feeScheduleVersion",
  "effDate",
  "expDate",
  "feeScheduleAlias",
  "feeScheduleComment",
  "serviceProviderCode",
] as const;

export const REF_FEE_ITEM_EDITABLE_FIELDS = [
  "feeCod",
  "feeDes",
  "paymentPeriod",
  "calProc",
  "crDr",
  "formula",
  "displayOrder",
  "subGroup",
  "udes",
  "defaultFlag",
  "autoAssessFlag",
  "acaRequiredFlag",
  "roundFeeFlag",
  "roundFeeType",
  "feeAllocationType",
  "feeCodeStatus",
  "negativeFeeFlag",
  "netFeeFlag",
  "preProc",
  "qtyIndicator",
  "taxFlag",
  "appendFlag",
  "accCodeL1",
  "accCodeL2",
  "accCodeL3",
  "udf1",
  "udf2",
  "udf3",
  "udf4",
  "feeScheduleName",
  "feeScheduleVersion",
  "serviceProviderCode",
] as const;

export const FEE_SCHEDULE_MODULE_EDITABLE_FIELDS = ["feeCode", "moduleName", "servPrvCode"] as const;

/** Editing the schedule's feeScheduleName cascades into every item's own
 * feeScheduleName and every module's feeCode; feeScheduleVersion cascades
 * into every item's own feeScheduleVersion only. */
export function setRefFeeScheduleField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "feeScheduleName") {
    for (const item of getOrCreateItemNodesArray(node)) {
      setChildText(getChildren(item), "feeScheduleName", value);
    }
    for (const mod of getOrCreateModuleNodesArray(node)) {
      setChildText(getChildren(mod), "feeCode", value);
    }
  } else if (field === "feeScheduleVersion") {
    for (const item of getOrCreateItemNodesArray(node)) {
      setChildText(getChildren(item), "feeScheduleVersion", value);
    }
  }
}

export function setRefFeeItemField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function setFeeScheduleModuleField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createRefFeeScheduleNode(refIdNum: number, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "feeScheduleName", "");
  setChildText(children, "feeScheduleVersion", "");
  children.push(createAuditModelNode());
  setChildText(children, "effDate", "");
  children.push({ refFeeItemModels: [] });
  setChildText(children, "feeScheduleAlias", "");
  children.push({ refFeeScheduleI18NModels: [] });
  children.push({ feeScheduleModuleModels: [] });
  children.push({ refFeeItemgroups: [] });
  const node: PNode = { refFeeSchedule: children };
  setAttr(node, "refId", `${refIdNum}@RefFeeScheduleModel`);
  return node;
}

export function createRefFeeItemNode(
  refIdNum: number,
  feeScheduleName: string,
  feeScheduleVersion: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "feeScheduleName", feeScheduleName);
  setChildText(children, "feeScheduleVersion", feeScheduleVersion);
  setChildText(children, "feeCod", "");
  setChildText(children, "paymentPeriod", "");
  children.push(createAuditModelNode());
  setChildText(children, "feeDes", "");
  children.push({ refFeeItemI18NModels: [] });
  setChildText(children, "formula", "");
  children.push({ refFeeCalcModels: [] });
  const node: PNode = { refFeeItem: children };
  setAttr(node, "refId", `${refIdNum}@RefFeeItemModel`);
  return node;
}

export function createFeeScheduleModuleNode(
  feeCode: string,
  serviceProviderCode = ""
): PNode {
  const children: PNode[] = [];
  setChildText(children, "feeCode", feeCode);
  setChildText(children, "moduleName", "");
  setChildText(children, "servPrvCode", serviceProviderCode);
  children.push(createAuditModelNode());
  return { feeScheduleModuleModel: children };
}

export function deleteRefFeeSchedule(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteArmNode(scheduleNode: PNode, arm: ArmKey, node: PNode) {
  const arr = getArmNodes(scheduleNode, arm);
  const idx = arr.indexOf(node);
  if (idx >= 0) arr.splice(idx, 1);
}
