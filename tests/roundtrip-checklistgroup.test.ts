import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedCheckListGroupXml,
  getGuideSheetGroupNodes,
  parseCheckListGroupXml,
  toCheckListGroupRow,
  toGuideSheetGroupRow,
} from "../lib/xml/checklistGroup";

/**
 * CheckListGroupModel round-trip fidelity, against a real 1-record excerpt
 * (fixtures/checklist-group/clg-real.xml, with 2 child guide types, taken
 * from the same 10-record agency export) — same structural-diff approach as
 * tests/roundtrip.test.ts.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "checklist-group");
const file = "clg-real.xml";

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

describe("CheckListGroupModel round-trip fidelity", () => {
  it("round-trips clg-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseCheckListGroupXml(original);

    const exportedXml = buildExportedCheckListGroupXml(parsedOriginal);
    const parsedExported = parseCheckListGroupXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(1);
  });

  it("re-serializes clg-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseCheckListGroupXml(
      buildExportedCheckListGroupXml(parseCheckListGroupXml(original))
    );
    const secondPass = parseCheckListGroupXml(buildExportedCheckListGroupXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("has no refId attribute on either level in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("reads both guide sheet group children under the one guide group", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseCheckListGroupXml(original);
    const row = toCheckListGroupRow(parsed.records[0]);
    expect(row.guideGroup).toBe("BD_ACET");
    expect(row.typeCount).toBe(2);
    const childRows = getGuideSheetGroupNodes(parsed.records[0]).map(toGuideSheetGroupRow);
    expect(childRows[0].guideType).toBe("ACET Complaint Maintenance NOV");
    expect(childRows[1].guideType).toBe("ACET Complaint NOV");
  });
});
