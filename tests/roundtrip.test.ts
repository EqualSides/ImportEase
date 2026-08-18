import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildExportedXml, parseStandardChoiceXml } from "../lib/xml/standardChoice";

/**
 * Milestone 1's real correctness bar (CLAUDE.md): export completely
 * unmodified data and diff against the original, structurally if not
 * byte-for-byte. This is a structural diff rather than a raw string diff
 * because two things are *intentionally* not byte-identical:
 *   - exportUser/exportDateTime are rewritten to reflect the tool producing
 *     the new package (docs/schema-standard-choice.md), not copied through.
 *   - Accela's own exporter is inconsistent about insignificant whitespace
 *     between sibling elements (no whitespace before the first record, a
 *     newline before each following one) — this has no bearing on what an
 *     XML parser (Accela's importer included) reads back.
 * Everything else — every field, attribute, nesting level, and the
 * empty-string-leaf vs. self-closing-empty-collection distinction — must
 * come back identical.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "standard-choice-samples");
const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".xml"));

describe("StandardChoiceModel round-trip fidelity", () => {
  it("found the sample fixtures", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`round-trips ${file} structurally unmodified`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      const parsedOriginal = parseStandardChoiceXml(original);

      const exportedXml = buildExportedXml(parsedOriginal);
      const parsedExported = parseStandardChoiceXml(exportedXml);

      expect(parsedExported.listAttrs.version).toBe(parsedOriginal.listAttrs.version);
      expect(parsedExported.listAttrs.minorVersion).toBe(parsedOriginal.listAttrs.minorVersion);
      expect(parsedExported.listAttrs.description).toBe(parsedOriginal.listAttrs.description);

      // Deliberately rewritten every export — see file header comment.
      expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
      expect(parsedExported.listAttrs.exportDateTime).toMatch(
        /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} (AM|PM)$/
      );

      // Every record, nested value, attribute and field — including
      // undocumented ones like `valueSize` on a standardChoice — survives.
      expect(parsedExported.records).toEqual(parsedOriginal.records);
    });

    it(`re-serializes ${file} stably on a second pass`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      const parsedOriginal = parseStandardChoiceXml(original);
      const firstPass = parseStandardChoiceXml(buildExportedXml(parsedOriginal));
      const secondPass = parseStandardChoiceXml(buildExportedXml(firstPass));
      expect(secondPass.records).toEqual(firstPass.records);
    });

    it(`preserves self-closing empty collections in ${file}`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      // Sanity check the fixture actually exercises this case.
      expect(original).toContain("<standardChoiceValueI18NModels/>");

      const exportedXml = buildExportedXml(parseStandardChoiceXml(original));
      expect(exportedXml).toContain("<standardChoiceValueI18NModels/>");
      expect(exportedXml).not.toContain(
        "<standardChoiceValueI18NModels></standardChoiceValueI18NModels>"
      );
    });
  }

  it("preserves empty leaf string fields as open/close tags, not self-closed (exptestds.xml)", () => {
    const original = readFileSync(join(fixturesDir, "exptestds.xml"), "utf-8");
    expect(original).toContain("<description></description>");

    const exportedXml = buildExportedXml(parseStandardChoiceXml(original));
    expect(exportedXml).toContain("<description></description>");
    expect(exportedXml).not.toContain("<description/>");
  });

  it("keeps a raw & entity untouched when the field is never edited", () => {
    const original = readFileSync(join(fixturesDir, "sample4richard.xml"), "utf-8");
    // This sample's description text contains a raw `&amp;` in the source.
    expect(original).toContain("&amp;");
    const exportedXml = buildExportedXml(parseStandardChoiceXml(original));
    expect(exportedXml).toContain("&amp;");
    expect(exportedXml).not.toMatch(/[^&]&[^a-zA-Z#]/); // no stray unescaped bare `&`
  });
});
