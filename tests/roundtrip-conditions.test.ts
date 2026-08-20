import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedConditionsXml,
  parseConditionsXml,
  setConditionField,
  toConditionRow,
} from "../lib/xml/conditions";

/**
 * ConditionsModel round-trip fidelity, against the real fixture
 * (fixtures/conditions/cond-real.xml). Unlike every other category
 * fixture this session, the real export contains exactly ONE condition
 * record in total — there is no second real record to draw from, so
 * this suite (unavoidably) exercises only a single row. See the module
 * doc comment in lib/xml/conditions.ts for the full list of untouched
 * embedded sub-objects (conditionPermissionModels, conditionsTypeModel,
 * conditionRecordTypeModels, etc.) this category never reads or writes.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "conditions");
const file = "cond-real.xml";

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

describe("ConditionsModel round-trip fidelity", () => {
  it("round-trips cond-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseConditionsXml(original);

    const exportedXml = buildExportedConditionsXml(parsedOriginal);
    const parsedExported = parseConditionsXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(1);
  });

  it("re-serializes cond-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseConditionsXml(buildExportedConditionsXml(parseConditionsXml(original)));
    const secondPass = parseConditionsXml(buildExportedConditionsXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("reads the LVVWD Clearance condition (814) row correctly", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseConditionsXml(original);
    expect(parsed.records.length).toBe(1);

    const row = toConditionRow(parsed.records[0]);
    expect(row.conditionNbr).toBe("814");
    expect(row.serviceProviderCode).toBe("CLARKCO");
    expect(row.conditionDesc).toBe("LVVWD Clearance");
    expect(row.conditionComment).toBe("LVVWD clearance");
    expect(row.conditionGroup).toBe("Building");
    expect(row.conditionType).toBe("Prior to Permit Issuance");
    expect(row.conditionApproveFlag).toBe("Y");
    expect(row.displayConditionNotice).toBe("Y");
    expect(row.displayNoticeOnACA).toBe("Y");
    expect(row.displayNoticeOnACAFee).toBe("N");
    expect(row.impactCode).toBe("Notice");
    expect(row.includeInConditionName).toBe("N");
    expect(row.includeInShortDescription).toBe("N");
    expect(row.inheritable).toBe("N");
    expect(row.isInspectionSelected).toBe("Y");
    expect(row.isPermissionSelected).toBe("Y");
    expect(row.isRecordTypesSelected).toBe("Y");
    expect(row.isWorkflowSelected).toBe("Y");
  });

  it("edits a scalar field without touching the nested conditionGroup inside conditionsTypeModel", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseConditionsXml(original);
    const record = parsed.records[0];

    setConditionField(record, "conditionDesc", "LVVWD Clearance UPDATED");

    const exportedXml = buildExportedConditionsXml(parsed);
    expect(exportedXml).toContain("<conditionDesc>LVVWD Clearance UPDATED</conditionDesc>");
    // The nested conditionsTypeModel > conditionGroup (a whole embedded
    // reference object, not the top-level scalar) must remain untouched.
    expect(exportedXml).toContain('<conditionGroup refId="5@ConditionGroupTypeModel">');
    expect(exportedXml).toContain("<name>CONDITION GROUP</name>");
  });
});
