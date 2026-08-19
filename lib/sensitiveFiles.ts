/**
 * Filenames known to carry user accounts, group membership, or
 * security/permission data (see architecture-and-safety-update.md). These
 * can end up bundled into a zip incidentally, even when that wasn't the
 * intent of the export — carrying them through silently risks moving real
 * accounts/permissions into an environment they weren't meant for.
 *
 * Matched by exact base filename (case-insensitive), not a substring, to
 * avoid false positives on unrelated files that happen to contain these
 * words. Add new filenames here as they're identified — this is the one
 * list that needs to grow, nothing else about the detection/gate changes.
 */
const SENSITIVE_FILENAMES: Record<string, string> = {
  "usermodel.xml": "User accounts",
  "userprofilesmodel.xml": "User profiles",
  "agencygroupmodel.xml": "Agency user groups & security permissions",
};

export interface SensitiveFileMatch {
  path: string;
  reason: string;
}

export function detectSensitiveEntries(paths: string[]): SensitiveFileMatch[] {
  const matches: SensitiveFileMatch[] = [];
  for (const path of paths) {
    const base = path.split(/[\\/]/).pop()?.toLowerCase() ?? "";
    const reason = SENSITIVE_FILENAMES[base];
    if (reason) matches.push({ path, reason });
  }
  return matches;
}
