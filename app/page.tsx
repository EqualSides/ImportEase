"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StandardChoiceGrid from "@/components/StandardChoiceGrid";
import SharedDropDownGrid from "@/components/SharedDropDownGrid";
import RefAddressTypeGroupGrid from "@/components/RefAddressTypeGroupGrid";
import SequenceGrid from "@/components/SequenceGrid";
import CheckListGroupGrid from "@/components/CheckListGroupGrid";
import ApplicationStatusGroupGrid from "@/components/ApplicationStatusGroupGrid";
import CommentGroupGrid from "@/components/CommentGroupGrid";
import TimeGroupGrid from "@/components/TimeGroupGrid";
import RefInspectionResultGroupGrid from "@/components/RefInspectionResultGroupGrid";
import RefLookupTableGrid from "@/components/RefLookupTableGrid";
import GuideSheetGrid from "@/components/GuideSheetGrid";
import RAPOTemplateGrid from "@/components/RAPOTemplateGrid";
import SmartChoiceGroupGrid from "@/components/SmartChoiceGroupGrid";
import StandardCommentGroupGrid from "@/components/StandardCommentGroupGrid";
import RefFeeScheduleGrid from "@/components/RefFeeScheduleGrid";
import VirProcessGrid from "@/components/VirProcessGrid";
import ExpressionBuilderGrid from "@/components/ExpressionBuilderGrid";
import ASIGroupGrid from "@/components/ASIGroupGrid";
import FormLayoutEditorGrid from "@/components/FormLayoutEditorGrid";
import InspectionGroupGrid from "@/components/InspectionGroupGrid";
import RefDocumentGrid from "@/components/RefDocumentGrid";
import FlatGrid, { type FlatGridColumnMeta } from "@/components/FlatGrid";
import AuthModal from "@/components/AuthModal";
import AdminPanel from "@/components/AdminPanel";
import { supabase, ADMIN_EMAIL, checkSubscriptionStatus } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import {
  createDepartmentTypeNode,
  deleteDepartmentType,
  findDepartmentTypeByUid,
  inferCommonAgencyId as inferCommonAgencyIdDepartmentType,
  nextRefIdNumber as nextRefIdNumberDepartmentType,
  setDepartmentTypeField,
  toDepartmentTypeRow,
} from "@/lib/xml/departmentType";
import {
  createConditionNode,
  deleteCondition,
  findConditionByUid,
  inferCommonAgencyId as inferCommonAgencyIdConditions,
  nextRefIdNumber as nextRefIdNumberConditions,
  setConditionField,
  toConditionRow,
} from "@/lib/xml/conditions";
import {
  getArmNodes as getExpressionBuilderArmNodes,
  inferCommonAgencyId as inferCommonAgencyIdExpressionBuilder,
  toExpressCalculationRow,
  toExpressCriteriaRow,
  toExpressFieldRow,
  toExpressionRow,
} from "@/lib/xml/expressionBuilder";
import {
  getStandardChoiceValueNodes,
  inferCommonAgencyId as inferCommonAgencyIdStandardChoice,
  toStandardChoiceRow,
  toStandardChoiceValueRow,
} from "@/lib/xml/standardChoice";
import {
  getSharedDropDownValueNodes,
  inferCommonAgencyId as inferCommonAgencyIdSharedDropDown,
  toSharedDropDownRow,
  toSharedDropDownValueRow,
} from "@/lib/xml/sharedDropDownList";
import {
  createOrganizationAgencyNode,
  deleteOrganizationAgency,
  findOrganizationAgencyByUid,
  inferCommonAgencyId as inferCommonAgencyIdOrgAgency,
  nextRefIdNumber as nextRefIdNumberOrgAgency,
  setOrganizationAgencyField,
  toOrganizationAgencyRow,
} from "@/lib/xml/organizationAgency";
import {
  createInspRelateInspNode,
  deleteInspRelateInsp,
  findInspRelateInspByUid,
  inferCommonAgencyId as inferCommonAgencyIdInspRelateInsp,
  nextRefIdNumber as nextRefIdNumberInspRelateInsp,
  setInspRelateInspField,
  toInspRelateInspRow,
} from "@/lib/xml/inspRelateInsp";
import {
  getRefAddressTypeNodes,
  inferCommonAgencyId as inferCommonAgencyIdRefAddressTypeGroup,
  toRefAddressTypeGroupRow,
  toRefAddressTypeRow,
} from "@/lib/xml/refAddressTypeGroup";
import {
  createReferenceMaskNode,
  deleteReferenceMask,
  findReferenceMaskByUid,
  inferCommonAgencyId as inferCommonAgencyIdReferenceMask,
  nextRefIdNumber as nextRefIdNumberReferenceMask,
  setReferenceMaskField,
  toReferenceMaskRow,
} from "@/lib/xml/referenceMask";
import {
  createEmailMessageNode,
  deleteEmailMessage,
  findEmailMessageByUid,
  inferCommonAgencyId as inferCommonAgencyIdEmailMessage,
  nextRefIdNumber as nextRefIdNumberEmailMessage,
  setEmailMessageField,
  toEmailMessageRow,
} from "@/lib/xml/emailMessage";
import {
  getSequenceIntervalNodes,
  inferCommonAgencyId as inferCommonAgencyIdSequence,
  toSequenceIntervalRow,
  toSequenceRow,
} from "@/lib/xml/sequence";
import {
  getGuideSheetGroupNodes,
  inferCommonAgencyId as inferCommonAgencyIdCheckListGroup,
  toCheckListGroupRow,
  toGuideSheetGroupRow,
} from "@/lib/xml/checklistGroup";
import {
  getAppStatusGroupModelNodes,
  inferCommonAgencyId as inferCommonAgencyIdApplicationStatusGroup,
  toApplicationStatusGroupRow,
  toAppStatusGroupModelRow,
} from "@/lib/xml/applicationStatusGroup";
import {
  getStandardCommentModelNodes,
  inferCommonAgencyId as inferCommonAgencyIdCommentGroup,
  toCommentGroupRow,
  toStandardCommentModelRow,
} from "@/lib/xml/commentGroup";
import {
  getXTimeGroupTypeNodes,
  inferCommonAgencyId as inferCommonAgencyIdTimeGroup,
  toTimeGroupRow,
  toXTimeGroupTypeRow,
} from "@/lib/xml/timeGroup";
import {
  createTimeTypesNode,
  deleteTimeTypes,
  findTimeTypesByUid,
  inferCommonAgencyId as inferCommonAgencyIdTimeTypes,
  nextRefIdNumber as nextRefIdNumberTimeTypes,
  setTimeTypesField,
  toTimeTypesRow,
} from "@/lib/xml/timeTypes";
import {
  getInspectionResultGroupModelNodes,
  inferCommonAgencyId as inferCommonAgencyIdRefInspectionResultGroup,
  toInspectionResultGroupModelRow,
  toRefInspectionResultGroupRow,
} from "@/lib/xml/refInspectionResultGroup";
import {
  getLookupTableColumnNodes,
  getLookupTableValueNodes,
  inferCommonAgencyId as inferCommonAgencyIdRefLookupTable,
  toLookupTableColumnRow,
  toLookupTableValueRow,
  toRefLookupTableRow,
} from "@/lib/xml/refLookupTable";
import {
  getGuideSheetItemNodes,
  getGuideSheetItemStatusGroupNodes,
  inferCommonAgencyId as inferCommonAgencyIdGuideSheet,
  toGuideSheetItemRow,
  toGuideSheetItemStatusGroupRow,
  toGuideSheetRow,
} from "@/lib/xml/guideSheet";
import {
  getApoTemplateAttributeNodes,
  inferCommonAgencyId as inferCommonAgencyIdRAPOTemplate,
  toApoTemplateAttributeRow,
  toRAPOTemplateRow,
} from "@/lib/xml/rapoTemplate";
import {
  getSmartChoiceNodes,
  getSmartChoiceOptionNodes,
  inferCommonAgencyId as inferCommonAgencyIdSmartChoiceGroup,
  toSmartChoiceGroupRow,
  toSmartChoiceRow,
  toSmartChoiceOptionRow,
} from "@/lib/xml/smartChoiceGroup";
import {
  ARM_KEYS as STANDARD_COMMENT_GROUP_ARM_KEYS,
  getArmNodes as getStandardCommentGroupArmNodes,
  inferCommonAgencyId as inferCommonAgencyIdStandardCommentGroup,
  toStandardCommentGroupRow,
  toCommentGroupEntityRow,
} from "@/lib/xml/standardCommentGroup";
import {
  getArmNodes as getRefFeeScheduleArmNodes,
  inferCommonAgencyId as inferCommonAgencyIdRefFeeSchedule,
  toRefFeeScheduleRow,
  toRefFeeItemRow,
  toFeeScheduleModuleRow,
} from "@/lib/xml/refFeeSchedule";
import {
  getArmNodes as getVirProcessArmNodes,
  inferCommonAgencyId as inferCommonAgencyIdVirProcess,
  toVirProcessRow,
  toProcessTaskRow,
  toProcessEmailSettingRow,
  toActivityStatusRow,
} from "@/lib/xml/virProcess";
import {
  getASIFieldNodes,
  getASIDropdownValueNodes,
  inferCommonAgencyId as inferCommonAgencyIdASIGroup,
  toASIGroupRow,
  toASIFieldRow,
  toASIDropdownValueRow,
} from "@/lib/xml/asiGroup";
import {
  createCapTypeNode,
  deleteCapType,
  findCapTypeByUid,
  inferCommonAgencyId as inferCommonAgencyIdCapType,
  nextRefIdNumber as nextRefIdNumberCapType,
  setCapTypeField,
  toCapTypeRow,
} from "@/lib/xml/capType";
import {
  getFormLayoutElementNodes,
  inferCommonAgencyId as inferCommonAgencyIdFormLayoutEditor,
  toFormLayoutScreenRow,
  toFormLayoutElementRow,
} from "@/lib/xml/formLayoutEditor";
import {
  getInspectionTypeNodes,
  inferCommonAgencyId as inferCommonAgencyIdInspectionGroup,
  toInspectionGroupRow,
  toInspectionTypeRow,
} from "@/lib/xml/inspectionGroup";
import {
  getXDocEntityTypeNodes,
  inferCommonAgencyId as inferCommonAgencyIdRefDocument,
  toRefDocumentRow,
  toXDocEntityTypeRow,
} from "@/lib/xml/refDocument";
import { detectSensitiveEntries } from "@/lib/sensitiveFiles";
import { exportZipInWorker, parseZipInWorker } from "@/lib/worker/client";
import type {
  ApplicationStatusGroupZipEntry,
  CheckListGroupZipEntry,
  CommentGroupZipEntry,
  EmailMessageZipEntry,
  GuideSheetZipEntry,
  InspRelateInspZipEntry,
  OrganizationAgencyZipEntry,
  ParseZipResult,
  RAPOTemplateZipEntry,
  RefAddressTypeGroupZipEntry,
  RefInspectionResultGroupZipEntry,
  RefLookupTableZipEntry,
  ReferenceMaskZipEntry,
  SequenceZipEntry,
  SharedDropDownZipEntry,
  SmartChoiceGroupZipEntry,
  StandardChoiceZipEntry,
  StandardCommentGroupZipEntry,
  RefFeeScheduleZipEntry,
  VirProcessZipEntry,
  ASIGroupZipEntry,
  CapTypeZipEntry,
  FormLayoutEditorZipEntry,
  InspectionGroupZipEntry,
  RefDocumentZipEntry,
  DepartmentTypeZipEntry,
  ConditionsZipEntry,
  ExpressionBuilderZipEntry,
  TimeGroupZipEntry,
  TimeTypesZipEntry,
  ZipEntryData,
} from "@/lib/types";

/** Every grid component exposes exactly this shape via forwardRef — a
 * shared structural type lets page.tsx hold one ref regardless of which
 * category's grid is currently mounted. */
interface GridHandle {
  applyAgencyIdToAll: (value: string) => void;
}

type EditableZipEntry =
  | StandardChoiceZipEntry
  | SharedDropDownZipEntry
  | OrganizationAgencyZipEntry
  | InspRelateInspZipEntry
  | RefAddressTypeGroupZipEntry
  | ReferenceMaskZipEntry
  | EmailMessageZipEntry
  | SequenceZipEntry
  | CheckListGroupZipEntry
  | ApplicationStatusGroupZipEntry
  | CommentGroupZipEntry
  | TimeGroupZipEntry
  | TimeTypesZipEntry
  | RefInspectionResultGroupZipEntry
  | RefLookupTableZipEntry
  | GuideSheetZipEntry
  | RAPOTemplateZipEntry
  | SmartChoiceGroupZipEntry
  | StandardCommentGroupZipEntry
  | RefFeeScheduleZipEntry
  | VirProcessZipEntry
  | ASIGroupZipEntry
  | CapTypeZipEntry
  | FormLayoutEditorZipEntry
  | InspectionGroupZipEntry
  | RefDocumentZipEntry
  | DepartmentTypeZipEntry
  | ConditionsZipEntry
  | ExpressionBuilderZipEntry;

function isEditableEntry(entry: ZipEntryData): entry is EditableZipEntry {
  return (
    entry.kind === "standardChoice" ||
    entry.kind === "sharedDropDown" ||
    entry.kind === "organizationAgency" ||
    entry.kind === "inspRelateInsp" ||
    entry.kind === "refAddressTypeGroup" ||
    entry.kind === "referenceMask" ||
    entry.kind === "emailMessage" ||
    entry.kind === "sequence" ||
    entry.kind === "checklistGroup" ||
    entry.kind === "applicationStatusGroup" ||
    entry.kind === "commentGroup" ||
    entry.kind === "timeGroup" ||
    entry.kind === "timeTypes" ||
    entry.kind === "refInspectionResultGroup" ||
    entry.kind === "refLookupTable" ||
    entry.kind === "guideSheet" ||
    entry.kind === "rapoTemplate" ||
    entry.kind === "smartChoiceGroup" ||
    entry.kind === "standardCommentGroup" ||
    entry.kind === "refFeeSchedule" ||
    entry.kind === "virProcess" ||
    entry.kind === "asiGroup" ||
    entry.kind === "capType" ||
    entry.kind === "formLayoutEditor" ||
    entry.kind === "inspectionGroup" ||
    entry.kind === "refDocument" ||
    entry.kind === "departmentType" ||
    entry.kind === "conditions" ||
    entry.kind === "expressionBuilder"
  );
}

/** Dispatches to the right model's Agency ID field per entry kind — see the
 * per-model field-name-variance note in lib/xml/sharedDropDownList.ts. */
function inferAgencyIdForEntry(entry: EditableZipEntry): string {
  switch (entry.kind) {
    case "standardChoice":
      return inferCommonAgencyIdStandardChoice(entry.records.map(toStandardChoiceRow));
    case "sharedDropDown":
      return inferCommonAgencyIdSharedDropDown(entry.records.map(toSharedDropDownRow));
    case "organizationAgency":
      return inferCommonAgencyIdOrgAgency(entry.records.map(toOrganizationAgencyRow));
    case "inspRelateInsp":
      return inferCommonAgencyIdInspRelateInsp(entry.records.map(toInspRelateInspRow));
    case "refAddressTypeGroup":
      return inferCommonAgencyIdRefAddressTypeGroup(entry.records.map(toRefAddressTypeGroupRow));
    case "referenceMask":
      return inferCommonAgencyIdReferenceMask(entry.records.map(toReferenceMaskRow));
    case "emailMessage":
      return inferCommonAgencyIdEmailMessage(entry.records.map(toEmailMessageRow));
    case "sequence":
      return inferCommonAgencyIdSequence(entry.records.map(toSequenceRow));
    case "checklistGroup":
      return inferCommonAgencyIdCheckListGroup(entry.records.map(toCheckListGroupRow));
    case "applicationStatusGroup":
      return inferCommonAgencyIdApplicationStatusGroup(
        entry.records.map(toApplicationStatusGroupRow)
      );
    case "commentGroup":
      return inferCommonAgencyIdCommentGroup(entry.records.map(toCommentGroupRow));
    case "timeGroup":
      return inferCommonAgencyIdTimeGroup(entry.records.map(toTimeGroupRow));
    case "timeTypes":
      return inferCommonAgencyIdTimeTypes(entry.records.map(toTimeTypesRow));
    case "refInspectionResultGroup":
      return inferCommonAgencyIdRefInspectionResultGroup(
        entry.records.map(toRefInspectionResultGroupRow)
      );
    case "refLookupTable":
      return inferCommonAgencyIdRefLookupTable(entry.records.map(toRefLookupTableRow));
    case "guideSheet":
      return inferCommonAgencyIdGuideSheet(entry.records.map(toGuideSheetRow));
    case "rapoTemplate":
      return inferCommonAgencyIdRAPOTemplate(entry.records.map(toRAPOTemplateRow));
    case "smartChoiceGroup":
      return inferCommonAgencyIdSmartChoiceGroup(entry.records.map(toSmartChoiceGroupRow));
    case "standardCommentGroup":
      return inferCommonAgencyIdStandardCommentGroup(entry.records.map(toStandardCommentGroupRow));
    case "refFeeSchedule":
      return inferCommonAgencyIdRefFeeSchedule(entry.records.map(toRefFeeScheduleRow));
    case "virProcess":
      return inferCommonAgencyIdVirProcess(entry.records.map(toVirProcessRow));
    case "asiGroup":
      return inferCommonAgencyIdASIGroup(entry.records.map(toASIGroupRow));
    case "capType":
      return inferCommonAgencyIdCapType(entry.records.map(toCapTypeRow));
    case "formLayoutEditor":
      return inferCommonAgencyIdFormLayoutEditor(entry.records.map(toFormLayoutScreenRow));
    case "inspectionGroup":
      return inferCommonAgencyIdInspectionGroup(entry.records.map(toInspectionGroupRow));
    case "refDocument":
      return inferCommonAgencyIdRefDocument(entry.records.map(toRefDocumentRow));
    case "departmentType":
      return inferCommonAgencyIdDepartmentType(entry.records.map(toDepartmentTypeRow));
    case "conditions":
      return inferCommonAgencyIdConditions(entry.records.map(toConditionRow));
    case "expressionBuilder":
      return inferCommonAgencyIdExpressionBuilder(entry.records.map(toExpressionRow));
  }
}

const THEME_STORAGE_KEY = "importease-theme";

// Every buildable category (see category-catalog.md) — only ones this app
// can actually create/edit are listed, so "start new file" always produces
// a working grid. ACA Configuration, Agency Group, and Ref Calendar are
// excluded for data/architecture reasons documented at each of their
// DETECTORS/module call sites; User/User Profiles are excluded by explicit
// user decision, since unlike every other flagged category (which embeds
// security *references*), these files carry the credential-tier data
// itself — real hashed passwords and login metadata. Data Manager Version
// (tooling metadata, not editable config) and Workflow (confirmed
// view/pass-through only, never editable — see architecture-and-safety-
// update.md) were never in scope, since neither is ever a "start blank and
// fill in" target.
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "applicationStatusGroup", label: "Application Status Group" },
  { value: "asiGroup", label: "ASI Groups" },
  { value: "capType", label: "Cap Type" },
  { value: "checklistGroup", label: "Checklist Group" },
  { value: "commentGroup", label: "Comment Group" },
  { value: "conditions", label: "Conditions" },
  { value: "departmentType", label: "Department Type" },
  { value: "emailMessage", label: "Email Message" },
  { value: "expressionBuilder", label: "Expression Builder" },
  { value: "formLayoutEditor", label: "Form Layout Editor" },
  { value: "guideSheet", label: "Guide Sheet" },
  { value: "inspRelateInsp", label: "Insp Relate Insp" },
  { value: "inspectionGroup", label: "Inspection Group" },
  { value: "organizationAgency", label: "Organization/Agency" },
  { value: "rapoTemplate", label: "RAPO Template" },
  { value: "refAddressTypeGroup", label: "Ref Address Type Group" },
  { value: "refDocument", label: "Ref Document" },
  { value: "refFeeSchedule", label: "Ref Fee Schedule" },
  { value: "refInspectionResultGroup", label: "Ref Inspection Result Group" },
  { value: "refLookupTable", label: "Ref Lookup Table" },
  { value: "referenceMask", label: "Reference Mask" },
  { value: "sequence", label: "Sequence" },
  { value: "sharedDropDown", label: "Shared Drop-down List" },
  { value: "smartChoiceGroup", label: "Smart Choice Group" },
  { value: "standardChoice", label: "Standard Choice" },
  { value: "standardCommentGroup", label: "Standard Comment Group" },
  { value: "timeGroup", label: "Time Group" },
  { value: "timeTypes", label: "Time Types" },
  { value: "virProcess", label: "Virtual Process" },
];

// Fields the schema doc (docs/schema-standard-choice.md) marks "always" —
// required before export can proceed, same treatment as the required
// Agency ID field.
function validateStandardChoiceEntries(entries: StandardChoiceZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toStandardChoiceRow(record);
      if (!row.name.trim()) {
        return `"${entry.path}" has a Standard Choice with no Name set — every Standard Choice needs a Name before export.`;
      }
      for (const valueNode of getStandardChoiceValueNodes(record)) {
        const valueRow = toStandardChoiceValueRow(valueNode);
        if (!valueRow.value.trim()) {
          return `"${entry.path}" — "${row.name || "(unnamed)"}" has a value with no Value set — every value needs a Value before export.`;
        }
      }
    }
  }
  return null;
}

function makeBlankStandardChoiceEntry(): StandardChoiceZipEntry {
  return {
    path: "StandardChoiceModel.xml",
    kind: "standardChoice",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankSharedDropDownEntry(): SharedDropDownZipEntry {
  return {
    path: "SharedDropDownListModel.xml",
    kind: "sharedDropDown",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankOrganizationAgencyEntry(): OrganizationAgencyZipEntry {
  return {
    path: "OrganizationAgencyModel.xml",
    kind: "organizationAgency",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankInspRelateInspEntry(): InspRelateInspZipEntry {
  return {
    path: "InspRelateInspModel.xml",
    kind: "inspRelateInsp",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankRefAddressTypeGroupEntry(): RefAddressTypeGroupZipEntry {
  return {
    path: "RefAddressTypeGroupModel.xml",
    kind: "refAddressTypeGroup",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

// Fields the schema doc marks "always" on sharedDropDownListModel/
// sharedDropDownValue — required before export, same treatment as Standard
// Choice's Name/Value requirement.
function validateSharedDropDownEntries(entries: SharedDropDownZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toSharedDropDownRow(record);
      if (!row.name.trim()) {
        return `"${entry.path}" has a Shared Drop-down List with no Name set — every list needs a Name before export.`;
      }
      for (const valueNode of getSharedDropDownValueNodes(record)) {
        const valueRow = toSharedDropDownValueRow(valueNode);
        if (!valueRow.bizdomainValue.trim()) {
          return `"${entry.path}" — "${row.name || "(unnamed)"}" has a value with no Value set — every value needs a Value before export.`;
        }
      }
    }
  }
  return null;
}

function validateOrganizationAgencyEntries(entries: OrganizationAgencyZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toOrganizationAgencyRow(record);
      if (!row.agencyCode.trim()) {
        return `"${entry.path}" has an Organization/Agency row with no Agency Code set — every row needs an Agency Code before export.`;
      }
    }
  }
  return null;
}

function validateInspRelateInspEntries(entries: InspRelateInspZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toInspRelateInspRow(record);
      if (!row.type.trim()) {
        return `"${entry.path}" has an Insp Relate Insp row with no Type set — every row needs a Type before export.`;
      }
    }
  }
  return null;
}

function validateRefAddressTypeGroupEntries(entries: RefAddressTypeGroupZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toRefAddressTypeGroupRow(record);
      if (!row.addrGroup.trim()) {
        return `"${entry.path}" has an Address Type Group with no Address Group set — every group needs a name before export.`;
      }
      for (const typeNode of getRefAddressTypeNodes(record)) {
        const typeRow = toRefAddressTypeRow(typeNode);
        if (!typeRow.addrType.trim()) {
          return `"${entry.path}" — "${row.addrGroup}" has an address type with no Address Type set — every type needs one before export.`;
        }
      }
    }
  }
  return null;
}

function makeBlankReferenceMaskEntry(): ReferenceMaskZipEntry {
  return {
    path: "ReferenceMaskModel.xml",
    kind: "referenceMask",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankEmailMessageEntry(): EmailMessageZipEntry {
  return {
    path: "EmailMessageModel.xml",
    kind: "emailMessage",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankSequenceEntry(): SequenceZipEntry {
  return {
    path: "SequenceModel.xml",
    kind: "sequence",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankCheckListGroupEntry(): CheckListGroupZipEntry {
  return {
    path: "CheckListGroupModel.xml",
    kind: "checklistGroup",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankApplicationStatusGroupEntry(): ApplicationStatusGroupZipEntry {
  return {
    path: "ApplicationStatusGroupModel.xml",
    kind: "applicationStatusGroup",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankCommentGroupEntry(): CommentGroupZipEntry {
  return {
    path: "CommentGroupModel.xml",
    kind: "commentGroup",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankTimeGroupEntry(): TimeGroupZipEntry {
  return {
    path: "TimeGroupModel.xml",
    kind: "timeGroup",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankTimeTypesEntry(): TimeTypesZipEntry {
  return {
    path: "TimeTypesModel.xml",
    kind: "timeTypes",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankRefInspectionResultGroupEntry(): RefInspectionResultGroupZipEntry {
  return {
    path: "RefInspectionResultGroupModel.xml",
    kind: "refInspectionResultGroup",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankRefLookupTableEntry(): RefLookupTableZipEntry {
  return {
    path: "RefLookupTableModel.xml",
    kind: "refLookupTable",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankGuideSheetEntry(): GuideSheetZipEntry {
  return {
    path: "GuideSheetModel.xml",
    kind: "guideSheet",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankRAPOTemplateEntry(): RAPOTemplateZipEntry {
  return {
    path: "RAPOTemplateModel.xml",
    kind: "rapoTemplate",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankSmartChoiceGroupEntry(): SmartChoiceGroupZipEntry {
  return {
    path: "SmartChoiceGroupModel.xml",
    kind: "smartChoiceGroup",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankStandardCommentGroupEntry(): StandardCommentGroupZipEntry {
  return {
    path: "StandardCommentGroupModel.xml",
    kind: "standardCommentGroup",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankRefFeeScheduleEntry(): RefFeeScheduleZipEntry {
  return {
    path: "RefFeeScheduleModel.xml",
    kind: "refFeeSchedule",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankVirProcessEntry(): VirProcessZipEntry {
  return {
    path: "VirProcessModel.xml",
    kind: "virProcess",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankASIGroupEntry(): ASIGroupZipEntry {
  return {
    path: "ASIGroupModel.xml",
    kind: "asiGroup",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankCapTypeEntry(): CapTypeZipEntry {
  return {
    path: "CapTypeModel.xml",
    kind: "capType",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankFormLayoutEditorEntry(): FormLayoutEditorZipEntry {
  return {
    path: "FormLayoutEditorModel.xml",
    kind: "formLayoutEditor",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankInspectionGroupEntry(): InspectionGroupZipEntry {
  return {
    path: "InspectionGroupModel.xml",
    kind: "inspectionGroup",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankRefDocumentEntry(): RefDocumentZipEntry {
  return {
    path: "RefDocumentModel.xml",
    kind: "refDocument",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankDepartmentTypeEntry(): DepartmentTypeZipEntry {
  return {
    path: "DepartMentTypeModel.xml",
    kind: "departmentType",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankConditionsEntry(): ConditionsZipEntry {
  return {
    path: "ConditionsModel.xml",
    kind: "conditions",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function makeBlankExpressionBuilderEntry(): ExpressionBuilderZipEntry {
  return {
    path: "RefExpressionModel.xml",
    kind: "expressionBuilder",
    listAttrs: {
      version: "9.0.0",
      minorVersion: "26",
      exportUser: "",
      exportDateTime: "",
      description: "null",
    },
    records: [],
  };
}

function validateReferenceMaskEntries(entries: ReferenceMaskZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toReferenceMaskRow(record);
      if (!row.name.trim()) {
        return `"${entry.path}" has a Reference Mask with no Name set — every mask needs a Name before export.`;
      }
    }
  }
  return null;
}

function validateEmailMessageEntries(entries: EmailMessageZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toEmailMessageRow(record);
      if (!row.contentsCode.trim()) {
        return `"${entry.path}" has an Email Message with no Code set — every message needs a Code before export.`;
      }
    }
  }
  return null;
}

function validateSequenceEntries(entries: SequenceZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toSequenceRow(record);
      if (!row.name.trim()) {
        return `"${entry.path}" has a Sequence with no Name set — every sequence needs a Name before export.`;
      }
      for (const intervalNode of getSequenceIntervalNodes(record)) {
        const intervalRow = toSequenceIntervalRow(intervalNode);
        if (!intervalRow.intervalName.trim()) {
          return `"${entry.path}" — "${row.name}" has an interval with no Interval Name set — every interval needs one before export.`;
        }
      }
    }
  }
  return null;
}

function validateCheckListGroupEntries(entries: CheckListGroupZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toCheckListGroupRow(record);
      if (!row.guideGroup.trim()) {
        return `"${entry.path}" has a Checklist Group with no Guide Group set — every group needs a Guide Group before export.`;
      }
      for (const typeNode of getGuideSheetGroupNodes(record)) {
        const typeRow = toGuideSheetGroupRow(typeNode);
        if (!typeRow.guideType.trim()) {
          return `"${entry.path}" — "${row.guideGroup}" has a guide type with no Guide Type set — every type needs one before export.`;
        }
      }
    }
  }
  return null;
}

function validateApplicationStatusGroupEntries(
  entries: ApplicationStatusGroupZipEntry[]
): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toApplicationStatusGroupRow(record);
      if (!row.appStatusGroupCode.trim()) {
        return `"${entry.path}" has an Application Status Group with no Group Code set — every group needs a Group Code before export.`;
      }
      for (const statusNode of getAppStatusGroupModelNodes(record)) {
        const statusRow = toAppStatusGroupModelRow(statusNode);
        if (!statusRow.status.trim()) {
          return `"${entry.path}" — "${row.appStatusGroupCode}" has a status with no Status set — every status needs one before export.`;
        }
      }
    }
  }
  return null;
}

function validateCommentGroupEntries(entries: CommentGroupZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toCommentGroupRow(record);
      if (!row.commentType.trim()) {
        return `"${entry.path}" has a Comment Group with no Comment Type set — every group needs a Comment Type before export.`;
      }
      for (const commentNode of getStandardCommentModelNodes(record)) {
        const commentRow = toStandardCommentModelRow(commentNode);
        if (!commentRow.commentName.trim()) {
          return `"${entry.path}" — "${row.commentType}" has a comment with no Comment Name set — every comment needs one before export.`;
        }
      }
    }
  }
  return null;
}

function validateTimeGroupEntries(entries: TimeGroupZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toTimeGroupRow(record);
      if (!row.timeGroupName.trim()) {
        return `"${entry.path}" has a Time Group with no Time Group Name set — every group needs a name before export.`;
      }
    }
  }
  return null;
}

function validateTimeTypesEntries(entries: TimeTypesZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toTimeTypesRow(record);
      if (!row.timeTypeName.trim()) {
        return `"${entry.path}" has a Time Type with no Time Type Name set — every time type needs a name before export.`;
      }
    }
  }
  return null;
}

function validateRefInspectionResultGroupEntries(
  entries: RefInspectionResultGroupZipEntry[]
): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toRefInspectionResultGroupRow(record);
      if (!row.inspResultGroup.trim()) {
        return `"${entry.path}" has an Inspection Result Group with no Result Group set — every group needs a Result Group before export.`;
      }
      for (const resultNode of getInspectionResultGroupModelNodes(record)) {
        const resultRow = toInspectionResultGroupModelRow(resultNode);
        if (!resultRow.inspResult.trim()) {
          return `"${entry.path}" — "${row.inspResultGroup}" has a result with no Result set — every result needs one before export.`;
        }
      }
    }
  }
  return null;
}

function validateRefLookupTableEntries(entries: RefLookupTableZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toRefLookupTableRow(record);
      if (!row.lookupTableName.trim()) {
        return `"${entry.path}" has a Lookup Table with no Table Name set — every table needs a Table Name before export.`;
      }
      for (const colNode of getLookupTableColumnNodes(record)) {
        const colRow = toLookupTableColumnRow(colNode);
        if (!colRow.lookupColumnName.trim()) {
          return `"${entry.path}" — "${row.lookupTableName}" has a column with no Column Name set — every column needs one before export.`;
        }
        for (const valNode of getLookupTableValueNodes(colNode)) {
          const valRow = toLookupTableValueRow(valNode);
          if (!valRow.lookupColumnValue.trim()) {
            return `"${entry.path}" — "${row.lookupTableName}" / "${colRow.lookupColumnName}" has a value with no Value set — every value needs one before export.`;
          }
        }
      }
    }
  }
  return null;
}

function validateGuideSheetEntries(entries: GuideSheetZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toGuideSheetRow(record);
      if (!row.guideType.trim()) {
        return `"${entry.path}" has a Guide Sheet with no Guide Type set — every sheet needs a Guide Type before export.`;
      }
      for (const itemNode of getGuideSheetItemNodes(record)) {
        const itemRow = toGuideSheetItemRow(itemNode);
        if (!itemRow.guideItemText.trim()) {
          return `"${entry.path}" — "${row.guideType}" has an item with no Item Text set — every item needs one before export.`;
        }
        for (const sgNode of getGuideSheetItemStatusGroupNodes(itemNode)) {
          const sgRow = toGuideSheetItemStatusGroupRow(sgNode);
          if (!sgRow.ststus.trim()) {
            return `"${entry.path}" — "${row.guideType}" / "${itemRow.guideItemText}" has a status group with no Status set — every status group needs one before export.`;
          }
        }
      }
    }
  }
  return null;
}

function validateRAPOTemplateEntries(entries: RAPOTemplateZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toRAPOTemplateRow(record);
      if (!row.templateName.trim()) {
        return `"${entry.path}" has a RAPO Template with no Template Name set — every template needs a Template Name before export.`;
      }
      for (const attrNode of getApoTemplateAttributeNodes(record)) {
        const attrRow = toApoTemplateAttributeRow(attrNode);
        if (!attrRow.attributeName.trim()) {
          return `"${entry.path}" — "${row.templateName}" has an attribute with no Attribute Name set — every attribute needs one before export.`;
        }
      }
    }
  }
  return null;
}

function validateSmartChoiceGroupEntries(entries: SmartChoiceGroupZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toSmartChoiceGroupRow(record);
      if (!row.groupCode.trim()) {
        return `"${entry.path}" has a Smart Choice Group with no Group Code set — every group needs a Group Code before export.`;
      }
      for (const choiceNode of getSmartChoiceNodes(record)) {
        const choiceRow = toSmartChoiceRow(choiceNode);
        if (!choiceRow.functionName.trim()) {
          return `"${entry.path}" — "${row.groupCode}" has a smart choice with no Function Name set — every smart choice needs one before export.`;
        }
        for (const optNode of getSmartChoiceOptionNodes(choiceNode)) {
          const optRow = toSmartChoiceOptionRow(optNode);
          if (!optRow.functionOption.trim()) {
            return `"${entry.path}" — "${row.groupCode}" / "${choiceRow.functionName}" has an option with no Function Option set — every option needs one before export.`;
          }
        }
      }
    }
  }
  return null;
}

function validateStandardCommentGroupEntries(
  entries: StandardCommentGroupZipEntry[]
): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toStandardCommentGroupRow(record);
      if (!row.groupName.trim()) {
        return `"${entry.path}" has a Standard Comment Group with no Group Name set — every group needs a Group Name before export.`;
      }
      for (const arm of STANDARD_COMMENT_GROUP_ARM_KEYS) {
        for (const entityNode of getStandardCommentGroupArmNodes(record, arm)) {
          const entityRow = toCommentGroupEntityRow(entityNode);
          if (!entityRow.entityData.trim()) {
            return `"${entry.path}" — "${row.groupName}" has an entry with no Entity Data set — every entry needs one before export.`;
          }
        }
      }
    }
  }
  return null;
}

function validateRefFeeScheduleEntries(entries: RefFeeScheduleZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toRefFeeScheduleRow(record);
      if (!row.feeScheduleName.trim()) {
        return `"${entry.path}" has a Fee Schedule with no Fee Schedule Name set — every schedule needs a name before export.`;
      }
      for (const itemNode of getRefFeeScheduleArmNodes(record, "item")) {
        const itemRow = toRefFeeItemRow(itemNode);
        if (!itemRow.feeCod.trim()) {
          return `"${entry.path}" — "${row.feeScheduleName}" has a fee item with no Fee Code set — every item needs one before export.`;
        }
      }
      for (const modNode of getRefFeeScheduleArmNodes(record, "module")) {
        const modRow = toFeeScheduleModuleRow(modNode);
        if (!modRow.moduleName.trim()) {
          return `"${entry.path}" — "${row.feeScheduleName}" has a module association with no Module Name set — every module needs one before export.`;
        }
      }
    }
  }
  return null;
}

function validateVirProcessEntries(entries: VirProcessZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toVirProcessRow(record);
      if (!row.r1ProcessCode.trim()) {
        return `"${entry.path}" has a Process with no Process Code set — every process needs a Process Code before export.`;
      }
      for (const taskNode of getVirProcessArmNodes(record, "task")) {
        const taskRow = toProcessTaskRow(taskNode);
        if (!taskRow.sdProDes.trim()) {
          return `"${entry.path}" — "${row.r1ProcessCode}" has a task with no Task Description set — every task needs one before export.`;
        }
      }
      for (const emailNode of getVirProcessArmNodes(record, "email")) {
        const emailRow = toProcessEmailSettingRow(emailNode);
        if (!emailRow.contentsCode.trim()) {
          return `"${entry.path}" — "${row.r1ProcessCode}" has an email setting with no Contents Code set — every email setting needs one before export.`;
        }
      }
      for (const statusNode of getVirProcessArmNodes(record, "status")) {
        const statusRow = toActivityStatusRow(statusNode);
        if (!statusRow.r3ActStatDes.trim()) {
          return `"${entry.path}" — "${row.r1ProcessCode}" has a status with no Status Description set — every status needs one before export.`;
        }
      }
    }
  }
  return null;
}

function validateASIGroupEntries(entries: ASIGroupZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toASIGroupRow(record);
      if (!row.appSpecInfoGroupCode.trim()) {
        return `"${entry.path}" has an ASI Group with no Group Code set — every group needs a Group Code before export.`;
      }
      for (const fieldNode of getASIFieldNodes(record)) {
        const fieldRow = toASIFieldRow(fieldNode);
        if (!fieldRow.r1CheckboxDesc.trim()) {
          return `"${entry.path}" — "${row.appSpecInfoGroupCode}" has an ASI field with no Field Description set — every field needs one before export.`;
        }
        for (const valueNode of getASIDropdownValueNodes(fieldNode)) {
          const valueRow = toASIDropdownValueRow(valueNode);
          if (!valueRow.value.trim()) {
            return `"${entry.path}" — "${row.appSpecInfoGroupCode}" / "${fieldRow.r1CheckboxDesc}" has a value with no Value set — every value needs one before export.`;
          }
        }
      }
    }
  }
  return null;
}

function validateCapTypeEntries(entries: CapTypeZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toCapTypeRow(record);
      if (!row.group.trim() || !row.type.trim()) {
        return `"${entry.path}" has a Cap Type with no Group and/or Type set — every record type needs a Group and Type before export.`;
      }
    }
  }
  return null;
}

function validateFormLayoutEditorEntries(entries: FormLayoutEditorZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toFormLayoutScreenRow(record);
      if (!row.screenName.trim()) {
        return `"${entry.path}" has a Screen with no Screen Name set — every screen needs a Screen Name before export.`;
      }
      for (const elementNode of getFormLayoutElementNodes(record)) {
        const elementRow = toFormLayoutElementRow(elementNode);
        if (!elementRow.screenElementName.trim()) {
          return `"${entry.path}" — "${row.screenName}" has an element with no Element Name set — every element needs one before export.`;
        }
      }
    }
  }
  return null;
}

function validateInspectionGroupEntries(entries: InspectionGroupZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toInspectionGroupRow(record);
      if (!row.inspGroupName.trim()) {
        return `"${entry.path}" has an Inspection Group with no Group Name set — every group needs a name before export.`;
      }
      for (const typeNode of getInspectionTypeNodes(record)) {
        const typeRow = toInspectionTypeRow(typeNode);
        if (!typeRow.inspType.trim()) {
          return `"${entry.path}" — "${row.inspGroupName}" has an inspection type with no Inspection Type set — every type needs one before export.`;
        }
      }
    }
  }
  return null;
}

function validateRefDocumentEntries(entries: RefDocumentZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toRefDocumentRow(record);
      if (!row.documentType.trim()) {
        return `"${entry.path}" has a Document with no Document Type set — every document needs a Document Type before export.`;
      }
      for (const entityTypeNode of getXDocEntityTypeNodes(record)) {
        const entityTypeRow = toXDocEntityTypeRow(entityTypeNode);
        if (!entityTypeRow.entType.trim()) {
          return `"${entry.path}" — "${row.documentType}" has an entity type with no Entity Type set — every entity type needs one before export.`;
        }
      }
    }
  }
  return null;
}

function validateDepartmentTypeEntries(entries: DepartmentTypeZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toDepartmentTypeRow(record);
      if (!row.departMentTypeName.trim()) {
        return `"${entry.path}" has a Department Type with no Department Type Name set — every row needs a name before export.`;
      }
    }
  }
  return null;
}

function validateConditionsEntries(entries: ConditionsZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toConditionRow(record);
      if (!row.conditionDesc.trim()) {
        return `"${entry.path}" has a Condition with no Condition Description set — every row needs a description before export.`;
      }
    }
  }
  return null;
}

function validateExpressionBuilderEntries(entries: ExpressionBuilderZipEntry[]): string | null {
  for (const entry of entries) {
    for (const record of entry.records) {
      const row = toExpressionRow(record);
      if (!row.expressionName.trim()) {
        return `"${entry.path}" has an Expression with no Expression Name set — every expression needs one before export.`;
      }
      for (const calcNode of getExpressionBuilderArmNodes(record, "calc")) {
        const calcRow = toExpressCalculationRow(calcNode);
        if (!calcRow.fieldName.trim()) {
          return `"${entry.path}" — "${row.expressionName}" has a calculation with no Field Name set — every calculation needs one before export.`;
        }
      }
      for (const criteriaNode of getExpressionBuilderArmNodes(record, "criteria")) {
        const criteriaRow = toExpressCriteriaRow(criteriaNode);
        if (!criteriaRow.fieldName.trim()) {
          return `"${entry.path}" — "${row.expressionName}" has a criteria entry with no Field Name set — every criteria entry needs one before export.`;
        }
      }
      for (const fieldNode of getExpressionBuilderArmNodes(record, "field")) {
        const fieldRow = toExpressFieldRow(fieldNode);
        if (!fieldRow.name.trim()) {
          return `"${entry.path}" — "${row.expressionName}" has a field with no Name set — every field needs one before export.`;
        }
      }
    }
  }
  return null;
}

function withZipExtension(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "export.zip";
  return /\.zip$/i.test(trimmed) ? trimmed : `${trimmed}.zip`;
}

/**
 * Merges a newly-uploaded/dropped zip's entries into the current session so
 * multiple zips can be combined and exported as one file. If an entry path
 * collides with one already in the session, the incoming one is suffixed
 * "(2)", "(3)", etc. rather than silently overwriting the existing entry.
 */
function mergeParseResults(base: ParseZipResult | null, addition: ParseZipResult): ParseZipResult {
  if (!base) return addition;
  const existingPaths = new Set(base.entries.map((e) => e.path));
  const mergedEntries = [...base.entries];
  for (const entry of addition.entries) {
    let path = entry.path;
    if (existingPaths.has(path)) {
      const dot = path.lastIndexOf(".");
      const stem = dot === -1 ? path : path.slice(0, dot);
      const ext = dot === -1 ? "" : path.slice(dot);
      let n = 2;
      let candidate = `${stem} (${n})${ext}`;
      while (existingPaths.has(candidate)) {
        n++;
        candidate = `${stem} (${n})${ext}`;
      }
      path = candidate;
    }
    existingPaths.add(path);
    mergedEntries.push(path === entry.path ? entry : { ...entry, path });
  }
  return { zipName: base.zipName, entries: mergedEntries };
}

// FlatGrid column config for the two truly-flat categories (see
// components/FlatGrid.tsx) — kept here, not in the lib modules, since it's
// purely a UI concern, same split StandardChoiceGrid/SharedDropDownGrid use.
const ORG_AGENCY_COLUMNS: FlatGridColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "agencyCode", headerName: "Agency Code", editable: true },
  { field: "agencyName", headerName: "Agency Name", editable: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
];

const INSP_RELATE_INSP_COLUMNS: FlatGridColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "type", headerName: "Type", editable: true },
  { field: "parentInspType", headerName: "Parent Insp Type", editable: true },
  { field: "childInspType", headerName: "Child Insp Type", editable: true },
  { field: "inspResult", headerName: "Insp Result", editable: true },
  { field: "inspResultGroup", headerName: "Result Group", editable: true },
  { field: "inAdvance", headerName: "In Advance", editable: true },
  { field: "intervalDay", headerName: "Interval Day", editable: true },
  { field: "isAuto", headerName: "Auto", editable: true },
  { field: "isRelated", headerName: "Related", editable: true },
  { field: "initDateType", headerName: "Init Date Type", editable: true },
  { field: "initStatus", headerName: "Init Status", editable: true },
  { field: "servProvCode", headerName: "Agency ID", editable: true, hide: true },
];

const REFERENCE_MASK_COLUMNS: FlatGridColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "name", headerName: "Name", editable: true },
  { field: "type", headerName: "Type", editable: true },
  { field: "description", headerName: "Description", editable: true },
  { field: "pattern", headerName: "Pattern", editable: true },
  { field: "maxLength", headerName: "Max Length", editable: true, hide: true },
  { field: "minLength", headerName: "Min Length", editable: true, hide: true },
  { field: "radixValue", headerName: "Radix", editable: true, hide: true },
  { field: "seqName", headerName: "Sequence Name", editable: true, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
];

const EMAIL_MESSAGE_COLUMNS: FlatGridColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "contentsCode", headerName: "Code", editable: true },
  { field: "contentsSubject", headerName: "Subject", editable: true },
  { field: "contentsType", headerName: "Type", editable: true },
  { field: "contentsBody", headerName: "Body", editable: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
];

const TIME_TYPES_COLUMNS: FlatGridColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "timeTypeName", headerName: "Time Type Name", editable: true },
  { field: "recordType", headerName: "Record Type", editable: true },
  { field: "billableFlag", headerName: "Billable", editable: true },
  { field: "defaultRate", headerName: "Default Rate", editable: true },
  { field: "defaultPctAdj", headerName: "Default % Adj", editable: true, hide: true },
  { field: "r1PerCategory", headerName: "Category", editable: true, hide: true },
  { field: "r1PerGroup", headerName: "Group", editable: true, hide: true },
  { field: "r1PerSubType", headerName: "Sub Type", editable: true, hide: true },
  { field: "r1PerType", headerName: "Type", editable: true, hide: true },
  { field: "timeTypeSeq", headerName: "Time Type Seq #", editable: true, hide: true },
  { field: "servProvCode", headerName: "Agency ID", editable: true, hide: true },
];

const CAP_TYPE_COLUMNS: FlatGridColumnMeta[] = [
  { field: "refId", headerName: "Ref ID", editable: false, hide: true },
  { field: "group", headerName: "Group", editable: true },
  { field: "type", headerName: "Type", editable: true },
  { field: "subType", headerName: "Sub Type", editable: true },
  { field: "category", headerName: "Category", editable: true },
  { field: "alias", headerName: "Alias", editable: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "moduleName", headerName: "Module", editable: true, hide: true },
  { field: "processCode", headerName: "Process Code", editable: true, hide: true },
  { field: "feeScheduleName", headerName: "Fee Schedule", editable: true, hide: true },
  { field: "smartChoiceCode", headerName: "Smart Choice Group", editable: true, hide: true },
  { field: "specInfoCode", headerName: "ASI Group", editable: true, hide: true },
  { field: "docCode", headerName: "Document Code", editable: true, hide: true },
  { field: "inspectionGroupCode", headerName: "Inspection Group", editable: true, hide: true },
  { field: "appStatusGroupCode", headerName: "App Status Group", editable: true, hide: true },
  { field: "defaultCapStatus", headerName: "Default Status", editable: true, hide: true },
  { field: "expirationCode", headerName: "Expiration Code", editable: true, hide: true },
  { field: "addrGroup", headerName: "Address Group", editable: true, hide: true },
  { field: "asChildOnly", headerName: "As Child Only", editable: true, hide: true },
  { field: "isRenewalOverride", headerName: "Renewal Override", editable: true, hide: true },
  { field: "isSearchable", headerName: "Searchable", editable: true, hide: true },
  { field: "isCloneOptionSelected", headerName: "Clone Option", editable: true, hide: true },
  {
    field: "isCheckedLiscenedVerification",
    headerName: "License Verification",
    editable: true,
    hide: true,
  },
  { field: "udCode3", headerName: "UD Code 3", editable: true, hide: true },
  { field: "resId", headerName: "Res ID", editable: true, hide: true },
];

const DEPARTMENT_TYPE_COLUMNS: FlatGridColumnMeta[] = [
  { field: "departMentTypeName", headerName: "Department Type Name", editable: true },
  { field: "agencyCode", headerName: "Agency Code", editable: true, hide: true },
  { field: "bureauCode", headerName: "Bureau Code", editable: true, hide: true },
  { field: "divisionCode", headerName: "Division Code", editable: true, hide: true },
  { field: "groupCode", headerName: "Group Code", editable: true, hide: true },
  { field: "officeCode", headerName: "Office Code", editable: true, hide: true },
  { field: "sectionCode", headerName: "Section Code", editable: true, hide: true },
  { field: "subgroupCode", headerName: "Subgroup Code", editable: true, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "subGroupDescription", headerName: "Subgroup Description", editable: true, hide: true },
  { field: "departMentTypeKey", headerName: "Department Type Key", editable: false, hide: true },
];

const CONDITIONS_COLUMNS: FlatGridColumnMeta[] = [
  { field: "conditionDesc", headerName: "Condition Description", editable: true },
  { field: "conditionNbr", headerName: "Condition #", editable: false, hide: true },
  { field: "conditionComment", headerName: "Comment", editable: true, hide: true },
  { field: "conditionGroup", headerName: "Group", editable: true, hide: true },
  { field: "conditionType", headerName: "Type", editable: true, hide: true },
  { field: "serviceProviderCode", headerName: "Agency ID", editable: true, hide: true },
  { field: "conditionApproveFlag", headerName: "Approve Flag", editable: true, hide: true },
  { field: "impactCode", headerName: "Impact Code", editable: true, hide: true },
  { field: "displayConditionNotice", headerName: "Display Notice", editable: true, hide: true },
  { field: "displayNoticeOnACA", headerName: "Display Notice on ACA", editable: true, hide: true },
  {
    field: "displayNoticeOnACAFee",
    headerName: "Display Notice on ACA Fee",
    editable: true,
    hide: true,
  },
  { field: "includeInConditionName", headerName: "Include in Cond. Name", editable: true, hide: true },
  {
    field: "includeInShortDescription",
    headerName: "Include in Short Desc.",
    editable: true,
    hide: true,
  },
  { field: "inheritable", headerName: "Inheritable", editable: true, hide: true },
  { field: "isInspectionSelected", headerName: "Inspection Selected", editable: true, hide: true },
  { field: "isPermissionSelected", headerName: "Permission Selected", editable: true, hide: true },
  { field: "isRecordTypesSelected", headerName: "Record Types Selected", editable: true, hide: true },
  { field: "isWorkflowSelected", headerName: "Workflow Selected", editable: true, hide: true },
];

export default function Home() {
  const [zipResult, setZipResult] = useState<ParseZipResult | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [savedVisible, setSavedVisible] = useState(false);
  const [exportZipName, setExportZipName] = useState("");
  const [agencyId, setAgencyId] = useState("");
  // Per-file Keep/Remove choice for detected sensitive files (User/Group/
  // Security data) — required before export, see architecture-and-safety-
  // update.md. Keyed by entry path; re-derived fresh from zipResult.entries
  // on every render (not a one-time flag from parse) so it also applies if
  // a blank-file session somehow ends up including one of these files.
  const [sensitiveDecisions, setSensitiveDecisions] = useState<Record<string, "keep" | "remove">>({});
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<GridHandle>(null);
  const agencyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [accessBlockedReason, setAccessBlockedReason] = useState<"expired" | "pending" | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Safety net for sessions that were already active when the account
  // expired/got force-expired, or a self-signup account that's still
  // pending — the sign-in-time check in AuthModal only catches these at
  // the moment of login.
  useEffect(() => {
    if (!session?.user || session.user.email === ADMIN_EMAIL) {
      setAccessBlockedReason(null);
      return;
    }
    let cancelled = false;
    checkSubscriptionStatus(session.user.id).then((status) => {
      if (cancelled) return;
      setAccessBlockedReason(status === "expired" ? "expired" : status === "pending" ? "pending" : null);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  // Everything lives in memory only (no persistence, by design — see
  // CLAUDE.md) — closing or reloading the tab loses whatever hasn't been
  // exported yet. Warn before that happens. Browsers show their own fixed
  // wording here; the returnValue/preventDefault pair is what triggers
  // that native prompt, custom text isn't supported by any modern browser.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!zipResult) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [zipResult]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const handleDataChange = useCallback(() => {
    setSavedVisible(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedVisible(false), 1200);
  }, []);

  const loadEntries = useCallback((result: ParseZipResult) => {
    setZipResult(result);
    setExportZipName(result.zipName);
    setSensitiveDecisions({});
    const firstEditable = result.entries.find(isEditableEntry);
    setActivePath(firstEditable?.path ?? null);
    setAgencyId(firstEditable ? inferAgencyIdForEntry(firstEditable) : "");
  }, []);

  // Uploading/dropping additional zip(s) while a session is already open
  // merges into it (see mergeParseResults) rather than replacing it, so
  // multiple exports can be combined and exported as one file. A fresh
  // upload with nothing loaded yet is just a merge onto an empty session.
  const processFiles = useCallback(
    async (files: File[]) => {
      const zipFiles = files.filter((f) => f.name.toLowerCase().endsWith(".zip"));
      if (zipFiles.length === 0) {
        setError("Please choose a .zip file (an Accela Configuration Manager export).");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let merged = zipResult;
        for (const file of zipFiles) {
          const parsed = await parseZipInWorker(file);
          merged = mergeParseResults(merged, parsed);
        }
        if (merged) loadEntries(merged);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [loadEntries, zipResult]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) await processFiles(files);
      e.target.value = "";
    },
    [processFiles]
  );

  // Page-wide drag-and-drop, in addition to the Upload button. dragDepth
  // (rather than a plain boolean) survives dragenter/dragleave firing on
  // nested children as the cursor moves across the page.
  const [dragDepth, setDragDepth] = useState(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragDepth((d) => d + 1);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragDepth((d) => Math.max(0, d - 1));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setDragDepth(0);
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length) processFiles(files);
    },
    [processFiles]
  );

  const handleNewFile = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const category = e.target.value;
      e.target.value = "";
      const blankEntry =
        category === "standardChoice"
          ? makeBlankStandardChoiceEntry()
          : category === "sharedDropDown"
            ? makeBlankSharedDropDownEntry()
            : category === "organizationAgency"
              ? makeBlankOrganizationAgencyEntry()
              : category === "inspRelateInsp"
                ? makeBlankInspRelateInspEntry()
                : category === "refAddressTypeGroup"
                  ? makeBlankRefAddressTypeGroupEntry()
                  : category === "referenceMask"
                    ? makeBlankReferenceMaskEntry()
                    : category === "emailMessage"
                      ? makeBlankEmailMessageEntry()
                      : category === "sequence"
                        ? makeBlankSequenceEntry()
                        : category === "checklistGroup"
                          ? makeBlankCheckListGroupEntry()
                          : category === "applicationStatusGroup"
                            ? makeBlankApplicationStatusGroupEntry()
                            : category === "commentGroup"
                              ? makeBlankCommentGroupEntry()
                              : category === "timeGroup"
                                ? makeBlankTimeGroupEntry()
                                : category === "timeTypes"
                                  ? makeBlankTimeTypesEntry()
                                  : category === "refInspectionResultGroup"
                                    ? makeBlankRefInspectionResultGroupEntry()
                                    : category === "refLookupTable"
                                      ? makeBlankRefLookupTableEntry()
                                      : category === "guideSheet"
                                        ? makeBlankGuideSheetEntry()
                                        : category === "rapoTemplate"
                                          ? makeBlankRAPOTemplateEntry()
                                          : category === "smartChoiceGroup"
                                            ? makeBlankSmartChoiceGroupEntry()
                                            : category === "standardCommentGroup"
                                              ? makeBlankStandardCommentGroupEntry()
                                              : category === "refFeeSchedule"
                                                ? makeBlankRefFeeScheduleEntry()
                                                : category === "virProcess"
                                                  ? makeBlankVirProcessEntry()
                                                  : category === "asiGroup"
                                                    ? makeBlankASIGroupEntry()
                                                    : category === "capType"
                                                      ? makeBlankCapTypeEntry()
                                                      : category === "formLayoutEditor"
                                                        ? makeBlankFormLayoutEditorEntry()
                                                        : category === "inspectionGroup"
                                                          ? makeBlankInspectionGroupEntry()
                                                          : category === "refDocument"
                                                            ? makeBlankRefDocumentEntry()
                                                            : category === "departmentType"
                                                              ? makeBlankDepartmentTypeEntry()
                                                              : category === "conditions"
                                                                ? makeBlankConditionsEntry()
                                                                : category === "expressionBuilder"
                                                                  ? makeBlankExpressionBuilderEntry()
                                                                  : null;
      if (!blankEntry) return;
      if (
        zipResult &&
        !window.confirm("Start a new blank file? Unsaved changes in the current file will be lost.")
      ) {
        return;
      }
      setError(null);
      loadEntries({ zipName: "new-export.zip", entries: [blankEntry] });
    },
    [zipResult, loadEntries]
  );

  // Uploads/drops now merge into the current session rather than replacing
  // it (see mergeParseResults), so there needs to be an explicit way back
  // to a clean slate.
  const handleClear = useCallback(() => {
    if (
      zipResult &&
      !window.confirm("Clear this session? All data will be cleared and cannot be recovered.")
    ) {
      return;
    }
    setZipResult(null);
    setActivePath(null);
    setExportZipName("");
    setAgencyId("");
    setSensitiveDecisions({});
    setError(null);
  }, [zipResult]);

  const editableEntries = (zipResult?.entries.filter(isEditableEntry) ?? []) as EditableZipEntry[];
  const standardChoiceEntries = editableEntries.filter(
    (en): en is StandardChoiceZipEntry => en.kind === "standardChoice"
  );
  const sharedDropDownEntries = editableEntries.filter(
    (en): en is SharedDropDownZipEntry => en.kind === "sharedDropDown"
  );
  const organizationAgencyEntries = editableEntries.filter(
    (en): en is OrganizationAgencyZipEntry => en.kind === "organizationAgency"
  );
  const inspRelateInspEntries = editableEntries.filter(
    (en): en is InspRelateInspZipEntry => en.kind === "inspRelateInsp"
  );
  const refAddressTypeGroupEntries = editableEntries.filter(
    (en): en is RefAddressTypeGroupZipEntry => en.kind === "refAddressTypeGroup"
  );
  const referenceMaskEntries = editableEntries.filter(
    (en): en is ReferenceMaskZipEntry => en.kind === "referenceMask"
  );
  const emailMessageEntries = editableEntries.filter(
    (en): en is EmailMessageZipEntry => en.kind === "emailMessage"
  );
  const sequenceEntries = editableEntries.filter(
    (en): en is SequenceZipEntry => en.kind === "sequence"
  );
  const checklistGroupEntries = editableEntries.filter(
    (en): en is CheckListGroupZipEntry => en.kind === "checklistGroup"
  );
  const applicationStatusGroupEntries = editableEntries.filter(
    (en): en is ApplicationStatusGroupZipEntry => en.kind === "applicationStatusGroup"
  );
  const commentGroupEntries = editableEntries.filter(
    (en): en is CommentGroupZipEntry => en.kind === "commentGroup"
  );
  const timeGroupEntries = editableEntries.filter(
    (en): en is TimeGroupZipEntry => en.kind === "timeGroup"
  );
  const timeTypesEntries = editableEntries.filter(
    (en): en is TimeTypesZipEntry => en.kind === "timeTypes"
  );
  const refInspectionResultGroupEntries = editableEntries.filter(
    (en): en is RefInspectionResultGroupZipEntry => en.kind === "refInspectionResultGroup"
  );
  const refLookupTableEntries = editableEntries.filter(
    (en): en is RefLookupTableZipEntry => en.kind === "refLookupTable"
  );
  const guideSheetEntries = editableEntries.filter(
    (en): en is GuideSheetZipEntry => en.kind === "guideSheet"
  );
  const rapoTemplateEntries = editableEntries.filter(
    (en): en is RAPOTemplateZipEntry => en.kind === "rapoTemplate"
  );
  const smartChoiceGroupEntries = editableEntries.filter(
    (en): en is SmartChoiceGroupZipEntry => en.kind === "smartChoiceGroup"
  );
  const standardCommentGroupEntries = editableEntries.filter(
    (en): en is StandardCommentGroupZipEntry => en.kind === "standardCommentGroup"
  );
  const refFeeScheduleEntries = editableEntries.filter(
    (en): en is RefFeeScheduleZipEntry => en.kind === "refFeeSchedule"
  );
  const virProcessEntries = editableEntries.filter(
    (en): en is VirProcessZipEntry => en.kind === "virProcess"
  );
  const asiGroupEntries = editableEntries.filter(
    (en): en is ASIGroupZipEntry => en.kind === "asiGroup"
  );
  const capTypeEntries = editableEntries.filter(
    (en): en is CapTypeZipEntry => en.kind === "capType"
  );
  const formLayoutEditorEntries = editableEntries.filter(
    (en): en is FormLayoutEditorZipEntry => en.kind === "formLayoutEditor"
  );
  const inspectionGroupEntries = editableEntries.filter(
    (en): en is InspectionGroupZipEntry => en.kind === "inspectionGroup"
  );
  const refDocumentEntries = editableEntries.filter(
    (en): en is RefDocumentZipEntry => en.kind === "refDocument"
  );
  const departmentTypeEntries = editableEntries.filter(
    (en): en is DepartmentTypeZipEntry => en.kind === "departmentType"
  );
  const conditionsEntries = editableEntries.filter(
    (en): en is ConditionsZipEntry => en.kind === "conditions"
  );
  const expressionBuilderEntries = editableEntries.filter(
    (en): en is ExpressionBuilderZipEntry => en.kind === "expressionBuilder"
  );

  const sensitiveMatches = zipResult
    ? detectSensitiveEntries(zipResult.entries.map((en) => en.path))
    : [];
  const undecidedSensitive = sensitiveMatches.filter((m) => !sensitiveDecisions[m.path]);

  const decideSensitive = useCallback((path: string, decision: "keep" | "remove") => {
    setSensitiveDecisions((prev) => ({ ...prev, [path]: decision }));
  }, []);

  const handleExport = useCallback(async () => {
    if (!zipResult) return;
    if (!agencyId.trim()) {
      setError("Agency ID is required before export — set it in the field above the grid.");
      return;
    }
    if (undecidedSensitive.length > 0) {
      setError("Decide Keep or Remove for every flagged file below before export.");
      return;
    }
    const validationError =
      validateStandardChoiceEntries(standardChoiceEntries) ??
      validateSharedDropDownEntries(sharedDropDownEntries) ??
      validateOrganizationAgencyEntries(organizationAgencyEntries) ??
      validateInspRelateInspEntries(inspRelateInspEntries) ??
      validateRefAddressTypeGroupEntries(refAddressTypeGroupEntries) ??
      validateReferenceMaskEntries(referenceMaskEntries) ??
      validateEmailMessageEntries(emailMessageEntries) ??
      validateSequenceEntries(sequenceEntries) ??
      validateCheckListGroupEntries(checklistGroupEntries) ??
      validateApplicationStatusGroupEntries(applicationStatusGroupEntries) ??
      validateCommentGroupEntries(commentGroupEntries) ??
      validateTimeGroupEntries(timeGroupEntries) ??
      validateTimeTypesEntries(timeTypesEntries) ??
      validateRefInspectionResultGroupEntries(refInspectionResultGroupEntries) ??
      validateRefLookupTableEntries(refLookupTableEntries) ??
      validateGuideSheetEntries(guideSheetEntries) ??
      validateRAPOTemplateEntries(rapoTemplateEntries) ??
      validateSmartChoiceGroupEntries(smartChoiceGroupEntries) ??
      validateStandardCommentGroupEntries(standardCommentGroupEntries) ??
      validateRefFeeScheduleEntries(refFeeScheduleEntries) ??
      validateVirProcessEntries(virProcessEntries) ??
      validateASIGroupEntries(asiGroupEntries) ??
      validateCapTypeEntries(capTypeEntries) ??
      validateFormLayoutEditorEntries(formLayoutEditorEntries) ??
      validateInspectionGroupEntries(inspectionGroupEntries) ??
      validateRefDocumentEntries(refDocumentEntries) ??
      validateDepartmentTypeEntries(departmentTypeEntries) ??
      validateConditionsEntries(conditionsEntries) ??
      validateExpressionBuilderEntries(expressionBuilderEntries);
    if (validationError) {
      setError(validationError);
      return;
    }
    setExporting(true);
    setError(null);
    try {
      // Belt-and-suspenders: guarantee every record reflects the current
      // Agency ID before building the export, regardless of whether the
      // debounce timer has fired yet or blur/Enter already committed it.
      // Idempotent if already applied.
      if (agencyDebounceRef.current) {
        clearTimeout(agencyDebounceRef.current);
        agencyDebounceRef.current = null;
      }
      gridRef.current?.applyAgencyIdToAll(agencyId);

      const zipName = withZipExtension(exportZipName);
      const entries = zipResult.entries.filter((en) => sensitiveDecisions[en.path] !== "remove");
      const bytes = await exportZipInWorker(entries, zipName);
      // TS's DOM lib types a worker-derived Uint8Array's buffer as the
      // broader ArrayBufferLike (which could in principle be a
      // SharedArrayBuffer), which BlobPart doesn't accept — it's always a
      // plain ArrayBuffer in practice here (from JSZip's generateAsync).
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [
    zipResult,
    exportZipName,
    agencyId,
    undecidedSensitive,
    sensitiveDecisions,
    standardChoiceEntries,
    sharedDropDownEntries,
    organizationAgencyEntries,
    inspRelateInspEntries,
    refAddressTypeGroupEntries,
    referenceMaskEntries,
    emailMessageEntries,
    sequenceEntries,
    checklistGroupEntries,
    applicationStatusGroupEntries,
    commentGroupEntries,
    timeGroupEntries,
    timeTypesEntries,
    refInspectionResultGroupEntries,
    refLookupTableEntries,
    guideSheetEntries,
    rapoTemplateEntries,
    smartChoiceGroupEntries,
    standardCommentGroupEntries,
    refFeeScheduleEntries,
    virProcessEntries,
    asiGroupEntries,
    capTypeEntries,
    formLayoutEditorEntries,
    inspectionGroupEntries,
    refDocumentEntries,
    departmentTypeEntries,
    conditionsEntries,
    expressionBuilderEntries,
  ]);

  // Cascading on every keystroke would be wasteful (it touches every
  // record/child in the file), but relying solely on blur/Enter to commit
  // is fragile — a browser or automation context where a programmatic
  // blur doesn't fire cleanly would silently leave existing records
  // un-cascaded even though newly-added rows (driven by the `agencyId`
  // prop, not this commit path) look right. Debounce-commit as a
  // reliability backstop; blur/Enter still commit immediately for snappy
  // feedback when they do fire, and handleExport also guarantees it as a
  // last resort right before building the zip.
  const commitAgencyId = useCallback((value: string) => {
    if (agencyDebounceRef.current) {
      clearTimeout(agencyDebounceRef.current);
      agencyDebounceRef.current = null;
    }
    setAgencyId(value);
    gridRef.current?.applyAgencyIdToAll(value);
  }, []);

  const handleAgencyIdChange = useCallback((value: string) => {
    setAgencyId(value);
    if (agencyDebounceRef.current) clearTimeout(agencyDebounceRef.current);
    agencyDebounceRef.current = setTimeout(() => {
      agencyDebounceRef.current = null;
      gridRef.current?.applyAgencyIdToAll(value);
    }, 500);
  }, []);

  const activeEntry = editableEntries.find((en) => en.path === activePath) ?? null;
  const gridThemeClass = theme === "dark" ? "ag-theme-quartz-dark" : "ag-theme-quartz";

  return (
    <div
      className="app-shell"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragDepth > 0 && (
        <div className="drop-overlay">
          <div className="drop-overlay-inner">Drop to import .zip</div>
        </div>
      )}
      <div className="topbar">
        <div className="topbar-title">
          <button className="btn icon-btn" onClick={toggleTheme} title="Toggle light/dark mode">
            {theme === "dark" ? "☀" : "☾"}
          </button>
          ImportEase
        </div>

        <div className={`saved-badge${savedVisible ? " visible" : ""}`}>
          <span className="pulse-dot" />
          Saved in session
        </div>

        {/* 1 */}
        <label className="file-input-label">
          Upload .zip
          <input
            type="file"
            accept=".zip"
            multiple
            onChange={handleFileChange}
            disabled={loading || !session || !!accessBlockedReason}
          />
        </label>

        {/* 2 */}
        <button className="btn btn-danger" onClick={handleClear} disabled={!zipResult}>
          Clear
        </button>

        {zipResult && (
          <>
            {/* 3 */}
            <label className="field-label">
              Export as
              <input
                className="text-input"
                style={{ width: 220 }}
                value={exportZipName}
                onChange={(e) => setExportZipName(e.target.value)}
                placeholder="export.zip"
              />
            </label>

            {/* 4 */}
            <label className="field-label">
              Agency ID
              <input
                className={`text-input${!agencyId.trim() ? " invalid" : ""}`}
                value={agencyId}
                onChange={(e) => handleAgencyIdChange(e.target.value)}
                onBlur={(e) => commitAgencyId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitAgencyId(agencyId);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="required"
              />
            </label>
          </>
        )}

        {/* 5 */}
        <select
          className="select"
          value=""
          onChange={handleNewFile}
          aria-label="Start a new file"
          disabled={!session || !!accessBlockedReason}
        >
          <option value="" disabled hidden>
            Start new file
          </option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {editableEntries.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {editableEntries.map((en) => (
              <button
                key={en.path}
                className="btn"
                onClick={() => {
                  setActivePath(en.path);
                  setAgencyId(inferAgencyIdForEntry(en));
                }}
                style={
                  en.path === activePath
                    ? { borderColor: "var(--accent-cyan-text)", color: "var(--accent-cyan-text)" }
                    : undefined
                }
              >
                {en.path}
              </button>
            ))}
          </div>
        )}

        {/* 6 */}
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={
            !zipResult || exporting || undecidedSensitive.length > 0 || !session || !!accessBlockedReason
          }
        >
          {exporting ? "Building zip…" : "Export .zip"}
        </button>

        {/* 7 */}
        {session?.user?.email === ADMIN_EMAIL && (
          <button className="btn" style={{ flexShrink: 0 }} onClick={() => setAdminPanelOpen(true)}>
            Admin
          </button>
        )}
        {session ? (
          <button className="btn" style={{ flexShrink: 0 }} onClick={() => supabase.auth.signOut()}>
            Logout
          </button>
        ) : (
          <button className="btn" style={{ flexShrink: 0 }} onClick={() => setAuthModalOpen(true)}>
            Login
          </button>
        )}
      </div>

      {authModalOpen && (
        <AuthModal onClose={() => setAuthModalOpen(false)} onSignedIn={() => setAuthModalOpen(false)} />
      )}
      {adminPanelOpen && <AdminPanel onClose={() => setAdminPanelOpen(false)} />}

      {undecidedSensitive.length > 0 && (
        <div className="sensitive-gate">
          <div className="sensitive-gate-header">
            ⚠ This zip includes files that carry user accounts or security/permission data.
            Decide what happens to each one before you can export.
          </div>
          {sensitiveMatches.map((m) => {
            const decision = sensitiveDecisions[m.path];
            return (
              <div className="sensitive-gate-row" key={m.path}>
                <div className="sensitive-gate-file">
                  <span className="sensitive-gate-path">{m.path}</span>
                  <span className="sensitive-gate-reason">
                    <strong
                      style={{
                        color:
                          m.tier === "credentials"
                            ? "var(--accent-danger-text)"
                            : "var(--accent-amber-text)",
                      }}
                    >
                      {m.tier === "credentials" ? "Credentials/PII — " : "Embedded security reference — "}
                    </strong>
                    {m.reason}
                  </span>
                </div>
                <div className="sensitive-gate-actions">
                  <button
                    className={`btn${decision === "keep" ? " btn-choice-active" : ""}`}
                    onClick={() => decideSensitive(m.path, "keep")}
                  >
                    Keep
                  </button>
                  <button
                    className={`btn btn-danger${decision === "remove" ? " btn-choice-active" : ""}`}
                    onClick={() => decideSensitive(m.path, "remove")}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading && (
        <div className="parse-trace">
          <div className="sweep" />
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="main-area">
        {!session ? (
          <div className="main-empty">
            {authChecked
              ? "Sign in to use ImportEase — click “Login” above. No account? Use “Sign Up”."
              : "Checking sign-in status…"}
          </div>
        ) : accessBlockedReason === "expired" ? (
          <div className="main-empty">
            Your subscription has expired. Please contact us to renew access.
          </div>
        ) : accessBlockedReason === "pending" ? (
          <div className="main-empty">
            Your account is pending approval. We&rsquo;ll notify you once access is granted.
          </div>
        ) : activeEntry ? (
          activeEntry.kind === "standardChoice" ? (
            <StandardChoiceGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "sharedDropDown" ? (
            <SharedDropDownGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "refAddressTypeGroup" ? (
            <RefAddressTypeGroupGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "organizationAgency" ? (
            <FlatGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
              columnMeta={ORG_AGENCY_COLUMNS}
              toRow={toOrganizationAgencyRow}
              setField={setOrganizationAgencyField}
              agencyIdField="serviceProviderCode"
              createNode={createOrganizationAgencyNode}
              nextRefIdNumber={nextRefIdNumberOrgAgency}
              findByUid={findOrganizationAgencyByUid}
              deleteNode={deleteOrganizationAgency}
              toolbarLabel="Organization/Agency"
              addButtonLabel="+ Add Agency"
            />
          ) : activeEntry.kind === "inspRelateInsp" ? (
            <FlatGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
              columnMeta={INSP_RELATE_INSP_COLUMNS}
              toRow={toInspRelateInspRow}
              setField={setInspRelateInspField}
              agencyIdField="servProvCode"
              createNode={createInspRelateInspNode}
              nextRefIdNumber={nextRefIdNumberInspRelateInsp}
              findByUid={findInspRelateInspByUid}
              deleteNode={deleteInspRelateInsp}
              toolbarLabel="Insp Relate Insp"
              addButtonLabel="+ Add Rule"
            />
          ) : activeEntry.kind === "referenceMask" ? (
            <FlatGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
              columnMeta={REFERENCE_MASK_COLUMNS}
              toRow={toReferenceMaskRow}
              setField={setReferenceMaskField}
              agencyIdField="serviceProviderCode"
              createNode={createReferenceMaskNode}
              nextRefIdNumber={nextRefIdNumberReferenceMask}
              findByUid={findReferenceMaskByUid}
              deleteNode={deleteReferenceMask}
              toolbarLabel="Reference Mask"
              addButtonLabel="+ Add Mask"
            />
          ) : activeEntry.kind === "emailMessage" ? (
            <FlatGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
              columnMeta={EMAIL_MESSAGE_COLUMNS}
              toRow={toEmailMessageRow}
              setField={setEmailMessageField}
              agencyIdField="serviceProviderCode"
              createNode={createEmailMessageNode}
              nextRefIdNumber={nextRefIdNumberEmailMessage}
              findByUid={findEmailMessageByUid}
              deleteNode={deleteEmailMessage}
              toolbarLabel="Email Message"
              addButtonLabel="+ Add Message"
            />
          ) : activeEntry.kind === "sequence" ? (
            <SequenceGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "checklistGroup" ? (
            <CheckListGroupGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "applicationStatusGroup" ? (
            <ApplicationStatusGroupGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "commentGroup" ? (
            <CommentGroupGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "timeGroup" ? (
            <TimeGroupGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "timeTypes" ? (
            <FlatGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
              columnMeta={TIME_TYPES_COLUMNS}
              toRow={toTimeTypesRow}
              setField={setTimeTypesField}
              agencyIdField="servProvCode"
              createNode={createTimeTypesNode}
              nextRefIdNumber={nextRefIdNumberTimeTypes}
              findByUid={findTimeTypesByUid}
              deleteNode={deleteTimeTypes}
              toolbarLabel="Time Types"
              addButtonLabel="+ Add Time Type"
            />
          ) : activeEntry.kind === "refInspectionResultGroup" ? (
            <RefInspectionResultGroupGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "refLookupTable" ? (
            <RefLookupTableGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "guideSheet" ? (
            <GuideSheetGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "rapoTemplate" ? (
            <RAPOTemplateGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "smartChoiceGroup" ? (
            <SmartChoiceGroupGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "standardCommentGroup" ? (
            <StandardCommentGroupGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "refFeeSchedule" ? (
            <RefFeeScheduleGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "virProcess" ? (
            <VirProcessGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "expressionBuilder" ? (
            <ExpressionBuilderGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "asiGroup" ? (
            <ASIGroupGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "capType" ? (
            <FlatGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
              columnMeta={CAP_TYPE_COLUMNS}
              toRow={toCapTypeRow}
              setField={setCapTypeField}
              agencyIdField="serviceProviderCode"
              createNode={createCapTypeNode}
              nextRefIdNumber={nextRefIdNumberCapType}
              findByUid={findCapTypeByUid}
              deleteNode={deleteCapType}
              toolbarLabel="Cap Types"
              addButtonLabel="+ Add Cap Type"
            />
          ) : activeEntry.kind === "formLayoutEditor" ? (
            <FormLayoutEditorGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "inspectionGroup" ? (
            <InspectionGroupGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "refDocument" ? (
            <RefDocumentGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
            />
          ) : activeEntry.kind === "departmentType" ? (
            <FlatGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
              columnMeta={DEPARTMENT_TYPE_COLUMNS}
              toRow={toDepartmentTypeRow}
              setField={setDepartmentTypeField}
              agencyIdField="serviceProviderCode"
              createNode={createDepartmentTypeNode}
              nextRefIdNumber={nextRefIdNumberDepartmentType}
              findByUid={findDepartmentTypeByUid}
              deleteNode={deleteDepartmentType}
              toolbarLabel="Department Types"
              addButtonLabel="+ Add Department Type"
            />
          ) : (
            <FlatGrid
              key={activeEntry.path}
              ref={gridRef}
              records={activeEntry.records}
              onChange={handleDataChange}
              gridThemeClass={gridThemeClass}
              agencyId={agencyId}
              columnMeta={CONDITIONS_COLUMNS}
              toRow={toConditionRow}
              setField={setConditionField}
              agencyIdField="serviceProviderCode"
              createNode={createConditionNode}
              nextRefIdNumber={nextRefIdNumberConditions}
              findByUid={findConditionByUid}
              deleteNode={deleteCondition}
              toolbarLabel="Conditions"
              addButtonLabel="+ Add Condition"
            />
          )
        ) : (
          <div className="main-empty">
            {zipResult
              ? "No recognized editable file was found in this zip. Everything else will still be passed through untouched on export."
              : "Upload or drag in a Configuration Manager export .zip, or start a blank file above, to begin."}
          </div>
        )}
      </div>
    </div>
  );
}
