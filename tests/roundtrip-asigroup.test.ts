import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedASIGroupXml,
  getASIFieldNodes,
  getASIDropdownValueNodes,
  parseASIGroupXml,
  toASIGroupRow,
  toASIFieldRow,
  toASIDropdownValueRow,
} from "../lib/xml/asiGroup";

/**
 * ASIGroupModel round-trip fidelity, against a real 3-record excerpt
 * (fixtures/asi-group/asig-real.xml — "FP_OCC_MAST" (one field, zero
 * dropdown values, one template layout config), "LIC_IND" (one field,
 * one dropdown value, one template layout config), and a second
 * "LIC_IND"-coded record (four fields, zero dropdown values, one
 * template layout config) — together covering the group->field->value
 * tree, taken from the same 685-record agency export) — same
 * structural-diff approach as tests/roundtrip.test.ts. This is the
 * fourth three-level category (see tests/roundtrip-smartchoicegroup.test.ts
 * for the third). Group codes are reused across separate top-level
 * records here, confirming synthetic-uid identity is required, same as
 * every other non-unique-identity category.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "asi-group");
const file = "asig-real.xml";

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

describe("ASIGroupModel round-trip fidelity", () => {
  it("round-trips asig-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseASIGroupXml(original);

    const exportedXml = buildExportedASIGroupXml(parsedOriginal);
    const parsedExported = parseASIGroupXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(3);
  });

  it("re-serializes asig-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseASIGroupXml(buildExportedASIGroupXml(parseASIGroupXml(original)));
    const secondPass = parseASIGroupXml(buildExportedASIGroupXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the untouched templateLayoutConfigModels and self-closing empty arms", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<templateLayoutConfigModel>");
    expect(original).toContain("<asiSecurityModels/>");
    expect(original).toContain("<sharedDropDownModels/>");
    const exportedXml = buildExportedASIGroupXml(parseASIGroupXml(original));
    const originalCount = (original.match(/<templateLayoutConfigModel>/g) ?? []).length;
    const exportedCount = (exportedXml.match(/<templateLayoutConfigModel>/g) ?? []).length;
    expect(exportedCount).toBe(originalCount);
    expect(exportedXml).toContain("<asiSecurityModels/>");
    expect(exportedXml).toContain("<sharedDropDownModels/>");
  });

  it("has no refId attribute anywhere in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("reads FP_OCC_MAST's one field and LIC_IND's field with its one dropdown value", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseASIGroupXml(original);

    const mast = parsed.records.find(
      (r) => toASIGroupRow(r).appSpecInfoGroupCode === "FP_OCC_MAST"
    )!;
    const mastRow = toASIGroupRow(mast);
    expect(mastRow.fieldCount).toBe(1);
    const mastField = toASIFieldRow(getASIFieldNodes(mast)[0]);
    expect(mastField.r1CheckboxDesc).toBe("General Details");
    expect(mastField.valueCount).toBe(0);

    const licRecords = parsed.records.filter(
      (r) => toASIGroupRow(r).appSpecInfoGroupCode === "LIC_IND"
    );
    expect(licRecords.length).toBe(2);
    const withValue = licRecords.find((r) => toASIGroupRow(r).fieldCount === 1)!;
    const licField = getASIFieldNodes(withValue)[0];
    const licFieldRow = toASIFieldRow(licField);
    expect(licFieldRow.valueCount).toBe(1);
    const dropdownRow = toASIDropdownValueRow(getASIDropdownValueNodes(licField)[0]);
    expect(dropdownRow.groupCode).toBe("LIC_IND");
  });
});
