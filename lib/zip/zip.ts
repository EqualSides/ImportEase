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
import type { ParseZipResult, ZipEntryData } from "../types";

/**
 * Detection is content-based, not filename-based: real Configuration Manager
 * exports are named after the export job (e.g. "sc4richard.xml"), not after
 * the model type. Anything that isn't a shape this tool knows how to parse
 * is passed through untouched, per CLAUDE.md's explicit non-goal of
 * rejecting files this tool doesn't know how to parse yet.
 */
export async function parseUploadedZip(
  buffer: ArrayBuffer,
  zipName: string
): Promise<ParseZipResult> {
  const zip = await JSZip.loadAsync(buffer);
  const entries: ZipEntryData[] = [];

  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);

  for (const path of paths) {
    const file = zip.files[path];

    if (path.toLowerCase().endsWith(".xml")) {
      const text = await file.async("string");

      if (isStandardChoiceXml(text)) {
        try {
          const parsed = parseStandardChoiceXml(text);
          entries.push({
            path,
            kind: "standardChoice",
            listAttrs: parsed.listAttrs,
            records: parsed.records,
          });
          continue;
        } catch {
          // Looked like a StandardChoice file but didn't parse cleanly — pass it through
          // untouched rather than failing the whole upload.
        }
      }

      if (isSharedDropDownXml(text)) {
        try {
          const parsed = parseSharedDropDownXml(text);
          entries.push({
            path,
            kind: "sharedDropDown",
            listAttrs: parsed.listAttrs,
            records: parsed.records,
          });
          continue;
        } catch {
          // Same — pass through untouched rather than failing the whole upload.
        }
      }
    }

    const bytes = await file.async("uint8array");
    entries.push({ path, kind: "passthrough", bytes });
  }

  return { zipName, entries };
}

/** Re-zips with the same entry paths the upload came in with. */
export async function buildExportZip(entries: ZipEntryData[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const entry of entries) {
    if (entry.kind === "standardChoice") {
      const xml = buildExportedXml({ listAttrs: entry.listAttrs, records: entry.records });
      zip.file(entry.path, xml);
    } else if (entry.kind === "sharedDropDown") {
      const xml = buildExportedSharedDropDownXml({
        listAttrs: entry.listAttrs,
        records: entry.records,
      });
      zip.file(entry.path, xml);
    } else {
      zip.file(entry.path, entry.bytes);
    }
  }
  return zip.generateAsync({ type: "uint8array" });
}
