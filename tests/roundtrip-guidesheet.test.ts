import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedGuideSheetXml,
  getGuideSheetItemNodes,
  getGuideSheetItemStatusGroupNodes,
  parseGuideSheetXml,
  toGuideSheetItemRow,
  toGuideSheetItemStatusGroupRow,
  toGuideSheetRow,
} from "../lib/xml/guideSheet";

/**
 * GuideSheetModel round-trip fidelity, against a real 2-record excerpt
 * (fixtures/guide-sheet/gs-real.xml — one sheet with an empty item list,
 * one sheet with a single item carrying a single status group, taken from
 * the same 105-record agency export) — same structural-diff approach as
 * tests/roundtrip.test.ts. This is the second three-level category (see
 * tests/roundtrip-reflookuptable.test.ts for the first).
 */

const fixturesDir = join(__dirname, "..", "fixtures", "guide-sheet");
const file = "gs-real.xml";

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

describe("GuideSheetModel round-trip fidelity", () => {
  it("round-trips gs-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseGuideSheetXml(original);

    const exportedXml = buildExportedGuideSheetXml(parsedOriginal);
    const parsedExported = parseGuideSheetXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes gs-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseGuideSheetXml(
      buildExportedGuideSheetXml(parseGuideSheetXml(original))
    );
    const secondPass = parseGuideSheetXml(buildExportedGuideSheetXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the self-closing empty GuideSheetItems collection", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<GuideSheetItems/>");
    const exportedXml = buildExportedGuideSheetXml(parseGuideSheetXml(original));
    expect(exportedXml).toContain("<GuideSheetItems/>");
    expect(exportedXml).not.toContain("<GuideSheetItems></GuideSheetItems>");
  });

  it("every record shares the same parent refId, confirming synthetic-uid identity is required here too", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original.match(/<guideSheet refId="1@GuideSheetModel">/g)?.length).toBe(2);
  });

  it("reads the populated item and its single status group", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseGuideSheetXml(original);
    const populated = parsed.records.find((r) => toGuideSheetRow(r).itemCount > 0)!;
    const row = toGuideSheetRow(populated);
    expect(row.guideType).toBe("Business License Enforcement - NOCT");
    expect(row.itemCount).toBe(1);
    const item = getGuideSheetItemNodes(populated)[0];
    const itemRow = toGuideSheetItemRow(item);
    expect(itemRow.guideItemText).toBe("NOV Details");
    expect(itemRow.statusGroupCount).toBe(1);
    const statusGroupRow = toGuideSheetItemStatusGroupRow(
      getGuideSheetItemStatusGroupNodes(item)[0]
    );
    expect(statusGroupRow.ststus).toBe("NOTC");
    expect(statusGroupRow.statusGroup).toBe("LIC_NOTC");
  });
});
