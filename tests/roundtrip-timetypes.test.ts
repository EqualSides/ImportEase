import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildExportedTimeTypesXml, parseTimeTypesXml, toTimeTypesRow } from "../lib/xml/timeTypes";

/**
 * TimeTypesModel round-trip fidelity, against a real 1-record excerpt
 * (fixtures/time-types/tt-real.xml, taken from the same 11-record agency
 * export, deliberately picked with an empty timeTypeSecurityModels — real
 * records can carry ⚠️ security/permission references there, and this
 * module never reads/edits that sub-structure) — same structural-diff
 * approach as tests/roundtrip.test.ts.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "time-types");
const file = "tt-real.xml";

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

describe("TimeTypesModel round-trip fidelity", () => {
  it("round-trips tt-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseTimeTypesXml(original);

    const exportedXml = buildExportedTimeTypesXml(parsedOriginal);
    const parsedExported = parseTimeTypesXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(1);
  });

  it("re-serializes tt-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseTimeTypesXml(buildExportedTimeTypesXml(parseTimeTypesXml(original)));
    const secondPass = parseTimeTypesXml(buildExportedTimeTypesXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("has no refId attribute in the real sample and uses servProvCode (not serviceProviderCode)", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
    expect(original).toContain("<servProvCode>");
    expect(original).not.toContain("<serviceProviderCode>");
  });

  it("reads billable/time fields", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseTimeTypesXml(original);
    const row = toTimeTypesRow(parsed.records[0]);
    expect(row.timeTypeName).toBe("Travel");
    expect(row.billableFlag).toBe("Y");
    expect(row.servProvCode).toBe("CLARKCO");
  });
});
