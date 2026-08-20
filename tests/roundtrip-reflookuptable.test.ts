import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedRefLookupTableXml,
  getLookupTableColumnNodes,
  getLookupTableValueNodes,
  parseRefLookupTableXml,
  toLookupTableColumnRow,
  toLookupTableValueRow,
  toRefLookupTableRow,
} from "../lib/xml/refLookupTable";

/**
 * RefLookupTableModel round-trip fidelity, against a real 2-record excerpt
 * (fixtures/ref-lookup-table/rlt-real.xml — one single-column/single-value
 * table, one two-column/eight-value table, taken from the same 9-record
 * agency export) — same structural-diff approach as tests/roundtrip.test.ts.
 * This is the first three-level category (table -> column -> value); these
 * tests specifically exercise the unusual `<lookupTableValue>` (singular)
 * wrapper-around-repeating-`<lookupTableValues>` (plural) shape described in
 * lib/xml/refLookupTable.ts's module doc comment.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "ref-lookup-table");
const file = "rlt-real.xml";

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

describe("RefLookupTableModel round-trip fidelity", () => {
  it("round-trips rlt-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseRefLookupTableXml(original);

    const exportedXml = buildExportedRefLookupTableXml(parsedOriginal);
    const parsedExported = parseRefLookupTableXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes rlt-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseRefLookupTableXml(
      buildExportedRefLookupTableXml(parseRefLookupTableXml(original))
    );
    const secondPass = parseRefLookupTableXml(buildExportedRefLookupTableXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("has no refId attribute at any of the three levels in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("reads the single-column/single-value table correctly", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseRefLookupTableXml(original);
    const row = toRefLookupTableRow(parsed.records[0]);
    expect(row.lookupTableName).toBe("HAZ Mat Permit Requirements");
    expect(row.columnCount).toBe(1);
    const columns = getLookupTableColumnNodes(parsed.records[0]);
    const colRow = toLookupTableColumnRow(columns[0]);
    expect(colRow.lookupColumnName).toBe("Total Gases");
    expect(colRow.valueCount).toBe(1);
    const values = getLookupTableValueNodes(columns[0]);
    expect(toLookupTableValueRow(values[0]).lookupColumnValue).toBe("12");
  });

  it("reads the two-column/eight-value table and preserves per-column value counts", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseRefLookupTableXml(original);
    const row = toRefLookupTableRow(parsed.records[1]);
    expect(row.lookupTableName).toBe("BD_RES_TrafficMitigatiion_Fee");
    expect(row.columnCount).toBe(2);
    const columns = getLookupTableColumnNodes(parsed.records[1]);
    expect(columns.length).toBe(2);
    for (const col of columns) {
      expect(toLookupTableColumnRow(col).valueCount).toBe(4);
    }
    const firstColumnValues = getLookupTableValueNodes(columns[0]).map(toLookupTableValueRow);
    expect(firstColumnValues.map((v) => v.lookupColumnValue)).toEqual([
      "Rhodes Ranch",
      "Southern Highlands",
      "Pinnacle Peaks",
      "Mountains Edge",
    ]);
  });

  it("preserves the wrapped <lookupTableValue> around repeating <lookupTableValues> through export", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const exportedXml = buildExportedRefLookupTableXml(parseRefLookupTableXml(original));
    expect(exportedXml).toContain("<lookupTableValue><lookupTableValues>");
    const originalWrapperCount = (original.match(/<lookupTableValue>/g) ?? []).length;
    const exportedWrapperCount = (exportedXml.match(/<lookupTableValue>/g) ?? []).length;
    expect(exportedWrapperCount).toBe(originalWrapperCount);
  });
});
