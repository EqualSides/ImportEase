import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedSharedDropDownXml,
  parseSharedDropDownXml,
  toSharedDropDownRow,
} from "../lib/xml/sharedDropDownList";

/**
 * SharedDropDownListModel's round-trip test, same structural-diff approach
 * as tests/roundtrip.test.ts (see that file's header comment for the
 * exportUser/exportDateTime/whitespace rationale — identical here since both
 * share lib/xml/pnode.ts's parse/serialize core).
 *
 * fixtures/shared-dropdown/sdd-real.xml is 4 complete, unmodified records
 * extracted from a real 345-record SharedDropDownListModel.xml (the same
 * full-agency export full-schema-reference.md was derived from) — chosen to
 * exercise real quirks a hand-built fixture would've missed: no `refId`
 * attribute on either the parent or child record (present in the schema doc
 * as "usually" but this export simply doesn't set it), the parent/child
 * Agency ID field-name split with real values, `type` actually being
 * "ShareDropDown" (not the guessed "SystemSwitch"), real `&amp;` entities,
 * and — the big one — a record (idx 314 in the source file) whose
 * childDrillDownValueMapModels/parentDrillDownValueMapModels are actually
 * *populated* with nested drill-down mappings, not just empty self-closing
 * collections. That's the real proof the "preserve untouched, don't build
 * an editor for it" treatment those fields get (see the module doc comment
 * in lib/xml/sharedDropDownList.ts) survives a round-trip on real content,
 * not just on an empty placeholder.
 *
 * fixtures/shared-dropdown/sdd-empty.xml is the one case the real sample
 * doesn't happen to contain — a list with zero values, i.e. a self-closing
 * `<sharedDropDownList/>` — and is hand-built to cover just that.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "shared-dropdown");
const files = ["sdd-real.xml", "sdd-empty.xml"];

function firstDiffPath(a: unknown, b: unknown, path: string): string | null {
  if (a === b) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return `${path}: array length ${a.length} vs ${b.length}`;
    }
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

describe("SharedDropDownListModel round-trip fidelity", () => {
  for (const file of files) {
    it(`round-trips ${file} structurally unmodified`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      const parsedOriginal = parseSharedDropDownXml(original);

      const exportedXml = buildExportedSharedDropDownXml(parsedOriginal);
      const parsedExported = parseSharedDropDownXml(exportedXml);

      expect(parsedExported.listAttrs.version).toBe(parsedOriginal.listAttrs.version);
      expect(parsedExported.listAttrs.minorVersion).toBe(parsedOriginal.listAttrs.minorVersion);
      expect(parsedExported.listAttrs.description).toBe(parsedOriginal.listAttrs.description);

      expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
      expect(parsedExported.listAttrs.exportDateTime).toMatch(
        /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} (AM|PM)$/
      );

      expectSameRecords(parsedOriginal.records, parsedExported.records);
    });

    it(`re-serializes ${file} stably on a second pass`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      const parsedOriginal = parseSharedDropDownXml(original);
      const firstPass = parseSharedDropDownXml(buildExportedSharedDropDownXml(parsedOriginal));
      const secondPass = parseSharedDropDownXml(buildExportedSharedDropDownXml(firstPass));
      expectSameRecords(firstPass.records, secondPass.records);
    });
  }

  it("preserves self-closing empty collections, including a record with a populated drill-down map (sdd-real.xml)", () => {
    const original = readFileSync(join(fixturesDir, "sdd-real.xml"), "utf-8");
    expect(original).toContain("<standardChoiceValueI18NModels/>");
    expect(original).toContain("<childDrillDownValueMapModels/>");
    // The populated (non-empty) case — proves this isn't just classified
    // correctly when empty, the untouched populated content round-trips too.
    expect(original).toContain("<parentDrillDownValueMapModels><drillDownValueMap");

    const exportedXml = buildExportedSharedDropDownXml(parseSharedDropDownXml(original));
    expect(exportedXml).toContain("<standardChoiceValueI18NModels/>");
    expect(exportedXml).toContain("<childDrillDownValueMapModels/>");
    expect(exportedXml).toContain("<parentDrillDownValueMapModels><drillDownValueMap");
  });

  it("preserves an empty list (zero values, self-closing sharedDropDownList) in sdd-empty.xml", () => {
    const original = readFileSync(join(fixturesDir, "sdd-empty.xml"), "utf-8");
    expect(original).toContain("<sharedDropDownList/>");
    const exportedXml = buildExportedSharedDropDownXml(parseSharedDropDownXml(original));
    expect(exportedXml).toContain("<sharedDropDownList/>");
  });

  it("preserves empty leaf string fields as open/close tags, not self-closed (sdd-real.xml)", () => {
    const original = readFileSync(join(fixturesDir, "sdd-real.xml"), "utf-8");
    expect(original).toContain("<description></description>");

    const exportedXml = buildExportedSharedDropDownXml(parseSharedDropDownXml(original));
    expect(exportedXml).toContain("<description></description>");
    expect(exportedXml).not.toContain("<description/>");
  });

  it("keeps a raw entity untouched when the field is never edited (sdd-real.xml)", () => {
    const original = readFileSync(join(fixturesDir, "sdd-real.xml"), "utf-8");
    expect(original).toContain("&amp;");
    const exportedXml = buildExportedSharedDropDownXml(parseSharedDropDownXml(original));
    expect(exportedXml).toContain("&amp;");
    expect(exportedXml).not.toMatch(/[^&]&[^a-zA-Z#]/); // no stray unescaped bare `&`
  });

  it("keeps parent serviceProviderCode and child servProvCode as distinct fields (sdd-real.xml)", () => {
    const original = readFileSync(join(fixturesDir, "sdd-real.xml"), "utf-8");
    // Sanity check the field-name split the module doc comment describes
    // actually round-trips both ways rather than one silently overwriting
    // the other — real data, not an assumption.
    expect(original).toContain("<serviceProviderCode>CLARKCO</serviceProviderCode>");
    expect(original).toContain("<servProvCode>CLARKCO</servProvCode>");
    const exportedXml = buildExportedSharedDropDownXml(parseSharedDropDownXml(original));
    expect(exportedXml).toContain("<serviceProviderCode>CLARKCO</serviceProviderCode>");
    expect(exportedXml).toContain("<servProvCode>CLARKCO</servProvCode>");
  });

  it("handles a record with no refId attribute on either the parent or child (sdd-real.xml)", () => {
    // This export simply never sets refId for this category — confirms the
    // parser/serializer don't assume it's always present.
    const original = readFileSync(join(fixturesDir, "sdd-real.xml"), "utf-8");
    const parsed = parseSharedDropDownXml(original);
    expect(toSharedDropDownRow(parsed.records[0]).refId).toBe("");
  });
});
