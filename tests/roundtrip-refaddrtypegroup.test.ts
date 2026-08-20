import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedRefAddressTypeGroupXml,
  parseRefAddressTypeGroupXml,
  toRefAddressTypeGroupRow,
} from "../lib/xml/refAddressTypeGroup";

/**
 * RefAddressTypeGroupModel round-trip fidelity, against the real 1-record
 * export (fixtures/ref-addr-type-group/ratg-real.xml) — same structural-
 * diff approach as tests/roundtrip.test.ts. Smallest parent/child category;
 * this sample's single group has one nested address type.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "ref-addr-type-group");
const file = "ratg-real.xml";

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

describe("RefAddressTypeGroupModel round-trip fidelity", () => {
  it("round-trips ratg-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseRefAddressTypeGroupXml(original);

    const exportedXml = buildExportedRefAddressTypeGroupXml(parsedOriginal);
    const parsedExported = parseRefAddressTypeGroupXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);

    const row = toRefAddressTypeGroupRow(parsedOriginal.records[0]);
    expect(row.addrGroup).toBe("Jurisdiction Group");
    expect(row.typeCount).toBe(1);
  });

  it("re-serializes ratg-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseRefAddressTypeGroupXml(
      buildExportedRefAddressTypeGroupXml(parseRefAddressTypeGroupXml(original))
    );
    const secondPass = parseRefAddressTypeGroupXml(
      buildExportedRefAddressTypeGroupXml(firstPass)
    );
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("has no refId attribute on either the parent or child in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("keeps servProvCode consistent at both the group and type level (same field name at both levels)", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    // Both parent and child use `servProvCode` here (no field-name split,
    // unlike Shared Drop-down) — confirm both occurrences survive.
    expect(original.match(/<servProvCode>CLARKCO<\/servProvCode>/g)?.length).toBe(2);
    const exportedXml = buildExportedRefAddressTypeGroupXml(
      parseRefAddressTypeGroupXml(original)
    );
    expect(exportedXml.match(/<servProvCode>CLARKCO<\/servProvCode>/g)?.length).toBe(2);
  });
});
