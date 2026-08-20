import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedSmartChoiceGroupXml,
  getSmartChoiceNodes,
  getSmartChoiceOptionNodes,
  parseSmartChoiceGroupXml,
  toSmartChoiceGroupRow,
  toSmartChoiceRow,
  toSmartChoiceOptionRow,
} from "../lib/xml/smartChoiceGroup";

/**
 * SmartChoiceGroupModel round-trip fidelity, against a real 2-record excerpt
 * (fixtures/smart-choice-group/scg-real.xml — two groups, each with 26 smart
 * choices, one of which per group carries two options, taken from the same
 * 136-record agency export) — same structural-diff approach as
 * tests/roundtrip.test.ts. This is the third three-level category (see
 * tests/roundtrip-reflookuptable.test.ts and tests/roundtrip-guidesheet.test.ts
 * for the first two). Each group also carries an untouched
 * structureTypeModels sibling collection that this module never reads or
 * writes but must round-trip unmodified.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "smart-choice-group");
const file = "scg-real.xml";

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

describe("SmartChoiceGroupModel round-trip fidelity", () => {
  it("round-trips scg-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseSmartChoiceGroupXml(original);

    const exportedXml = buildExportedSmartChoiceGroupXml(parsedOriginal);
    const parsedExported = parseSmartChoiceGroupXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes scg-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseSmartChoiceGroupXml(
      buildExportedSmartChoiceGroupXml(parseSmartChoiceGroupXml(original))
    );
    const secondPass = parseSmartChoiceGroupXml(buildExportedSmartChoiceGroupXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the untouched structureTypeModels sibling collection", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<structureTypeModels>");
    const exportedXml = buildExportedSmartChoiceGroupXml(parseSmartChoiceGroupXml(original));
    const originalCount = (original.match(/<structureTypeModel refId=/g) ?? []).length;
    const exportedCount = (exportedXml.match(/<structureTypeModel refId=/g) ?? []).length;
    expect(exportedCount).toBe(originalCount);
  });

  it("every record shares the same parent refId, confirming synthetic-uid identity is required here too", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original.match(/<smartChoiceGroup refId="1@SmartChoiceGroupModel">/g)?.length).toBe(2);
  });

  it("has no refId attribute on smart choices or options in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("<smartChoice refId");
    expect(original).not.toContain("<smartChoiceOption refId");
  });

  it("reads a group, its smart choice count, and the populated smart choice's options", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseSmartChoiceGroupXml(original);
    const group = parsed.records.find((r) => toSmartChoiceGroupRow(r).groupCode === "LIC_AMND")!;
    const row = toSmartChoiceGroupRow(group);
    expect(row.choiceCount).toBe(26);

    const choices = getSmartChoiceNodes(group);
    const populated = choices.find((c) => toSmartChoiceRow(c).optionCount > 0)!;
    const choiceRow = toSmartChoiceRow(populated);
    expect(choiceRow.functionName).toBe("MULTIPLE_CONTACTS");
    expect(choiceRow.optionCount).toBe(2);

    const optionRow = toSmartChoiceOptionRow(getSmartChoiceOptionNodes(populated)[0]);
    expect(optionRow.functionOption).toBe("Owner");
    expect(optionRow.groupName).toBe("LIC_AMND");
  });
});
