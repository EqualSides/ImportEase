import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedSharedDropDownXml,
  parseSharedDropDownXml,
} from "../lib/xml/sharedDropDownList";

/**
 * SharedDropDownListModel's round-trip test, same structural-diff approach
 * as tests/roundtrip.test.ts (see that file's header comment for the
 * exportUser/exportDateTime/whitespace rationale — identical here since both
 * share lib/xml/pnode.ts's parse/serialize core).
 *
 * IMPORTANT — unlike the Standard Choice fixtures (real customer exports),
 * fixtures/shared-dropdown/sdd1.xml is hand-built from full-schema-
 * reference.md's field list, not sourced from a real Configuration Manager
 * export. It exercises the shapes the schema doc describes (multi-record
 * file, an empty value list, empty leaf fields, self-closing empty
 * collections, an entity in existing text, the parent/child Agency ID
 * field-name split), but a hand-built fixture can't catch whatever an
 * unknown real export does that the schema doc didn't. Treat this milestone
 * as unverified against real data until it's been round-tripped against an
 * actual SharedDropDownListModel.xml sample.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "shared-dropdown");
const files = ["sdd1.xml"];

function firstDiffPath(a: unknown, b: unknown, path: string): string | null {
  if (a === b) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return `${path}: array length ${a.length} vs ${b.length}`;
    }
    for (let i = 0; i < a.length; i++) {
      const d = firstDiffPath(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    const onlyA = keysA.filter((k) => !keysB.includes(k));
    const onlyB = keysB.filter((k) => !keysA.includes(k));
    if (onlyA.length || onlyB.length) {
      return `${path}: keys only in original [${onlyA}], only in exported [${onlyB}]`;
    }
    for (const k of keysA) {
      const d = firstDiffPath((a as any)[k], (b as any)[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}

function expectSameRecords(original: unknown, exported: unknown) {
  const diff = firstDiffPath(original, exported, "records");
  if (diff) {
    // eslint-disable-next-line no-console
    console.error("ROUND-TRIP MISMATCH:", diff);
  }
  expect(diff).toBeNull();
}

describe("SharedDropDownListModel round-trip fidelity (synthetic fixture)", () => {
  for (const file of files) {
    it(`round-trips ${file} structurally unmodified`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      const parsedOriginal = parseSharedDropDownXml(original);

      const exportedXml = buildExportedSharedDropDownXml(parsedOriginal);
      const parsedExported = parseSharedDropDownXml(exportedXml);

      expect(parsedExported.listAttrs.version).toBe(parsedOriginal.listAttrs.version);
      expect(parsedExported.listAttrs.minorVersion).toBe(parsedOriginal.listAttrs.minorVersion);
      expect(parsedExported.listAttrs.description).toBe(parsedOriginal.listAttrs.description);

      expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
      expect(parsedExported.listAttrs.exportDateTime).toMatch(
        /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} (AM|PM)$/
      );

      expectSameRecords(parsedOriginal.records, parsedExported.records);
    });

    it(`re-serializes ${file} stably on a second pass`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      const parsedOriginal = parseSharedDropDownXml(original);
      const firstPass = parseSharedDropDownXml(buildExportedSharedDropDownXml(parsedOriginal));
      const secondPass = parseSharedDropDownXml(buildExportedSharedDropDownXml(firstPass));
      expectSameRecords(firstPass.records, secondPass.records);
    });

    it(`preserves self-closing empty collections in ${file}`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      expect(original).toContain("<standardChoiceValueI18NModels/>");
      expect(original).toContain("<childDrillDownValueMapModels/>");
      expect(original).toContain("<sharedDropDownList/>");

      const exportedXml = buildExportedSharedDropDownXml(parseSharedDropDownXml(original));
      expect(exportedXml).toContain("<standardChoiceValueI18NModels/>");
      expect(exportedXml).toContain("<childDrillDownValueMapModels/>");
      expect(exportedXml).toContain("<sharedDropDownList/>");
    });

    it(`preserves empty leaf string fields as open/close tags, not self-closed in ${file}`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      expect(original).toContain("<description></description>");

      const exportedXml = buildExportedSharedDropDownXml(parseSharedDropDownXml(original));
      expect(exportedXml).toContain("<description></description>");
      expect(exportedXml).not.toContain("<description/>");
    });

    it(`keeps a raw entity untouched when the field is never edited in ${file}`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      expect(original).toContain("&amp;");
      const exportedXml = buildExportedSharedDropDownXml(parseSharedDropDownXml(original));
      expect(exportedXml).toContain("&amp;");
      expect(exportedXml).not.toMatch(/[^&]&[^a-zA-Z#]/); // no stray unescaped bare `&`
    });

    it(`keeps parent serviceProviderCode and child servProvCode as distinct fields in ${file}`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      const parsed = parseSharedDropDownXml(original);
      // Sanity check the field-name split the module doc comment describes
      // actually round-trips both ways rather than one silently overwriting
      // the other.
      expect(original).toContain("<serviceProviderCode>CLARKCO</serviceProviderCode>");
      expect(original).toContain("<servProvCode>CLARKCO</servProvCode>");
      const exportedXml = buildExportedSharedDropDownXml(parsed);
      expect(exportedXml).toContain("<serviceProviderCode>CLARKCO</serviceProviderCode>");
      expect(exportedXml).toContain("<servProvCode>CLARKCO</servProvCode>");
    });
  }
});
