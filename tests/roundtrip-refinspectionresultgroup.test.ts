import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedRefInspectionResultGroupXml,
  parseRefInspectionResultGroupXml,
  toRefInspectionResultGroupRow,
} from "../lib/xml/refInspectionResultGroup";

/**
 * RefInspectionResultGroupModel round-trip fidelity, against a real
 * 1-record excerpt (fixtures/ref-inspection-result-group/rirg-real.xml,
 * taken from the same 40-record agency export) — same structural-diff
 * approach as tests/roundtrip.test.ts.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "ref-inspection-result-group");
const file = "rirg-real.xml";

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

describe("RefInspectionResultGroupModel round-trip fidelity", () => {
  it("round-trips rirg-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseRefInspectionResultGroupXml(original);

    const exportedXml = buildExportedRefInspectionResultGroupXml(parsedOriginal);
    const parsedExported = parseRefInspectionResultGroupXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(1);
  });

  it("re-serializes rirg-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseRefInspectionResultGroupXml(
      buildExportedRefInspectionResultGroupXml(parseRefInspectionResultGroupXml(original))
    );
    const secondPass = parseRefInspectionResultGroupXml(
      buildExportedRefInspectionResultGroupXml(firstPass)
    );
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("has no refId on the parent but does on the child", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("<refInspResultGroup refId=");
    expect(original).toContain('<inspectionResultGroupModel refId="1@InspectionResultGroupModel">');
  });

  it("reads result group/category and the one child result", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseRefInspectionResultGroupXml(original);
    const row = toRefInspectionResultGroupRow(parsed.records[0]);
    expect(row.inspResultGroup).toBe("LIC_BL_CONV");
    expect(row.resultCatrgory).toBe("RESULT");
    expect(row.resultCount).toBe(1);
  });
});
