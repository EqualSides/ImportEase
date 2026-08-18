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

/**
 * These fixtures are large enough that vitest's default toEqual() failure
 * printer (which dumps both full trees) is unreadable/impractically long.
 * This walks both trees together and reports only the first leaf where they
 * diverge, by path.
 */
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
      expectSameRecords(parsedOriginal.records, parsedExported.records);
    });

    it(`re-serializes ${file} stably on a second pass`, () => {
      const original = readFileSync(join(fixturesDir, file), "utf-8");
      const parsedOriginal = parseStandardChoiceXml(original);
      const firstPass = parseStandardChoiceXml(buildExportedXml(parsedOriginal));
      const secondPass = parseStandardChoiceXml(buildExportedXml(firstPass));
      expectSameRecords(firstPass.records, secondPass.records);
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
