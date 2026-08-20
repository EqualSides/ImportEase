import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedCapTypeXml,
  parseCapTypeXml,
  setCapTypeField,
  toCapTypeRow,
} from "../lib/xml/capType";

/**
 * CapTypeModel round-trip fidelity, against a real 2-record excerpt
 * (fixtures/cap-type/ct-real.xml — the file's single smallest real record
 * ("Enforcement/Incident/NA/NA", minimal field population) and a
 * mid-sized record ("Building/Commercial/Electric/Temporary Well")
 * exercising the fuller scalar field set — taken from the same
 * 581-record agency export) — same structural-diff approach as
 * tests/roundtrip.test.ts. See the module doc comment in
 * lib/xml/capType.ts for why this category is treated as flat (one row
 * per record type) rather than a tree: it has no repeating child
 * collections, just ~15 embedded singleton sub-objects this module never
 * reads or writes, several of which (capTypeSecurityModel) are genuine
 * security data and others (pageStatusModels) are Accela's own admin-UI
 * bookkeeping, not user data.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "cap-type");
const file = "ct-real.xml";

function firstDiffPath(a: unknown, b: unknown, path: string): string | null {
  if (a === b) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: array length ${a.length} vs ${b.length}`;
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

describe("CapTypeModel round-trip fidelity", () => {
  it("round-trips ct-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseCapTypeXml(original);

    const exportedXml = buildExportedCapTypeXml(parsedOriginal);
    const parsedExported = parseCapTypeXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes ct-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseCapTypeXml(buildExportedCapTypeXml(parseCapTypeXml(original)));
    const secondPass = parseCapTypeXml(buildExportedCapTypeXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the untouched capTypeSecurityModel and pageStatusModels sub-objects", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<capTypeSecurityModel>");
    expect(original).toContain("<pageStatusModels>");
    const exportedXml = buildExportedCapTypeXml(parseCapTypeXml(original));
    const originalPageStatusCount = (original.match(/<pageStatus>/g) ?? []).length;
    const exportedPageStatusCount = (exportedXml.match(/<pageStatus>/g) ?? []).length;
    expect(exportedPageStatusCount).toBe(originalPageStatusCount);
    expect(exportedPageStatusCount).toBeGreaterThan(30);
  });

  it("reads the minimal and mid-sized records correctly", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseCapTypeXml(original);
    expect(parsed.records.length).toBe(2);

    const minimal = parsed.records.find((r) => toCapTypeRow(r).group === "Enforcement")!;
    const minimalRow = toCapTypeRow(minimal);
    expect(minimalRow.type).toBe("Incident");
    expect(minimalRow.subType).toBe("NA");
    expect(minimalRow.category).toBe("NA");
    expect(minimalRow.feeScheduleName).toBe("FIRETEST");

    const midSized = parsed.records.find((r) => toCapTypeRow(r).category === "Temporary Well")!;
    const midRow = toCapTypeRow(midSized);
    expect(midRow.group).toBe("Building");
    expect(midRow.subType).toBe("Electric");
    expect(midRow.appStatusGroupCode).toBe("BD_Main");
    expect(midRow.docCode).toBe("BD_BUILDING");
    expect(midRow.expirationCode).toBe("NONE");
    expect(midRow.udCode3).toBe("VHAPP");
  });

  it("cascades an identity field edit into the confirmed sibling singleton objects", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseCapTypeXml(original);
    const record = parsed.records.find((r) => toCapTypeRow(r).group === "Enforcement")!;

    setCapTypeField(record, "type", "RenamedType");

    const exportedXml = buildExportedCapTypeXml(parsed);
    // Every sibling's own <type> copy should follow the edit.
    const typeOccurrences = (exportedXml.match(/<type>RenamedType<\/type>/g) ?? []).length;
    expect(typeOccurrences).toBeGreaterThanOrEqual(4);
    // The old value should no longer appear as a <type> value for this record.
    expect(exportedXml).not.toContain("<type>Incident</type>");
  });
});
