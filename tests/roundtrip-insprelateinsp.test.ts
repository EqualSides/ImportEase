import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedInspRelateInspXml,
  parseInspRelateInspXml,
  toInspRelateInspRow,
} from "../lib/xml/inspRelateInsp";

/**
 * InspRelateInspModel round-trip fidelity, against the real 1-record export
 * (fixtures/insp-relate-insp/iri-real.xml) — same structural-diff approach
 * as tests/roundtrip.test.ts. This is the category with the single-value
 * wrapper fields (`childInspType`/`parentInspType` wrapping a
 * `<virtualString>`) — the specific thing this suite exists to prove
 * survives a round-trip, since a naive flat text accessor would silently
 * drop that wrapping layer.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "insp-relate-insp");
const file = "iri-real.xml";

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

describe("InspRelateInspModel round-trip fidelity", () => {
  it("round-trips iri-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseInspRelateInspXml(original);

    const exportedXml = buildExportedInspRelateInspXml(parsedOriginal);
    const parsedExported = parseInspRelateInspXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
  });

  it("re-serializes iri-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseInspRelateInspXml(
      buildExportedInspRelateInspXml(parseInspRelateInspXml(original))
    );
    const secondPass = parseInspRelateInspXml(buildExportedInspRelateInspXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("reads the wrapped virtualString text and keeps it byte-identical through a round-trip", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseInspRelateInspXml(original);
    const row = toInspRelateInspRow(parsed.records[0]);
    // Real values from the fixture — see full-schema-reference.md's
    // childInspType/parentInspType wrapping note.
    expect(row.childInspType).toContain("Follow-up");
    expect(row.parentInspType).toContain("Initial Inspection");

    const exportedXml = buildExportedInspRelateInspXml(parsed);
    expect(exportedXml).toContain("<childInspType><virtualString>");
    expect(exportedXml).toContain("<parentInspType><virtualString>");
    const reparsed = toInspRelateInspRow(parseInspRelateInspXml(exportedXml).records[0]);
    expect(reparsed.childInspType).toBe(row.childInspType);
    expect(reparsed.parentInspType).toBe(row.parentInspType);
  });

  it("has no refId attribute in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
    const parsed = parseInspRelateInspXml(original);
    expect(toInspRelateInspRow(parsed.records[0]).refId).toBe("");
  });
});
