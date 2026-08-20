import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedInspectionGroupXml,
  getInspectionTypeNodes,
  parseInspectionGroupXml,
  toInspectionGroupRow,
  toInspectionTypeRow,
} from "../lib/xml/inspectionGroup";

/**
 * InspectionGroupModel round-trip fidelity, against a real 2-record
 * excerpt (fixtures/inspection-group/ig-real.xml — "NONE" and
 * "PLN_GENERAL", each with a single inspection type — the two smallest
 * real records in the 1.4MB source file) — same structural-diff approach
 * as tests/roundtrip.test.ts. This is a conventional 2-level parent/child
 * category; see the module doc comment in lib/xml/inspectionGroup.ts for
 * the untouched inspectionTypeSecurityModels sibling arm (genuine
 * security data).
 */

const fixturesDir = join(__dirname, "..", "fixtures", "inspection-group");
const file = "ig-real.xml";

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

describe("InspectionGroupModel round-trip fidelity", () => {
  it("round-trips ig-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseInspectionGroupXml(original);

    const exportedXml = buildExportedInspectionGroupXml(parsedOriginal);
    const parsedExported = parseInspectionGroupXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes ig-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseInspectionGroupXml(
      buildExportedInspectionGroupXml(parseInspectionGroupXml(original))
    );
    const secondPass = parseInspectionGroupXml(buildExportedInspectionGroupXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the untouched self-closing inspectionTypeSecurityModels arm", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<inspectionTypeSecurityModels/>");
    const exportedXml = buildExportedInspectionGroupXml(parseInspectionGroupXml(original));
    expect(exportedXml).toContain("<inspectionTypeSecurityModels/>");
  });

  it("has no refId attribute anywhere in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("reads NONE and PLN_GENERAL, each with one inspection type", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseInspectionGroupXml(original);
    expect(parsed.records.length).toBe(2);

    const none = parsed.records.find((r) => toInspectionGroupRow(r).inspCode === "NONE")!;
    const noneRow = toInspectionGroupRow(none);
    expect(noneRow.typeCount).toBe(1);
    const noneType = toInspectionTypeRow(getInspectionTypeNodes(none)[0]);
    expect(noneType.inspType).toBe("NONE");

    const pln = parsed.records.find((r) => toInspectionGroupRow(r).inspCode === "PLN_GENERAL")!;
    const plnRow = toInspectionGroupRow(pln);
    expect(plnRow.typeCount).toBe(1);
    const plnType = toInspectionTypeRow(getInspectionTypeNodes(pln)[0]);
    expect(plnType.inspType).toBe("Site Visit");
    expect(plnType.inspResultGroup).toBe("PLN_GENERAL");
  });
});
