import { describe, expect, it } from "vitest";
import { lintExpression } from "../lib/xml/expressionLint";
import type { ExpressCalculationRow, ExpressCriteriaRow, ExpressionRow } from "../lib/xml/expressionBuilder";

function exprRow(overrides: Partial<ExpressionRow> = {}): ExpressionRow {
  return {
    uid: "e1",
    expressionName: "TEST_EXPR",
    serviceProviderCode: "AGY",
    checkboxCode: "",
    entityKey1: "",
    entityKey2: "",
    entityKey3: "",
    executeIn: "ALL",
    executeOrder: "",
    expressionBehavior: "",
    expressionMode: "Manual",
    expressionVersion: "",
    scriptText: "",
    viewID: "",
    calcCount: 0,
    criteriaCount: 0,
    fieldCount: 0,
    ...overrides,
  };
}

function calcRow(overrides: Partial<ExpressCalculationRow> = {}): ExpressCalculationRow {
  return {
    uid: "c1",
    serviceProviderCode: "AGY",
    expressionName: "TEST_EXPR",
    calSeq: "1",
    calculateExp: "",
    fieldName: "",
    fieldPropterty: "",
    ...overrides,
  };
}

function criteriaRow(overrides: Partial<ExpressCriteriaRow> = {}): ExpressCriteriaRow {
  return {
    uid: "cr1",
    serviceProviderCode: "AGY",
    expressionName: "TEST_EXPR",
    criteriaSeq: "1",
    criteriaType: "IFCONDITION",
    parentId: "0",
    booleanOperator: "&&",
    criteriaValue: "",
    fieldName: "",
    fieldOperator: "==",
    ...overrides,
  };
}

describe("lintExpression", () => {
  it("finds no issues on a clean expression", () => {
    const findings = lintExpression(exprRow(), [calcRow({ fieldName: "TOTAL", calculateExp: "FEE_AMOUNT * 2" })], []);
    expect(findings).toEqual([]);
  });

  it("never flags anything about the Fields arm — it isn't checked at all", () => {
    // lintExpression's signature no longer even accepts field rows; this
    // just documents the intent so a future change doesn't quietly bring
    // field-arm checking back in.
    const findings = lintExpression(exprRow(), [], []);
    expect(findings).toEqual([]);
  });

  it("proposes a fix for a missing closing parenthesis", () => {
    const findings = lintExpression(
      exprRow(),
      [calcRow({ uid: "c1", fieldName: "TOTAL", calculateExp: "(A + B" })],
      []
    );
    const paren = findings.find((f) => f.id === "calc-c1-parens");
    expect(paren).toBeDefined();
    expect(paren!.category).toBe("syntax-error");
    expect(paren!.fix).toEqual({ arm: "calc", uid: "c1", field: "calculateExp", newValue: "(A + B)" });
  });

  it("does not offer an auto-fix for an unmatched extra closing paren", () => {
    const findings = lintExpression(
      exprRow(),
      [calcRow({ uid: "c1", fieldName: "TOTAL", calculateExp: "A + B)" })],
      []
    );
    const paren = findings.find((f) => f.id === "calc-c1-parens");
    expect(paren).toBeDefined();
    expect(paren!.fix).toBeUndefined();
  });

  it("flags a trailing operator", () => {
    const findings = lintExpression(
      exprRow(),
      [calcRow({ uid: "c1", fieldName: "TOTAL", calculateExp: "A + B +" })],
      []
    );
    expect(findings.some((f) => f.id === "calc-c1-trailing-op")).toBe(true);
  });

  it("flags an unterminated quote", () => {
    const findings = lintExpression(
      exprRow(),
      [calcRow({ uid: "c1", fieldName: "TOTAL", calculateExp: "A == 'open" })],
      []
    );
    expect(findings.some((f) => f.id === "calc-c1-squote")).toBe(true);
  });

  it("does not flag extra whitespace — not offered as a fix", () => {
    const findings = lintExpression(
      exprRow(),
      [calcRow({ uid: "c1", fieldName: "TOTAL", calculateExp: "A  +   B" })],
      []
    );
    expect(findings).toEqual([]);
  });

  it("flags a duplicate calculation writing the same target field", () => {
    const findings = lintExpression(
      exprRow(),
      [
        calcRow({ uid: "c1", fieldName: "TOTAL", calculateExp: "A + B" }),
        calcRow({ uid: "c2", fieldName: "TOTAL", calculateExp: "A + B" }),
      ],
      []
    );
    const dup = findings.find((f) => f.id === "calc-c2-dup");
    expect(dup).toBeDefined();
    expect(dup!.category).toBe("simplify");
    expect(dup!.deletable).toEqual({ arm: "calc", uid: "c2" });
  });

  it("does not flag identical expressions writing different target fields", () => {
    const findings = lintExpression(
      exprRow(),
      [
        calcRow({ uid: "c1", fieldName: "TOTAL", calculateExp: "A + B" }),
        calcRow({ uid: "c2", fieldName: "OTHER", calculateExp: "A + B" }),
      ],
      []
    );
    expect(findings.some((f) => f.category === "simplify" && f.id.includes("dup"))).toBe(false);
  });

  it("flags a calculation row with a target field but no expression", () => {
    const findings = lintExpression(exprRow(), [calcRow({ uid: "c1", fieldName: "TOTAL", calculateExp: "" })], []);
    expect(findings.some((f) => f.id === "calc-c1-empty")).toBe(true);
  });

  it("checks criteriaValue for the same syntax issues as calculateExp", () => {
    const findings = lintExpression(
      exprRow(),
      [],
      [criteriaRow({ uid: "cr1", fieldName: "STATUS_CODE", criteriaValue: "(APPROVED" })]
    );
    expect(findings.some((f) => f.id === "crit-cr1-parens")).toBe(true);
  });
});
