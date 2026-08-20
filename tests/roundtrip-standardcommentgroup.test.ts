import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedStandardCommentGroupXml,
  getArmNodes,
  parseStandardCommentGroupXml,
  toStandardCommentGroupRow,
  toCommentGroupEntityRow,
} from "../lib/xml/standardCommentGroup";

/**
 * StandardCommentGroupModel round-trip fidelity, against a real 2-record
 * excerpt (fixtures/standard-comment-group/scmg-real.xml — one group
 * exercising checklist/commentType/inspection/record, one exercising
 * commentType/record/workflow, together covering all five arms — taken
 * from the same 12-record agency export) — same structural-diff approach
 * as tests/roundtrip.test.ts. This is the first "star" category (one
 * group, five parallel flat child arms) rather than a deeper nesting
 * level — see the module doc comment in lib/xml/standardCommentGroup.ts.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "standard-comment-group");
const file = "scmg-real.xml";

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

describe("StandardCommentGroupModel round-trip fidelity", () => {
  it("round-trips scmg-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseStandardCommentGroupXml(original);

    const exportedXml = buildExportedStandardCommentGroupXml(parsedOriginal);
    const parsedExported = parseStandardCommentGroupXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes scmg-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseStandardCommentGroupXml(
      buildExportedStandardCommentGroupXml(parseStandardCommentGroupXml(original))
    );
    const secondPass = parseStandardCommentGroupXml(
      buildExportedStandardCommentGroupXml(firstPass)
    );
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the self-closing empty checklistModels/inspectionModels/workflowModels arms", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<checklistModels/>");
    expect(original).toContain("<inspectionModels/>");
    expect(original).toContain("<workflowModels/>");
    const exportedXml = buildExportedStandardCommentGroupXml(parseStandardCommentGroupXml(original));
    expect(exportedXml).toContain("<checklistModels/>");
    expect(exportedXml).toContain("<inspectionModels/>");
    expect(exportedXml).toContain("<workflowModels/>");
  });

  it("every record shares the same parent refId, confirming synthetic-uid identity is required here too", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original.match(/<standardCommentGroup refId="1@StandardCommentGroupModel">/g)?.length).toBe(2);
  });

  it("reads all five arms of the fully-populated group correctly", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseStandardCommentGroupXml(original);
    const group = parsed.records.find((r) => toStandardCommentGroupRow(r).groupName === "BD_Resort Inspections")!;
    const row = toStandardCommentGroupRow(group);
    expect(row.checklistCount).toBe(2);
    expect(row.commentTypeCount).toBe(5);
    expect(row.inspectionCount).toBe(3);
    expect(row.recordCount).toBe(1);
    expect(row.workflowCount).toBe(0);

    const checklistRow = toCommentGroupEntityRow(getArmNodes(group, "checklist")[0]);
    expect(checklistRow.entityType).toBe("GUIDESHEET");
    expect(checklistRow.groupName).toBe("BD_Resort Inspections");

    const other = parsed.records.find((r) => toStandardCommentGroupRow(r).groupName === "PW_DRAINAGE")!;
    const otherRow = toStandardCommentGroupRow(other);
    expect(otherRow.workflowCount).toBe(4);
    const workflowRow = toCommentGroupEntityRow(getArmNodes(other, "workflow")[0]);
    expect(workflowRow.entityType).toBe("WORKFLOW");
    expect(workflowRow.entityData).toBe("PW_DRAINAGEu266B1");
  });
});
