import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedFormLayoutEditorXml,
  getFormLayoutElementNodes,
  parseFormLayoutEditorXml,
  toFormLayoutScreenRow,
  toFormLayoutElementRow,
} from "../lib/xml/formLayoutEditor";

/**
 * FormLayoutEditorModel round-trip fidelity, against a real 2-record
 * excerpt (fixtures/form-layout-editor/fle-real.xml — screen 2221 with
 * one element, screen 1991 with zero elements — taken from the same
 * 430-screen, 10,373-element, 24MB agency export, deliberately picked as
 * two of the file's smallest real records) — same structural-diff
 * approach as tests/roundtrip.test.ts. This is a conventional 2-level
 * parent/child category; see the module doc comment in
 * lib/xml/formLayoutEditor.ts for the untouched formLayoutPermissionModels
 * (genuine security data) and formLayoutEditorI18NModels sibling arms.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "form-layout-editor");
const file = "fle-real.xml";

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

describe("FormLayoutEditorModel round-trip fidelity", () => {
  it("round-trips fle-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseFormLayoutEditorXml(original);

    const exportedXml = buildExportedFormLayoutEditorXml(parsedOriginal);
    const parsedExported = parseFormLayoutEditorXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes fle-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseFormLayoutEditorXml(
      buildExportedFormLayoutEditorXml(parseFormLayoutEditorXml(original))
    );
    const secondPass = parseFormLayoutEditorXml(buildExportedFormLayoutEditorXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the untouched formLayoutPermissionModels and self-closing empty element list", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<formLayoutPermissionModel>");
    expect(original).toContain("<formLayoutEditElementModels/>");
    const exportedXml = buildExportedFormLayoutEditorXml(parseFormLayoutEditorXml(original));
    expect(exportedXml).toContain("<formLayoutPermissionModel>");
    expect(exportedXml).toContain("<formLayoutEditElementModels/>");
  });

  it("has no refId attribute anywhere in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("reads screen 2221's one element and screen 1991's zero elements", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseFormLayoutEditorXml(original);

    const withElement = parsed.records.find((r) => toFormLayoutScreenRow(r).screenId === "2221")!;
    const row = toFormLayoutScreenRow(withElement);
    expect(row.elementCount).toBe(1);
    expect(row.screenName).toBe("PZ_ORDINANCE_Project_Description");
    const element = toFormLayoutElementRow(getFormLayoutElementNodes(withElement)[0]);
    expect(element.screenElementName).toBe("Project_Description");

    const empty = parsed.records.find((r) => toFormLayoutScreenRow(r).screenId === "1991")!;
    const emptyRow = toFormLayoutScreenRow(empty);
    expect(emptyRow.elementCount).toBe(0);
    expect(emptyRow.screenType).toBe("TSI");
  });
});
