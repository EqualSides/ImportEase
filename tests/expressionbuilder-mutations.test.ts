import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedExpressionBuilderXml,
  createExpressCalculationNode,
  createExpressCriteriaNode,
  createExpressFieldNode,
  deleteArmNode,
  findArmNodeByUid,
  getArmNodes,
  parseExpressionBuilderXml,
  setExpressCriteriaField,
  setExpressionField,
  toExpressCalculationRow,
  toExpressCriteriaRow,
  toExpressFieldRow,
  toExpressionRow,
} from "../lib/xml/expressionBuilder";

/**
 * Mutation-behavior coverage for Expression Builder — create/edit/delete
 * per arm, and the expressionName/serviceProviderCode cascade — none of
 * which tests/roundtrip-expressionbuilder.test.ts exercises (it only
 * checks parse → serialize fidelity of data already in the fixture, not
 * the functions the grid's Add/Delete/edit-cell handlers actually call).
 * The criteria arm gets the most attention here since it's the thinnest
 * on real data (see roundtrip-expressionbuilder.test.ts's doc comment:
 * MobileFoodUnits is the only real record with expressCriteria
 * populated at all) — edits below are applied to that one real row
 * rather than a fabricated one, consistent with this project's
 * real-data-over-synthetic-fixtures policy; only a brand-new row (which
 * is inherently synthetic — it's what "+ Add Criteria" in the grid
 * itself produces) uses createExpressCriteriaNode's own defaults.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "expression-builder");
const file = "expr-real.xml";

function loadMobileFoodUnits() {
  const original = readFileSync(join(fixturesDir, file), "utf-8");
  const parsed = parseExpressionBuilderXml(original);
  const node = parsed.records.find(
    (r) => toExpressionRow(r).expressionName === "LIC_ACCR_A_MobileFoodUnits"
  )!;
  return { parsed, node };
}

describe("Expression Builder mutations", () => {
  it("creates a new criteria row with sensible defaults and adds it to the arm", () => {
    const { node } = loadMobileFoodUnits();
    const before = getArmNodes(node, "criteria").length;

    const newNode = createExpressCriteriaNode("LIC_ACCR_A_MobileFoodUnits", "AGY");
    getArmNodes(node, "criteria").push(newNode);

    const rows = getArmNodes(node, "criteria").map(toExpressCriteriaRow);
    expect(rows).toHaveLength(before + 1);
    const created = rows[rows.length - 1];
    expect(created.criteriaType).toBe("IFCONDITION");
    expect(created.booleanOperator).toBe("&&");
    expect(created.fieldOperator).toBe("==");
    expect(created.parentId).toBe("0");
    expect(created.expressionName).toBe("LIC_ACCR_A_MobileFoodUnits");
    expect(created.serviceProviderCode).toBe("AGY");
  });

  it("edits an existing real criteria row's field values", () => {
    const { node } = loadMobileFoodUnits();
    const target = getArmNodes(node, "criteria")[0];
    const originalRow = toExpressCriteriaRow(target);

    setExpressCriteriaField(target, "fieldOperator", "!=");
    setExpressCriteriaField(target, "criteriaValue", "DENIED");

    const updated = toExpressCriteriaRow(target);
    expect(updated.fieldOperator).toBe("!=");
    expect(updated.criteriaValue).toBe("DENIED");
    // Editing one field must not disturb sibling fields on the same row.
    expect(updated.criteriaType).toBe(originalRow.criteriaType);
    expect(updated.fieldName).toBe(originalRow.fieldName);
  });

  it("deletes a criteria row and leaves the others untouched", () => {
    const { node } = loadMobileFoodUnits();
    const arm = getArmNodes(node, "criteria");
    expect(arm.length).toBeGreaterThanOrEqual(2);
    const [first, second] = arm;
    const firstUid = toExpressCriteriaRow(first).uid;

    deleteArmNode(node, "criteria", first);

    const remaining = getArmNodes(node, "criteria").map(toExpressCriteriaRow);
    expect(remaining.find((r) => r.uid === firstUid)).toBeUndefined();
    expect(remaining).toHaveLength(arm.length); // arm is the same array reference, now mutated
    expect(findArmNodeByUid(node, "criteria", toExpressCriteriaRow(second).uid)).toBe(second);
  });

  it("cascades expressionName and serviceProviderCode into every arm, including criteria", () => {
    const { node } = loadMobileFoodUnits();

    setExpressionField(node, "expressionName", "RENAMED_EXPR");
    setExpressionField(node, "serviceProviderCode", "NEWAGY");

    expect(toExpressionRow(node).expressionName).toBe("RENAMED_EXPR");
    for (const c of getArmNodes(node, "calc").map(toExpressCalculationRow)) {
      expect(c.expressionName).toBe("RENAMED_EXPR");
      expect(c.serviceProviderCode).toBe("NEWAGY");
    }
    for (const c of getArmNodes(node, "criteria").map(toExpressCriteriaRow)) {
      expect(c.expressionName).toBe("RENAMED_EXPR");
      expect(c.serviceProviderCode).toBe("NEWAGY");
    }
    for (const f of getArmNodes(node, "field").map(toExpressFieldRow)) {
      expect(f.expressionName).toBe("RENAMED_EXPR");
      expect(f.serviceProviderCode).toBe("NEWAGY");
    }
  });

  it("does not cascade unrelated field edits (e.g. checkboxCode) into any arm", () => {
    const { node } = loadMobileFoodUnits();
    const beforeCriteria = toExpressCriteriaRow(getArmNodes(node, "criteria")[0]);

    setExpressionField(node, "checkboxCode", "SOME_CODE");

    const afterCriteria = toExpressCriteriaRow(getArmNodes(node, "criteria")[0]);
    expect(afterCriteria.expressionName).toBe(beforeCriteria.expressionName);
    expect(afterCriteria.serviceProviderCode).toBe(beforeCriteria.serviceProviderCode);
  });

  it("round-trips a criteria row created and edited in the same session", () => {
    const { parsed, node } = loadMobileFoodUnits();

    const newNode = createExpressCriteriaNode("LIC_ACCR_A_MobileFoodUnits", "AGY");
    setExpressCriteriaField(newNode, "criteriaValue", "PENDING");
    getArmNodes(node, "criteria").push(newNode);

    const xml = buildExportedExpressionBuilderXml(parsed);
    const reparsed = parseExpressionBuilderXml(xml);
    const reparsedNode = reparsed.records.find(
      (r) => toExpressionRow(r).expressionName === "LIC_ACCR_A_MobileFoodUnits"
    )!;
    const criteriaValues = getArmNodes(reparsedNode, "criteria")
      .map(toExpressCriteriaRow)
      .map((r) => r.criteriaValue);
    expect(criteriaValues).toContain("PENDING");
  });

  it("creates calc and field rows with sensible defaults (arm parity check)", () => {
    const { node } = loadMobileFoodUnits();

    const calc = createExpressCalculationNode("LIC_ACCR_A_MobileFoodUnits", "AGY");
    expect(toExpressCalculationRow(calc).expressionName).toBe("LIC_ACCR_A_MobileFoodUnits");

    const field = createExpressFieldNode("LIC_ACCR_A_MobileFoodUnits", "AGY");
    const fieldRow = toExpressFieldRow(field);
    expect(fieldRow.usage).toBe("VARIABLE");
    expect(fieldRow.isRequired).toBe("N");
    // Sanity check the arm this test is really about wasn't touched.
    expect(getArmNodes(node, "criteria").length).toBeGreaterThan(0);
  });
});
