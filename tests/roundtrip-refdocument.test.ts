import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedRefDocumentXml,
  getXDocEntityTypeNodes,
  parseRefDocumentXml,
  toRefDocumentRow,
  toXDocEntityTypeRow,
} from "../lib/xml/refDocument";

/**
 * RefDocumentModel round-trip fidelity, against a real 2-record excerpt
 * (fixtures/ref-document/rd-real.xml — "LIC_ACC_A"/seq 1935 with zero
 * entity types, "BD_BUILDING"/seq 712 with one entity type) — same
 * structural-diff approach as tests/roundtrip.test.ts. This is a
 * conventional 2-level parent/child category; see the module doc
 * comment in lib/xml/refDocument.ts for the untouched documentsecurityModels
 * (genuine security data) and templateAttribute (embedded singleton
 * reference) fields. docCode is confirmed NOT a unique key — many real
 * rows share the same docCode with different docSeqNumber values.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "ref-document");
const file = "rd-real.xml";

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

describe("RefDocumentModel round-trip fidelity", () => {
  it("round-trips rd-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseRefDocumentXml(original);

    const exportedXml = buildExportedRefDocumentXml(parsedOriginal);
    const parsedExported = parseRefDocumentXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes rd-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseRefDocumentXml(
      buildExportedRefDocumentXml(parseRefDocumentXml(original))
    );
    const secondPass = parseRefDocumentXml(buildExportedRefDocumentXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the untouched documentsecurityModels and self-closing empty entity-type list", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<documentsecurityModels/>");
    expect(original).toContain("<XDocEntityTypes/>");
    const exportedXml = buildExportedRefDocumentXml(parseRefDocumentXml(original));
    expect(exportedXml).toContain("<documentsecurityModels/>");
    expect(exportedXml).toContain("<XDocEntityTypes/>");
  });

  it("reads LIC_ACC_A (no entity types) and BD_BUILDING (one entity type)", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseRefDocumentXml(original);
    expect(parsed.records.length).toBe(2);

    const noEntity = parsed.records.find((r) => toRefDocumentRow(r).docCode === "LIC_ACC_A")!;
    const noEntityRow = toRefDocumentRow(noEntity);
    expect(noEntityRow.entityTypeCount).toBe(0);
    expect(noEntityRow.documentType).toBe("Application");

    const withEntity = parsed.records.find((r) => toRefDocumentRow(r).docCode === "BD_BUILDING")!;
    const withEntityRow = toRefDocumentRow(withEntity);
    expect(withEntityRow.entityTypeCount).toBe(1);
    const entityType = toXDocEntityTypeRow(getXDocEntityTypeNodes(withEntity)[0]);
    expect(entityType.entType).toBe("PROFESSIONAL");
    expect(entityType.docGroup).toBe("BD_BUILDING");
  });
});
