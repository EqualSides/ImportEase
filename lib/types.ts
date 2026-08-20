import type { ListAttrs, PNode } from "./xml/pnode";

export interface StandardChoiceZipEntry {
  path: string;
  kind: "standardChoice";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface SharedDropDownZipEntry {
  path: string;
  kind: "sharedDropDown";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface OrganizationAgencyZipEntry {
  path: string;
  kind: "organizationAgency";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface InspRelateInspZipEntry {
  path: string;
  kind: "inspRelateInsp";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface RefAddressTypeGroupZipEntry {
  path: string;
  kind: "refAddressTypeGroup";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface ReferenceMaskZipEntry {
  path: string;
  kind: "referenceMask";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface EmailMessageZipEntry {
  path: string;
  kind: "emailMessage";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface SequenceZipEntry {
  path: string;
  kind: "sequence";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface CheckListGroupZipEntry {
  path: string;
  kind: "checklistGroup";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface ApplicationStatusGroupZipEntry {
  path: string;
  kind: "applicationStatusGroup";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface CommentGroupZipEntry {
  path: string;
  kind: "commentGroup";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface TimeTypesZipEntry {
  path: string;
  kind: "timeTypes";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface TimeGroupZipEntry {
  path: string;
  kind: "timeGroup";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface RefInspectionResultGroupZipEntry {
  path: string;
  kind: "refInspectionResultGroup";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface RefLookupTableZipEntry {
  path: string;
  kind: "refLookupTable";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface GuideSheetZipEntry {
  path: string;
  kind: "guideSheet";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface RAPOTemplateZipEntry {
  path: string;
  kind: "rapoTemplate";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface SmartChoiceGroupZipEntry {
  path: string;
  kind: "smartChoiceGroup";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface StandardCommentGroupZipEntry {
  path: string;
  kind: "standardCommentGroup";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface RefFeeScheduleZipEntry {
  path: string;
  kind: "refFeeSchedule";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface VirProcessZipEntry {
  path: string;
  kind: "virProcess";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface ASIGroupZipEntry {
  path: string;
  kind: "asiGroup";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface CapTypeZipEntry {
  path: string;
  kind: "capType";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface FormLayoutEditorZipEntry {
  path: string;
  kind: "formLayoutEditor";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface InspectionGroupZipEntry {
  path: string;
  kind: "inspectionGroup";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface RefDocumentZipEntry {
  path: string;
  kind: "refDocument";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface DepartmentTypeZipEntry {
  path: string;
  kind: "departmentType";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface ConditionsZipEntry {
  path: string;
  kind: "conditions";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface PassthroughZipEntry {
  path: string;
  kind: "passthrough";
  // Raw bytes, not base64: everything now stays client-side (see
  // lib/worker/), so there's no JSON-over-HTTP boundary that needs a
  // text-safe encoding — and base64 would add ~33% overhead on the large
  // files (40MB+) this app needs to handle.
  bytes: Uint8Array;
}

export type ZipEntryData =
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
  | TimeTypesZipEntry
  | TimeGroupZipEntry
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
  | PassthroughZipEntry;

export interface ParseZipResult {
  zipName: string;
  entries: ZipEntryData[];
}
