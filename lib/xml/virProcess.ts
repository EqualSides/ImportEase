/**
 * VirProcessModel.xml parse/serialize (see full-schema-reference.md).
 *
 * A third "heterogeneous-arm" category (see lib/xml/refFeeSchedule.ts for
 * the first): a process has THREE structurally-different editable arms —
 * workflow task steps (processModels/processModel), email notification
 * settings (processEMailSettingModels/processEMailSettingModel), and
 * activity/status type definitions (r3statypModels/r3statyp) — plus a
 * fourth arm, processSecurityModels, which is genuinely security data
 * (policySeq/rightGranted/userGroup, the same shape used by real
 * permission records elsewhere in the schema, not just a flag) and is
 * therefore never read or edited here, exactly like TimeTypes/TimeGroup's
 * untouched xxxSecurityModels arms. VirProcessModel is one of the eight
 * categories flagged by the sensitive-data gate for embedding permission
 * references, confirmed here to be true (unlike TimeTypes/TimeGroup,
 * whose security arms were empty in the sample used).
 *
 * Confirmed against a real 2-record sample
 * (fixtures/vir-process/vp-real.xml: "PW_DRN_CMPLNT", one task + one
 * status entry; "BD_IAPERMIT", one task + three email settings — together
 * covering all three editable arms, with processSecurityModels empty/
 * self-closing in both, which is realistic: security data is populated
 * in only 6 of the real file's 180 records, and always alongside a very
 * large task/status arm fan-out unsuited to a compact fixture).
 *
 * No `refId` attribute anywhere in the real sample, at the process level
 * or any arm. Cascades: a process's r1ProcessCode cascades into every
 * task's own r1ProcessCode, every status entry's r3ProcessCode, and
 * every email setting's processName (confirmed identical to the process
 * code in the real sample); servProvCode cascades into every task's and
 * status entry's own servProvCode, and every email setting's
 * serviceProviderCode (a field-name variant, same pattern documented in
 * lib/xml/sharedDropDownList.ts). The trailing `securityFlag` field
 * (e.g. "PW_DRN_CMPLNT/%") looks derived from r1ProcessCode by
 * convention but is left untouched rather than guessed at.
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
export type ParsedVirProcessFile = ParsedListFile;

export type ArmKey = "task" | "email" | "status";

const ARM_CONTAINER_TAG: Record<ArmKey, string> = {
  task: "processModels",
  email: "processEMailSettingModels",
  status: "r3statypModels",
};

const ARM_ITEM_TAG: Record<ArmKey, string> = {
  task: "processModel",
  email: "processEMailSettingModel",
  status: "r3statyp",
};

const COLLECTION_TAGS = new Set([
  "processModels",
  "processEMailSettingModels",
  "processSecurityModels",
  "r3statypModels",
  "refTaskItemI18NModels",
  "refTaskStatusI18NModels",
]);

/** Cheap content sniff — real export files aren't necessarily named "VirProcessModel.xml". */
export function isVirProcessXml(xmlText: string): boolean {
  return /<list[\s>]/.test(xmlText) && /<virProcess[\s>]/.test(xmlText);
}

export function parseVirProcessXml(xmlText: string): ParsedVirProcessFile {
  return parseListXml(xmlText, "virProcess");
}

export function serializeVirProcessXml(
  file: ParsedVirProcessFile,
  overrides?: Partial<Pick<ListAttrs, "exportUser" | "exportDateTime">>
): string {
  return serializeListXml(file, COLLECTION_TAGS, overrides);
}

export function buildExportedVirProcessXml(file: ParsedVirProcessFile): string {
  return serializeVirProcessXml(file, {
    exportUser: "IMPORTEASE",
    exportDateTime: formatAccelaDateTime(new Date()),
  });
}

// ---------------------------------------------------------------------------
// Grid row projections + mutations — one process, three structurally-distinct arms
// ---------------------------------------------------------------------------

export interface VirProcessRow {
  uid: string;
  r1ProcessCode: string;
  servProvCode: string;
  isEmailSettringSelected: string;
  isSecuritySelected: string;
  isTSISelected: string;
  taskCount: number;
  emailCount: number;
  statusCount: number;
}

function getOrCreateArmNodesArray(processNode: PNode, arm: ArmKey): PNode[] {
  const children = getChildren(processNode);
  const containerTag = ARM_CONTAINER_TAG[arm];
  let container = findChildByTag(children, containerTag);
  if (!container) {
    container = { [containerTag]: [] };
    children.push(container);
  }
  return getChildren(container);
}

export function getArmNodes(processNode: PNode, arm: ArmKey): PNode[] {
  return getOrCreateArmNodesArray(processNode, arm);
}

function armCount(processNode: PNode, arm: ArmKey): number {
  const itemTag = ARM_ITEM_TAG[arm];
  return getOrCreateArmNodesArray(processNode, arm).filter((c) => Object.keys(c).includes(itemTag))
    .length;
}

export function toVirProcessRow(node: PNode): VirProcessRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    r1ProcessCode: getChildText(children, "r1ProcessCode"),
    servProvCode: getChildText(children, "servProvCode"),
    isEmailSettringSelected: getChildText(children, "isEmailSettringSelected"),
    isSecuritySelected: getChildText(children, "isSecuritySelected"),
    isTSISelected: getChildText(children, "isTSISelected"),
    taskCount: armCount(node, "task"),
    emailCount: armCount(node, "email"),
    statusCount: armCount(node, "status"),
  };
}

export interface ProcessTaskRow {
  uid: string;
  r1ProcessCode: string;
  sdStpNum: string;
  sdProDes: string;
  sdAppDes: string;
  sdDueDay: string;
  sdNxtId1: string;
  sdProId1: string;
  asgnAgencyCode: string;
  asgnBureauCode: string;
  asgnDivisionCode: string;
  asgnGroupCode: string;
  asgnOfficeCode: string;
  asgnSectionCode: string;
  displayInAca: string;
  estimatedHours: string;
  hoursSpentRequired: string;
  r1CheckboxCode: string;
  r1CheckboxGroup: string;
  sdChkLv5: string;
  servProvCode: string;
}

export function toProcessTaskRow(node: PNode): ProcessTaskRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    r1ProcessCode: getChildText(children, "r1ProcessCode"),
    sdStpNum: getChildText(children, "sdStpNum"),
    sdProDes: getChildText(children, "sdProDes"),
    sdAppDes: getChildText(children, "sdAppDes"),
    sdDueDay: getChildText(children, "sdDueDay"),
    sdNxtId1: getChildText(children, "sdNxtId1"),
    sdProId1: getChildText(children, "sdProId1"),
    asgnAgencyCode: getChildText(children, "asgnAgencyCode"),
    asgnBureauCode: getChildText(children, "asgnBureauCode"),
    asgnDivisionCode: getChildText(children, "asgnDivisionCode"),
    asgnGroupCode: getChildText(children, "asgnGroupCode"),
    asgnOfficeCode: getChildText(children, "asgnOfficeCode"),
    asgnSectionCode: getChildText(children, "asgnSectionCode"),
    displayInAca: getChildText(children, "displayInAca"),
    estimatedHours: getChildText(children, "estimatedHours"),
    hoursSpentRequired: getChildText(children, "hoursSpentRequired"),
    r1CheckboxCode: getChildText(children, "r1CheckboxCode"),
    r1CheckboxGroup: getChildText(children, "r1CheckboxGroup"),
    sdChkLv5: getChildText(children, "sdChkLv5"),
    servProvCode: getChildText(children, "servProvCode"),
  };
}

export interface ProcessEmailSettingRow {
  uid: string;
  noteID: string;
  processName: string;
  contentsCode: string;
  docCategory: string;
  docGroup: string;
  sdProDes: string;
  sdAppDes: string;
  b3contactFlag: string;
  contactRelation: string;
  distributionFlag: string;
  edmsLocation: string;
  edmsObject: string;
  mediaFlag: string;
  serviceProviderCode: string;
}

export function toProcessEmailSettingRow(node: PNode): ProcessEmailSettingRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    noteID: getChildText(children, "noteID"),
    processName: getChildText(children, "processName"),
    contentsCode: getChildText(children, "contentsCode"),
    docCategory: getChildText(children, "docCategory"),
    docGroup: getChildText(children, "docGroup"),
    sdProDes: getChildText(children, "sdProDes"),
    sdAppDes: getChildText(children, "sdAppDes"),
    b3contactFlag: getChildText(children, "b3contactFlag"),
    contactRelation: getChildText(children, "contactRelation"),
    distributionFlag: getChildText(children, "distributionFlag"),
    edmsLocation: getChildText(children, "edmsLocation"),
    edmsObject: getChildText(children, "edmsObject"),
    mediaFlag: getChildText(children, "mediaFlag"),
    serviceProviderCode: getChildText(children, "serviceProviderCode"),
  };
}

export interface ActivityStatusRow {
  uid: string;
  r3ActStatCod: string;
  r3ProcessCode: string;
  r3ActStatDes: string;
  r3ActTypeDes: string;
  r3ActStatFlg: string;
  applicationStatus: string;
  parentStatus: string;
  displayInAca: string;
  servProvCode: string;
}

export function toActivityStatusRow(node: PNode): ActivityStatusRow {
  const children = getChildren(node);
  return {
    uid: getNodeUid(node),
    r3ActStatCod: getChildText(children, "r3ActStatCod"),
    r3ProcessCode: getChildText(children, "r3ProcessCode"),
    r3ActStatDes: getChildText(children, "r3ActStatDes"),
    r3ActTypeDes: getChildText(children, "r3ActTypeDes"),
    r3ActStatFlg: getChildText(children, "r3ActStatFlg"),
    applicationStatus: getChildText(children, "applicationStatus"),
    parentStatus: getChildText(children, "parentStatus"),
    displayInAca: getChildText(children, "displayInAca"),
    servProvCode: getChildText(children, "servProvCode"),
  };
}

export function inferCommonAgencyId(rows: VirProcessRow[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r.servProvCode.trim();
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

export function findVirProcessByUid(records: PNode[], uid: string): PNode | undefined {
  return findNodeByUid(records, uid);
}

export function findArmNodeByUid(processNode: PNode, arm: ArmKey, uid: string): PNode | undefined {
  return findNodeByUid(getOrCreateArmNodesArray(processNode, arm), uid);
}

export const VIR_PROCESS_EDITABLE_FIELDS = [
  "r1ProcessCode",
  "servProvCode",
  "isEmailSettringSelected",
  "isSecuritySelected",
  "isTSISelected",
] as const;

export const PROCESS_TASK_EDITABLE_FIELDS = [
  "sdProDes",
  "sdAppDes",
  "sdStpNum",
  "sdDueDay",
  "sdNxtId1",
  "sdProId1",
  "asgnAgencyCode",
  "asgnBureauCode",
  "asgnDivisionCode",
  "asgnGroupCode",
  "asgnOfficeCode",
  "asgnSectionCode",
  "displayInAca",
  "estimatedHours",
  "hoursSpentRequired",
  "r1CheckboxCode",
  "r1CheckboxGroup",
  "sdChkLv5",
  "r1ProcessCode",
  "servProvCode",
] as const;

export const PROCESS_EMAIL_SETTING_EDITABLE_FIELDS = [
  "contentsCode",
  "docCategory",
  "docGroup",
  "sdProDes",
  "sdAppDes",
  "noteID",
  "b3contactFlag",
  "contactRelation",
  "distributionFlag",
  "edmsLocation",
  "edmsObject",
  "mediaFlag",
  "processName",
  "serviceProviderCode",
] as const;

export const ACTIVITY_STATUS_EDITABLE_FIELDS = [
  "r3ActStatDes",
  "r3ActTypeDes",
  "r3ActStatCod",
  "r3ActStatFlg",
  "applicationStatus",
  "parentStatus",
  "displayInAca",
  "r3ProcessCode",
  "servProvCode",
] as const;

/** Editing the process's r1ProcessCode cascades into every task's own
 * r1ProcessCode, every status entry's r3ProcessCode, and every email
 * setting's processName. servProvCode cascades into every task's and
 * status entry's own servProvCode, and every email setting's
 * serviceProviderCode. */
export function setVirProcessField(node: PNode, field: string, value: string) {
  const children = getChildren(node);
  setChildText(children, field, value);
  if (field === "r1ProcessCode") {
    for (const task of getOrCreateArmNodesArray(node, "task")) {
      setChildText(getChildren(task), "r1ProcessCode", value);
    }
    for (const status of getOrCreateArmNodesArray(node, "status")) {
      setChildText(getChildren(status), "r3ProcessCode", value);
    }
    for (const email of getOrCreateArmNodesArray(node, "email")) {
      setChildText(getChildren(email), "processName", value);
    }
  } else if (field === "servProvCode") {
    for (const task of getOrCreateArmNodesArray(node, "task")) {
      setChildText(getChildren(task), "servProvCode", value);
    }
    for (const status of getOrCreateArmNodesArray(node, "status")) {
      setChildText(getChildren(status), "servProvCode", value);
    }
    for (const email of getOrCreateArmNodesArray(node, "email")) {
      setChildText(getChildren(email), "serviceProviderCode", value);
    }
  }
}

export function setProcessTaskField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function setProcessEmailSettingField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function setActivityStatusField(node: PNode, field: string, value: string) {
  setChildText(getChildren(node), field, value);
}

export function createVirProcessNode(servProvCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "r1ProcessCode", "");
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "isEmailSettringSelected", "Y");
  setChildText(children, "isSecuritySelected", "Y");
  setChildText(children, "isTSISelected", "Y");
  children.push({ processEMailSettingModels: [] });
  children.push({ processModels: [] });
  children.push({ processSecurityModels: [] });
  children.push({ r3statypModels: [] });
  return { virProcess: children };
}

export function createProcessTaskNode(r1ProcessCode: string, servProvCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "r1ProcessCode", r1ProcessCode);
  setChildText(children, "sdStpNum", "");
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "asgnAgencyCode", "");
  setChildText(children, "asgnBureauCode", "");
  setChildText(children, "asgnDivisionCode", "");
  setChildText(children, "asgnGroupCode", "");
  setChildText(children, "asgnOfficeCode", "");
  setChildText(children, "asgnSectionCode", "");
  children.push(createAuditModelNode());
  children.push({ refTaskItemI18NModels: [] });
  setChildText(children, "sdNxtId1", "");
  setChildText(children, "sdProDes", "");
  setChildText(children, "sdProId1", "");
  return { processModel: children };
}

export function createProcessEmailSettingNode(processName: string, serviceProviderCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "noteID", "");
  setChildText(children, "processName", processName);
  setChildText(children, "serviceProviderCode", serviceProviderCode);
  setChildText(children, "contentsCode", "");
  setChildText(children, "docCategory", "");
  setChildText(children, "docGroup", "");
  setChildText(children, "recDate", new Date().toISOString());
  setChildText(children, "recFulNam", "IMPORTEASE");
  setChildText(children, "recStatus", "A");
  setChildText(children, "sdAppDes", "");
  setChildText(children, "sdProDes", "");
  return { processEMailSettingModel: children };
}

export function createActivityStatusNode(r3ProcessCode: string, servProvCode = ""): PNode {
  const children: PNode[] = [];
  setChildText(children, "r3ActStatCod", "");
  setChildText(children, "r3ProcessCode", r3ProcessCode);
  setChildText(children, "servProvCode", servProvCode);
  setChildText(children, "applicationStatus", "");
  setChildText(children, "displayInAca", "");
  setChildText(children, "parentStatus", "");
  setChildText(children, "r3ActStatDes", "");
  setChildText(children, "r3ActStatFlg", "");
  setChildText(children, "r3ActTypeDes", "");
  setChildText(children, "recDate", new Date().toISOString());
  setChildText(children, "recFulNam", "IMPORTEASE");
  setChildText(children, "recStatus", "A");
  children.push({ refTaskStatusI18NModels: [] });
  return { r3statyp: children };
}

export function deleteVirProcess(records: PNode[], node: PNode) {
  const idx = records.indexOf(node);
  if (idx >= 0) records.splice(idx, 1);
}

export function deleteArmNode(processNode: PNode, arm: ArmKey, node: PNode) {
  const arr = getOrCreateArmNodesArray(processNode, arm);
  const idx = arr.indexOf(node);
  if (idx >= 0) arr.splice(idx, 1);
}
