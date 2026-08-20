import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedSequenceXml,
  getSequenceIntervalNodes,
  parseSequenceXml,
  toSequenceIntervalRow,
  toSequenceRow,
} from "../lib/xml/sequence";

/**
 * SequenceModel round-trip fidelity, against a real 2-record excerpt
 * (fixtures/sequence/seq-real.xml, taken from the same 148-record agency
 * export) — one record with a self-closing empty interval list, one with a
 * populated one — same structural-diff approach as tests/roundtrip.test.ts.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "sequence");
const file = "seq-real.xml";

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

describe("SequenceModel round-trip fidelity", () => {
  it("round-trips seq-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseSequenceXml(original);

    const exportedXml = buildExportedSequenceXml(parsedOriginal);
    const parsedExported = parseSequenceXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes seq-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseSequenceXml(buildExportedSequenceXml(parseSequenceXml(original)));
    const secondPass = parseSequenceXml(buildExportedSequenceXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the self-closing empty sequenceIntervalModels collection", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<sequenceIntervalModels/>");
    const exportedXml = buildExportedSequenceXml(parseSequenceXml(original));
    expect(exportedXml).toContain("<sequenceIntervalModels/>");
    expect(exportedXml).not.toContain("<sequenceIntervalModels></sequenceIntervalModels>");
  });

  it("every record shares the same refId, confirming synthetic-uid identity is required here too", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original.match(/refId="1@SequenceModel"/g)?.length).toBe(2);
  });

  it("reads the populated interval and its lastSequenceNbr", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseSequenceXml(original);
    const populated = parsed.records.find((r) => toSequenceRow(r).intervalCount > 0)!;
    const row = toSequenceRow(populated);
    expect(row.name).toBe("LIC_LOC_A");
    expect(row.intervalCount).toBe(1);
    const intervalRow = toSequenceIntervalRow(getSequenceIntervalNodes(populated)[0]);
    expect(intervalRow.lastSequenceNbr).toBe("109");
    expect(intervalRow.sequenceName).toBe("LIC_LOC_A");
  });
});
