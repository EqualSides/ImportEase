import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedExpressionBuilderXml,
  getArmNodes,
  parseExpressionBuilderXml,
  toExpressionRow,
  toExpressCalculationRow,
  toExpressCriteriaRow,
  toExpressFieldRow,
} from "../lib/xml/expressionBuilder";

/**
 * RefExpressionModel round-trip fidelity, against a real 2-record excerpt
 * (fixtures/expression-builder/expr-real.xml — "LIC_MGT_A_BUSICONT_PHONE"
 * (one calculation, four fields, zero criteria), "LIC_ACCR_A_MobileFoodUnits"
 * (two calculations, two criteria, eight fields) — taken from the same
 * real 141-record agency export. This is the fourth "heterogeneous-arm"
 * category (see tests/roundtrip-virprocess.test.ts for the third).
 *
 * The criteria arm is a known thin spot: MobileFoodUnits is the ONLY
 * record in the entire real 141-record source file with expressCriteria
 * populated at all, disclosed here rather than silently worked around
 * (same treatment as Conditions' single-record limitation).
 */

const fixturesDir = join(__dirname, "..", "fixtures", "expression-builder");
const file = "expr-real.xml";

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

describe("RefExpressionModel round-trip fidelity", () => {
  it("round-trips expr-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseExpressionBuilderXml(original);

    const exportedXml = buildExportedExpressionBuilderXml(parsedOriginal);
    const parsedExported = parseExpressionBuilderXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes expr-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseExpressionBuilderXml(
      buildExportedExpressionBuilderXml(parseExpressionBuilderXml(original))
    );
    const secondPass = parseExpressionBuilderXml(buildExportedExpressionBuilderXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the always-empty expressPortlets and xexpressEMSEScripts arms", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<expressPortlets/>");
    expect(original).toContain("<xexpressEMSEScripts/>");
    const exportedXml = buildExportedExpressionBuilderXml(parseExpressionBuilderXml(original));
    expect(exportedXml).toContain("<expressPortlets/>");
    expect(exportedXml).toContain("<xexpressEMSEScripts/>");
  });

  it("has no refId attribute anywhere in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("reads LIC_MGT_A_BUSICONT_PHONE's one calc + four fields + zero criteria, and LIC_ACCR_A_MobileFoodUnits's two calc + two criteria + eight fields", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseExpressionBuilderXml(original);

    const phone = parsed.records.find(
      (r) => toExpressionRow(r).expressionName === "LIC_MGT_A_BUSICONT_PHONE"
    )!;
    const phoneRow = toExpressionRow(phone);
    expect(phoneRow.calcCount).toBe(1);
    expect(phoneRow.fieldCount).toBe(4);
    expect(phoneRow.criteriaCount).toBe(0);
    expect(phoneRow.expressionMode).toBe("Wizard");

    const calc = toExpressCalculationRow(getArmNodes(phone, "calc")[0]);
    expect(calc.fieldPropterty).toBe("required");

    const mobile = parsed.records.find(
      (r) => toExpressionRow(r).expressionName === "LIC_ACCR_A_MobileFoodUnits"
    )!;
    const mobileRow = toExpressionRow(mobile);
    expect(mobileRow.calcCount).toBe(2);
    expect(mobileRow.criteriaCount).toBe(2);
    expect(mobileRow.fieldCount).toBe(8);
    expect(mobileRow.executeOrder).toBe("10");
    expect(mobileRow.expressionBehavior).toBe("INSERT_ROW");

    const criteria = toExpressCriteriaRow(getArmNodes(mobile, "criteria")[0]);
    expect(criteria.criteriaType).toBe("IFCONDITION");
    expect(criteria.fieldOperator).toBe("==");

    const field = toExpressFieldRow(getArmNodes(mobile, "field")[0]);
    expect(field.usage).toBe("EXECUTE_FIELD");
  });
});
