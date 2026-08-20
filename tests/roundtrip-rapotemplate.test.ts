import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedRAPOTemplateXml,
  getApoTemplateAttributeNodes,
  parseRAPOTemplateXml,
  toApoTemplateAttributeRow,
  toRAPOTemplateRow,
} from "../lib/xml/rapoTemplate";

/**
 * RAPOTemplateModel round-trip fidelity, against a real 2-record excerpt
 * (fixtures/rapo-template/rt-real.xml, each with one child attribute, taken
 * from the same 4-record agency export) — same structural-diff approach as
 * tests/roundtrip.test.ts. Real records also carry untouched
 * formLayoutEditorVirtualModels/pageStatusModels sibling collections on the
 * parent, which these tests confirm survive the round-trip unmodified even
 * though this module never reads/writes them.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "rapo-template");
const file = "rt-real.xml";

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

describe("RAPOTemplateModel round-trip fidelity", () => {
  it("round-trips rt-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseRAPOTemplateXml(original);

    const exportedXml = buildExportedRAPOTemplateXml(parsedOriginal);
    const parsedExported = parseRAPOTemplateXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes rt-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseRAPOTemplateXml(
      buildExportedRAPOTemplateXml(parseRAPOTemplateXml(original))
    );
    const secondPass = parseRAPOTemplateXml(buildExportedRAPOTemplateXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("has no refId attribute at either level in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("preserves the untouched pageStatusModels sibling collection", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<pageStatus>");
    const exportedXml = buildExportedRAPOTemplateXml(parseRAPOTemplateXml(original));
    const originalCount = (original.match(/<pageStatus>/g) ?? []).length;
    const exportedCount = (exportedXml.match(/<pageStatus>/g) ?? []).length;
    expect(exportedCount).toBe(originalCount);
  });

  it("reads the template and its one child attribute", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseRAPOTemplateXml(original);
    const row = toRAPOTemplateRow(parsed.records[0]);
    expect(row.templateName).toBe("LIC_ADDRESS");
    expect(row.attributeCount).toBe(1);
    const attrRow = toApoTemplateAttributeRow(getApoTemplateAttributeNodes(parsed.records[0])[0]);
    expect(attrRow.attributeName).toBe("TEST");
  });
});
