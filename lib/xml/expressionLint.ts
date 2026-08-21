/**
 * Static checks over one Expression Builder record's "code" — the
 * calculation expressions (calculateExp), the free-text scriptText, and
 * the criteria conditions — run entirely client-side against the
 * already-parsed rows (see expressionBuilder.ts). This is a heuristic
 * linter, not a real parser for Accela's expression grammar (which
 * isn't publicly documented), so it only flags patterns that are
 * unambiguous regardless of the exact grammar: unbalanced
 * parens/brackets/quotes, a trailing operator, and exact duplicate
 * calculations.
 *
 * The Fields arm is deliberately not checked at all (no unused-variable
 * detection) and whitespace/trimming is never offered as a fix — both
 * were dropped on explicit user request as more noise than signal.
 */
import type { ExpressCalculationRow, ExpressCriteriaRow, ExpressionRow } from "./expressionBuilder";

export type LintCategory = "syntax-error" | "simplify";

export interface LintFix {
  arm: "expr" | "calc" | "criteria";
  uid: string;
  field: string;
  newValue: string;
}

export interface LintFinding {
  id: string;
  category: LintCategory;
  location: string;
  message: string;
  before?: string;
  after?: string;
  fix?: LintFix;
  /** Lets the caller offer a "delete this row" action for the given arm. */
  deletable?: { arm: "calc" | "criteria"; uid: string };
}

function countChar(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

const TRAILING_OPERATOR_RE = /(?:&&|\|\||==|!=|<=|>=|[+\-*/<>=])\s*$/;

function checkBalanceAndTrailing(
  text: string,
  location: string,
  idPrefix: string,
  fix: (newValue: string) => LintFix
): LintFinding[] {
  const findings: LintFinding[] = [];
  const trimmed = text.trim();
  if (!trimmed) return findings;

  const opens = countChar(trimmed, "(");
  const closes = countChar(trimmed, ")");
  if (opens !== closes) {
    if (opens > closes) {
      const after = trimmed + ")".repeat(opens - closes);
      findings.push({
        id: `${idPrefix}-parens`,
        category: "syntax-error",
        location,
        message: `${opens} "(" but only ${closes} ")" — missing ${opens - closes} closing parenthesis.`,
        before: trimmed,
        after,
        fix: fix(after),
      });
    } else {
      findings.push({
        id: `${idPrefix}-parens`,
        category: "syntax-error",
        location,
        message: `${closes} ")" but only ${opens} "(" — an extra closing parenthesis somewhere. Fix location is ambiguous, so this needs a manual look.`,
      });
    }
  }

  const sqOpen = countChar(trimmed, "[");
  const sqClose = countChar(trimmed, "]");
  if (sqOpen !== sqClose) {
    if (sqOpen > sqClose) {
      const after = trimmed + "]".repeat(sqOpen - sqClose);
      findings.push({
        id: `${idPrefix}-brackets`,
        category: "syntax-error",
        location,
        message: `${sqOpen} "[" but only ${sqClose} "]" — missing ${sqOpen - sqClose} closing bracket.`,
        before: trimmed,
        after,
        fix: fix(after),
      });
    } else {
      findings.push({
        id: `${idPrefix}-brackets`,
        category: "syntax-error",
        location,
        message: `${sqClose} "]" but only ${sqOpen} "[" — an extra closing bracket somewhere. Fix location is ambiguous, so this needs a manual look.`,
      });
    }
  }

  if (countChar(trimmed, '"') % 2 !== 0) {
    findings.push({
      id: `${idPrefix}-dquote`,
      category: "syntax-error",
      location,
      message: `An odd number of " characters — a quoted string is unterminated. Fix location is ambiguous, so this needs a manual look.`,
    });
  }
  if (countChar(trimmed, "'") % 2 !== 0) {
    findings.push({
      id: `${idPrefix}-squote`,
      category: "syntax-error",
      location,
      message: `An odd number of ' characters — a quoted string is unterminated. Fix location is ambiguous, so this needs a manual look.`,
    });
  }

  if (TRAILING_OPERATOR_RE.test(trimmed)) {
    findings.push({
      id: `${idPrefix}-trailing-op`,
      category: "syntax-error",
      location,
      message: `Expression ends with an operator — looks incomplete.`,
    });
  }

  return findings;
}

export function lintExpression(
  exprRow: ExpressionRow,
  calcRows: ExpressCalculationRow[],
  criteriaRows: ExpressCriteriaRow[]
): LintFinding[] {
  const findings: LintFinding[] = [];

  // --- syntax over every code-bearing field ------------------------------
  if (exprRow.scriptText.trim()) {
    findings.push(
      ...checkBalanceAndTrailing(exprRow.scriptText, "Script Text", `expr-script`, (v) => ({
        arm: "expr",
        uid: exprRow.uid,
        field: "scriptText",
        newValue: v,
      }))
    );
  }

  for (const c of calcRows) {
    const loc = `Calculation → ${c.fieldName || "(unnamed field)"}`;
    if (c.calculateExp.trim()) {
      findings.push(
        ...checkBalanceAndTrailing(c.calculateExp, loc, `calc-${c.uid}`, (v) => ({
          arm: "calc",
          uid: c.uid,
          field: "calculateExp",
          newValue: v,
        }))
      );
    } else if (c.fieldName.trim()) {
      findings.push({
        id: `calc-${c.uid}-empty`,
        category: "syntax-error",
        location: loc,
        message: "No calculation expression defined for this target field.",
      });
    }
  }

  for (const c of criteriaRows) {
    const loc = `Criteria → ${c.fieldName || "(unnamed field)"}`;
    if (c.criteriaValue.trim()) {
      findings.push(
        ...checkBalanceAndTrailing(c.criteriaValue, loc, `crit-${c.uid}`, (v) => ({
          arm: "criteria",
          uid: c.uid,
          field: "criteriaValue",
          newValue: v,
        }))
      );
    }
  }

  // --- duplicate calculations targeting the same field -----------------
  const byField = new Map<string, ExpressCalculationRow[]>();
  for (const c of calcRows) {
    const key = c.fieldName.trim();
    if (!key) continue;
    const list = byField.get(key) ?? [];
    list.push(c);
    byField.set(key, list);
  }
  for (const [field, rows] of byField) {
    const seen = new Map<string, ExpressCalculationRow>();
    for (const c of rows) {
      const exp = c.calculateExp.trim();
      if (!exp) continue;
      const dupOf = seen.get(exp);
      if (dupOf) {
        findings.push({
          id: `calc-${c.uid}-dup`,
          category: "simplify",
          location: `Calculation → ${field}`,
          message: `Identical to another calculation already writing "${field}" — likely a redundant duplicate.`,
          deletable: { arm: "calc", uid: c.uid },
        });
      } else {
        seen.set(exp, c);
      }
    }
  }

  return findings;
}
