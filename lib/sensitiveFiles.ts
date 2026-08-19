/**
 * Filenames known to carry user accounts, group membership, or
 * security/permission data (see architecture-and-safety-update.md, revised
 * against a real 34-file full-agency export). Two tiers, since they warrant
 * different scrutiny but the same safe default — block export and require
 * an explicit per-file Keep/Remove choice rather than guessing:
 *
 * - "credentials": dedicated user/security files — full accounts (incl.
 *   hashed passwords), profiles, or agency-level group/permission records.
 * - "embedded": otherwise-ordinary config categories that happen to embed
 *   permission/security references (e.g. "this condition requires Building
 *   Supervisor approval"). Whether to strip just the embedded reference
 *   sub-block instead of gating the whole file is a product decision that
 *   hasn't been made yet, so these are flagged for review the same way as
 *   credentials rather than the tool guessing at a default.
 *
 * Matched by exact base filename (case-insensitive), not a substring, to
 * avoid false positives on unrelated files that happen to contain these
 * words. Add new filenames here as they're identified — this is the one
 * list that needs to grow, nothing else about the detection/gate changes.
 */
export type SensitivityTier = "credentials" | "embedded";

interface SensitiveFileInfo {
  reason: string;
  tier: SensitivityTier;
}

const SENSITIVE_FILENAMES: Record<string, SensitiveFileInfo> = {
  "usermodel.xml": {
    reason: "Full user records, including hashed passwords, real names, and login metadata",
    tier: "credentials",
  },
  "userprofilesmodel.xml": { reason: "User profile data", tier: "credentials" },
  "agencygroupmodel.xml": {
    reason: "Agency-level user groups & security/menu permission records",
    tier: "credentials",
  },
  "asigroupmodel.xml": {
    reason: "Embeds permission/security policy references throughout ASI configuration",
    tier: "embedded",
  },
  "formlayouteditormodel.xml": {
    reason: "Embeds permission references in form layout security",
    tier: "embedded",
  },
  "timetypesmodel.xml": {
    reason: "Time-type security policies reference user groups",
    tier: "embedded",
  },
  "virprocessmodel.xml": {
    reason: "Process-level security settings reference user groups",
    tier: "embedded",
  },
  "timegroupmodel.xml": {
    reason: "Time-group security policies reference user groups",
    tier: "embedded",
  },
  "captypemodel.xml": {
    reason: "Permission references embedded in record-type config",
    tier: "embedded",
  },
  "conditionsmodel.xml": {
    reason: "Condition approval policies reference user groups",
    tier: "embedded",
  },
  "inspectiongroupmodel.xml": {
    reason: "Inspection group security references",
    tier: "embedded",
  },
};

export interface SensitiveFileMatch {
  path: string;
  reason: string;
  tier: SensitivityTier;
}

export function detectSensitiveEntries(paths: string[]): SensitiveFileMatch[] {
  const matches: SensitiveFileMatch[] = [];
  for (const path of paths) {
    const base = path.split(/[\\/]/).pop()?.toLowerCase() ?? "";
    const info = SENSITIVE_FILENAMES[base];
    if (info) matches.push({ path, reason: info.reason, tier: info.tier });
  }
  return matches;
}
