import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedRefFeeScheduleXml,
  getArmNodes,
  parseRefFeeScheduleXml,
  toRefFeeScheduleRow,
  toRefFeeItemRow,
  toFeeScheduleModuleRow,
} from "../lib/xml/refFeeSchedule";

/**
 * RefFeeScheduleModel round-trip fidelity, against a real 2-record excerpt
 * (fixtures/ref-fee-schedule/rfs-real.xml — "TEST" (one fee item, one
 * module association) and "NO FEES" (zero fee items, five module
 * associations) — taken from the same 159-record agency export) — same
 * structural-diff approach as tests/roundtrip.test.ts. This is the first
 * category with two structurally-different child arms rather than a
 * uniform "star" shape (see the module doc comment in
 * lib/xml/refFeeSchedule.ts) — a third arm, refFeeItemgroups, is
 * confirmed always empty across the whole real export and is left
 * untouched rather than guessed at. Each fee item also embeds two large
 * read-only reference blobs (refPaymentPeriodModel, and a *complete*
 * embedded StandardChoiceModel as unitDescModel) that must round-trip
 * unmodified even though this module never reads or writes them.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "ref-fee-schedule");
const file = "rfs-real.xml";

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

describe("RefFeeScheduleModel round-trip fidelity", () => {
  it("round-trips rfs-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseRefFeeScheduleXml(original);

    const exportedXml = buildExportedRefFeeScheduleXml(parsedOriginal);
    const parsedExported = parseRefFeeScheduleXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes rfs-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseRefFeeScheduleXml(
      buildExportedRefFeeScheduleXml(parseRefFeeScheduleXml(original))
    );
    const secondPass = parseRefFeeScheduleXml(buildExportedRefFeeScheduleXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the untouched embedded unitDescModel/refPaymentPeriodModel reference blobs", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<unitDescModel");
    expect(original).toContain("<refPaymentPeriodModel");
    const exportedXml = buildExportedRefFeeScheduleXml(parseRefFeeScheduleXml(original));
    const originalCount = (original.match(/<standardChoiceValue refId=/g) ?? []).length;
    const exportedCount = (exportedXml.match(/<standardChoiceValue refId=/g) ?? []).length;
    expect(exportedCount).toBe(originalCount);
    expect(exportedCount).toBeGreaterThan(30);
  });

  it("preserves the always-empty refFeeItemgroups arm and self-closing empty refFeeItemModels", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<refFeeItemgroups/>");
    expect(original).toContain("<refFeeItemModels/>");
    const exportedXml = buildExportedRefFeeScheduleXml(parseRefFeeScheduleXml(original));
    expect(exportedXml).toContain("<refFeeItemgroups/>");
    expect(exportedXml).toContain("<refFeeItemModels/>");
  });

  it("reads TEST's one item + one module and NO FEES's zero items + five modules", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseRefFeeScheduleXml(original);

    const test = parsed.records.find((r) => toRefFeeScheduleRow(r).feeScheduleName === "TEST")!;
    const testRow = toRefFeeScheduleRow(test);
    expect(testRow.itemCount).toBe(1);
    expect(testRow.moduleCount).toBe(1);

    const item = toRefFeeItemRow(getArmNodes(test, "item")[0]);
    expect(item.feeCod).toBe("FEECODE");
    const mod = toFeeScheduleModuleRow(getArmNodes(test, "module")[0]);
    expect(mod.feeCode).toBe("TEST");

    const noFees = parsed.records.find((r) => toRefFeeScheduleRow(r).feeScheduleName === "NO FEES")!;
    const noFeesRow = toRefFeeScheduleRow(noFees);
    expect(noFeesRow.itemCount).toBe(0);
    expect(noFeesRow.moduleCount).toBe(5);
  });
});
