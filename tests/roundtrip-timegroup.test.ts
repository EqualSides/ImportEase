import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedTimeGroupXml,
  getXTimeGroupTypeNodes,
  parseTimeGroupXml,
  toTimeGroupRow,
  toXTimeGroupTypeRow,
} from "../lib/xml/timeGroup";

/**
 * TimeGroupModel round-trip fidelity, against a real 1-record excerpt
 * (fixtures/time-group/tg-real.xml, taken from the same 5-record agency
 * export) — one populated child time type and an empty
 * timeGroupSecurityModels (real records can carry ⚠️ security/permission
 * references there; this module never reads/edits that sub-structure) —
 * same structural-diff approach as tests/roundtrip.test.ts.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "time-group");
const file = "tg-real.xml";

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

describe("TimeGroupModel round-trip fidelity", () => {
  it("round-trips tg-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseTimeGroupXml(original);

    const exportedXml = buildExportedTimeGroupXml(parsedOriginal);
    const parsedExported = parseTimeGroupXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(1);
  });

  it("re-serializes tg-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseTimeGroupXml(buildExportedTimeGroupXml(parseTimeGroupXml(original)));
    const secondPass = parseTimeGroupXml(buildExportedTimeGroupXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("has no refId attribute and uses servProvCode at both levels", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
    expect(original.match(/<servProvCode>CLARKCO<\/servProvCode>/g)?.length).toBe(2);
  });

  it("reads the populated child time type and its duplicated timeGroupSeq", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseTimeGroupXml(original);
    const row = toTimeGroupRow(parsed.records[0]);
    expect(row.timeGroupName).toBe("Audit - Actual");
    expect(row.typeCount).toBe(1);
    const childRow = toXTimeGroupTypeRow(getXTimeGroupTypeNodes(parsed.records[0])[0]);
    expect(childRow.timeGroupSeq).toBe(row.timeGroupSeq);
    expect(childRow.timeTypeSeq).toBe("14");
  });
});
