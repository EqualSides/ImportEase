import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedReferenceMaskXml,
  parseReferenceMaskXml,
  toReferenceMaskRow,
} from "../lib/xml/referenceMask";

/**
 * ReferenceMaskModel round-trip fidelity, against a real 3-record excerpt
 * (fixtures/reference-mask/rm-real.xml, taken from the same 165-record
 * agency export) — same structural-diff approach as tests/roundtrip.test.ts.
 * Flat category, no repeating child list.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "reference-mask");
const file = "rm-real.xml";

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

describe("ReferenceMaskModel round-trip fidelity", () => {
  it("round-trips rm-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseReferenceMaskXml(original);

    const exportedXml = buildExportedReferenceMaskXml(parsedOriginal);
    const parsedExported = parseReferenceMaskXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(3);
  });

  it("re-serializes rm-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseReferenceMaskXml(
      buildExportedReferenceMaskXml(parseReferenceMaskXml(original))
    );
    const secondPass = parseReferenceMaskXml(buildExportedReferenceMaskXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("has no refId attribute in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("reads mask fields, including a name reused across different types", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseReferenceMaskXml(original);
    const rows = parsed.records.map(toReferenceMaskRow);
    expect(rows[0].name).toBe("Default");
    expect(rows[0].type).toBe("Cap Key");
    expect(rows[2].type).toBe("Partial CAP ID");
    expect(rows.every((r) => r.serviceProviderCode === "CLARKCO")).toBe(true);
  });
});
