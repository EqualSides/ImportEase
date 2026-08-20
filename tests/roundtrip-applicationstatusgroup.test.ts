import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedApplicationStatusGroupXml,
  parseApplicationStatusGroupXml,
  toApplicationStatusGroupRow,
} from "../lib/xml/applicationStatusGroup";

/**
 * ApplicationStatusGroupModel round-trip fidelity, against a real 2-record
 * excerpt (fixtures/application-status-group/asg-real.xml, taken from the
 * same 69-record agency export) — same structural-diff approach as
 * tests/roundtrip.test.ts.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "application-status-group");
const file = "asg-real.xml";

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

describe("ApplicationStatusGroupModel round-trip fidelity", () => {
  it("round-trips asg-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseApplicationStatusGroupXml(original);

    const exportedXml = buildExportedApplicationStatusGroupXml(parsedOriginal);
    const parsedExported = parseApplicationStatusGroupXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes asg-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseApplicationStatusGroupXml(
      buildExportedApplicationStatusGroupXml(parseApplicationStatusGroupXml(original))
    );
    const secondPass = parseApplicationStatusGroupXml(
      buildExportedApplicationStatusGroupXml(firstPass)
    );
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("has no refId on the parent but a non-unique refId on each child", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("<applicationStatusGroup refId=");
    expect(original.match(/refId="1@AppStatusGroupModel"/g)?.length).toBe(2);
  });

  it("reads status/statusType per child status record", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseApplicationStatusGroupXml(original);
    const row = toApplicationStatusGroupRow(parsed.records[0]);
    expect(row.appStatusGroupCode).toBe("LIC_IND");
    expect(row.statusCount).toBe(1);
  });
});
