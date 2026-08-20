import JSZip from "jszip";
import {
  buildExportedXml,
  isStandardChoiceXml,
  parseStandardChoiceXml,
} from "../xml/standardChoice";
import {
  buildExportedSharedDropDownXml,
  isSharedDropDownXml,
  parseSharedDropDownXml,
} from "../xml/sharedDropDownList";
import {
  buildExportedOrganizationAgencyXml,
  isOrganizationAgencyXml,
  parseOrganizationAgencyXml,
} from "../xml/organizationAgency";
import {
  buildExportedInspRelateInspXml,
  isInspRelateInspXml,
  parseInspRelateInspXml,
} from "../xml/inspRelateInsp";
import {
  buildExportedRefAddressTypeGroupXml,
  isRefAddressTypeGroupXml,
  parseRefAddressTypeGroupXml,
} from "../xml/refAddressTypeGroup";
import {
  buildExportedReferenceMaskXml,
  isReferenceMaskXml,
  parseReferenceMaskXml,
} from "../xml/referenceMask";
import {
  buildExportedEmailMessageXml,
  isEmailMessageXml,
  parseEmailMessageXml,
} from "../xml/emailMessage";
import { buildExportedSequenceXml, isSequenceXml, parseSequenceXml } from "../xml/sequence";
import {
  buildExportedCheckListGroupXml,
  isCheckListGroupXml,
  parseCheckListGroupXml,
} from "../xml/checklistGroup";
import {
  buildExportedApplicationStatusGroupXml,
  isApplicationStatusGroupXml,
  parseApplicationStatusGroupXml,
} from "../xml/applicationStatusGroup";
import {
  buildExportedCommentGroupXml,
  isCommentGroupXml,
  parseCommentGroupXml,
} from "../xml/commentGroup";
import { buildExportedTimeTypesXml, isTimeTypesXml, parseTimeTypesXml } from "../xml/timeTypes";
import { buildExportedTimeGroupXml, isTimeGroupXml, parseTimeGroupXml } from "../xml/timeGroup";
import {
  buildExportedRefInspectionResultGroupXml,
  isRefInspectionResultGroupXml,
  parseRefInspectionResultGroupXml,
} from "../xml/refInspectionResultGroup";
import {
  buildExportedRefLookupTableXml,
  isRefLookupTableXml,
  parseRefLookupTableXml,
} from "../xml/refLookupTable";
import { buildExportedGuideSheetXml, isGuideSheetXml, parseGuideSheetXml } from "../xml/guideSheet";
import {
  buildExportedRAPOTemplateXml,
  isRAPOTemplateXml,
  parseRAPOTemplateXml,
} from "../xml/rapoTemplate";
import {
  buildExportedSmartChoiceGroupXml,
  isSmartChoiceGroupXml,
  parseSmartChoiceGroupXml,
} from "../xml/smartChoiceGroup";
import type { ParseZipResult, ZipEntryData } from "../types";

/**
 * Each of these detectors sniffs actual element content, not the filename —
 * real Configuration Manager exports are named after the export job (e.g.
 * "sc4richard.xml"), not after the model type. Anything that doesn't match
 * a known shape is passed through untouched, per CLAUDE.md's explicit
 * non-goal of rejecting files this tool doesn't know how to parse yet.
 */
const DETECTORS: {
  kind: Exclude<ZipEntryData["kind"], "passthrough">;
  sniff: (text: string) => boolean;
  parse: (text: string) => { listAttrs: any; records: any[] };
}[] = [
  { kind: "standardChoice", sniff: isStandardChoiceXml, parse: parseStandardChoiceXml },
  { kind: "sharedDropDown", sniff: isSharedDropDownXml, parse: parseSharedDropDownXml },
  { kind: "organizationAgency", sniff: isOrganizationAgencyXml, parse: parseOrganizationAgencyXml },
  { kind: "inspRelateInsp", sniff: isInspRelateInspXml, parse: parseInspRelateInspXml },
  {
    kind: "refAddressTypeGroup",
    sniff: isRefAddressTypeGroupXml,
    parse: parseRefAddressTypeGroupXml,
  },
  { kind: "referenceMask", sniff: isReferenceMaskXml, parse: parseReferenceMaskXml },
  { kind: "emailMessage", sniff: isEmailMessageXml, parse: parseEmailMessageXml },
  { kind: "sequence", sniff: isSequenceXml, parse: parseSequenceXml },
  { kind: "checklistGroup", sniff: isCheckListGroupXml, parse: parseCheckListGroupXml },
  {
    kind: "applicationStatusGroup",
    sniff: isApplicationStatusGroupXml,
    parse: parseApplicationStatusGroupXml,
  },
  { kind: "commentGroup", sniff: isCommentGroupXml, parse: parseCommentGroupXml },
  { kind: "timeTypes", sniff: isTimeTypesXml, parse: parseTimeTypesXml },
  { kind: "timeGroup", sniff: isTimeGroupXml, parse: parseTimeGroupXml },
  {
    kind: "refInspectionResultGroup",
    sniff: isRefInspectionResultGroupXml,
    parse: parseRefInspectionResultGroupXml,
  },
  { kind: "refLookupTable", sniff: isRefLookupTableXml, parse: parseRefLookupTableXml },
  { kind: "guideSheet", sniff: isGuideSheetXml, parse: parseGuideSheetXml },
  { kind: "rapoTemplate", sniff: isRAPOTemplateXml, parse: parseRAPOTemplateXml },
  { kind: "smartChoiceGroup", sniff: isSmartChoiceGroupXml, parse: parseSmartChoiceGroupXml },
];

export async function parseUploadedZip(
  buffer: ArrayBuffer,
  zipName: string
): Promise<ParseZipResult> {
  const zip = await JSZip.loadAsync(buffer);
  const entries: ZipEntryData[] = [];

  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);

  for (const path of paths) {
    const file = zip.files[path];
    let matched = false;

    if (path.toLowerCase().endsWith(".xml")) {
      const text = await file.async("string");

      for (const detector of DETECTORS) {
        if (!detector.sniff(text)) continue;
        try {
          const parsed = detector.parse(text);
          entries.push({
            path,
            kind: detector.kind,
            listAttrs: parsed.listAttrs,
            records: parsed.records,
          } as ZipEntryData);
          matched = true;
          break;
        } catch {
          // Looked like a match but didn't parse cleanly — fall through to
          // passthrough rather than failing the whole upload.
        }
      }
    }

    if (!matched) {
      const bytes = await file.async("uint8array");
      entries.push({ path, kind: "passthrough", bytes });
    }
  }

  return { zipName, entries };
}

/** Re-zips with the same entry paths the upload came in with. */
export async function buildExportZip(entries: ZipEntryData[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const entry of entries) {
    if (entry.kind === "standardChoice") {
      zip.file(entry.path, buildExportedXml({ listAttrs: entry.listAttrs, records: entry.records }));
    } else if (entry.kind === "sharedDropDown") {
      zip.file(
        entry.path,
        buildExportedSharedDropDownXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "organizationAgency") {
      zip.file(
        entry.path,
        buildExportedOrganizationAgencyXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "inspRelateInsp") {
      zip.file(
        entry.path,
        buildExportedInspRelateInspXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "refAddressTypeGroup") {
      zip.file(
        entry.path,
        buildExportedRefAddressTypeGroupXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "referenceMask") {
      zip.file(
        entry.path,
        buildExportedReferenceMaskXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "emailMessage") {
      zip.file(
        entry.path,
        buildExportedEmailMessageXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "sequence") {
      zip.file(
        entry.path,
        buildExportedSequenceXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "checklistGroup") {
      zip.file(
        entry.path,
        buildExportedCheckListGroupXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "applicationStatusGroup") {
      zip.file(
        entry.path,
        buildExportedApplicationStatusGroupXml({
          listAttrs: entry.listAttrs,
          records: entry.records,
        })
      );
    } else if (entry.kind === "commentGroup") {
      zip.file(
        entry.path,
        buildExportedCommentGroupXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "timeTypes") {
      zip.file(
        entry.path,
        buildExportedTimeTypesXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "timeGroup") {
      zip.file(
        entry.path,
        buildExportedTimeGroupXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "refInspectionResultGroup") {
      zip.file(
        entry.path,
        buildExportedRefInspectionResultGroupXml({
          listAttrs: entry.listAttrs,
          records: entry.records,
        })
      );
    } else if (entry.kind === "refLookupTable") {
      zip.file(
        entry.path,
        buildExportedRefLookupTableXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "guideSheet") {
      zip.file(
        entry.path,
        buildExportedGuideSheetXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "rapoTemplate") {
      zip.file(
        entry.path,
        buildExportedRAPOTemplateXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else if (entry.kind === "smartChoiceGroup") {
      zip.file(
        entry.path,
        buildExportedSmartChoiceGroupXml({ listAttrs: entry.listAttrs, records: entry.records })
      );
    } else {
      zip.file(entry.path, entry.bytes);
    }
  }
  return zip.generateAsync({ type: "uint8array" });
}
