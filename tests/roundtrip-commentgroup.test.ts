import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedCommentGroupXml,
  isCommentGroupXml,
  parseCommentGroupXml,
  toCommentGroupRow,
} from "../lib/xml/commentGroup";

/**
 * CommentGroupModel round-trip fidelity, against a real 2-record excerpt
 * (fixtures/comment-group/cg-real.xml, taken from the same 52-record agency
 * export) — same structural-diff approach as tests/roundtrip.test.ts. Also
 * proves the detector correctly distinguishes this category from
 * StandardCommentGroupModel.xml, which reuses the same <standardCommentGroup>
 * top-level tag but has a very different field set (see the module doc
 * comment in lib/xml/commentGroup.ts).
 */

const fixturesDir = join(__dirname, "..", "fixtures", "comment-group");
const file = "cg-real.xml";

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

describe("CommentGroupModel round-trip fidelity", () => {
  it("round-trips cg-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseCommentGroupXml(original);

    const exportedXml = buildExportedCommentGroupXml(parsedOriginal);
    const parsedExported = parseCommentGroupXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes cg-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseCommentGroupXml(
      buildExportedCommentGroupXml(parseCommentGroupXml(original))
    );
    const secondPass = parseCommentGroupXml(buildExportedCommentGroupXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("has no refId attribute on either level in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("sniffs true for this fixture (requires standardCommentModels, not just the shared tag name)", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(isCommentGroupXml(original)).toBe(true);
  });

  it("sniffs false for a <standardCommentGroup> file lacking standardCommentModels (the StandardCommentGroupModel shape)", () => {
    const fakeStandardCommentGroupFile =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<list version="9.0.0" minorVersion="26" exportUser="X" exportDateTime="01/01/2026 12:00 AM" description="null">' +
      "<standardCommentGroup><groupName>X</groupName><checklistModels/></standardCommentGroup></list>";
    expect(isCommentGroupXml(fakeStandardCommentGroupFile)).toBe(false);
  });

  it("reads commentType/commentName/comments per child comment", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseCommentGroupXml(original);
    const row = toCommentGroupRow(parsed.records[0]);
    expect(row.commentType).toBe("FINISHED FLOOR");
    expect(row.commentCount).toBe(1);
  });
});
