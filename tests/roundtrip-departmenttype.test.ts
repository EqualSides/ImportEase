import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedDepartmentTypeXml,
  parseDepartmentTypeXml,
  setDepartmentTypeField,
  toDepartmentTypeRow,
} from "../lib/xml/departmentType";

/**
 * DepartMentTypeModel round-trip fidelity, against a real 2-record
 * excerpt (fixtures/department-type/dt-real.xml — the two smallest real
 * records in the 60-record source file: "Accela" (all-NA placeholder)
 * and "PW Bonds") — same structural-diff approach as
 * tests/roundtrip.test.ts. See the module doc comment in
 * lib/xml/departmentType.ts for the six untouched embedded singleton
 * sub-objects (bureauModel, divisionModel, groupModel, officeModel,
 * organizationAgencyModel, sectionModel).
 */

const fixturesDir = join(__dirname, "..", "fixtures", "department-type");
const file = "dt-real.xml";

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

describe("DepartMentTypeModel round-trip fidelity", () => {
  it("round-trips dt-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseDepartmentTypeXml(original);

    const exportedXml = buildExportedDepartmentTypeXml(parsedOriginal);
    const parsedExported = parseDepartmentTypeXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes dt-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseDepartmentTypeXml(
      buildExportedDepartmentTypeXml(parseDepartmentTypeXml(original))
    );
    const secondPass = parseDepartmentTypeXml(buildExportedDepartmentTypeXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("reads the Accela and PW Bonds rows correctly", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseDepartmentTypeXml(original);
    expect(parsed.records.length).toBe(2);

    const accela = parsed.records.find((r) => toDepartmentTypeRow(r).departMentTypeName === "Accela")!;
    const accelaRow = toDepartmentTypeRow(accela);
    expect(accelaRow.agencyCode).toBe("NA");
    expect(accelaRow.departMentTypeKey).toBe("CLARKCO/NA/NA/NA/NA/NA/NA");

    const bonds = parsed.records.find((r) => toDepartmentTypeRow(r).departMentTypeName === "PW Bonds")!;
    const bondsRow = toDepartmentTypeRow(bonds);
    expect(bondsRow.agencyCode).toBe("PW");
    expect(bondsRow.bureauCode).toBe("BONDS");
  });

  it("cascades agencyCode into every sibling sub-object that carries a copy of it", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseDepartmentTypeXml(original);
    const record = parsed.records.find((r) => toDepartmentTypeRow(r).departMentTypeName === "PW Bonds")!;

    setDepartmentTypeField(record, "agencyCode", "NEWAGENCY");

    const exportedXml = buildExportedDepartmentTypeXml(parsed);
    // bureauModel, divisionModel, groupModel, officeModel,
    // organizationAgencyModel, sectionModel, and the top-level field all
    // carry an agencyCode — 7 total occurrences of the new value.
    const occurrences = (exportedXml.match(/<agencyCode>NEWAGENCY<\/agencyCode>/g) ?? []).length;
    expect(occurrences).toBe(7);
    expect(exportedXml).not.toContain("<agencyCode>PW</agencyCode>");
  });
});
