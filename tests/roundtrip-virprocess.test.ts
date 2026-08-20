import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedVirProcessXml,
  getArmNodes,
  parseVirProcessXml,
  toVirProcessRow,
  toProcessTaskRow,
  toProcessEmailSettingRow,
  toActivityStatusRow,
} from "../lib/xml/virProcess";

/**
 * VirProcessModel round-trip fidelity, against a real 2-record excerpt
 * (fixtures/vir-process/vp-real.xml — "PW_DRN_CMPLNT" (one task, one
 * status), "BD_IAPERMIT" (one task, three email settings, six statuses) —
 * together covering all three editable arms, taken from the same
 * 180-record agency export) — same structural-diff approach as
 * tests/roundtrip.test.ts. This is the third "heterogeneous-arm" category
 * (see tests/roundtrip-reffeeschedule.test.ts for the first). A fourth
 * arm, processSecurityModels, is genuine security data (confirmed
 * populated, though not in either fixture record) and is intentionally
 * never read or written by this module.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "vir-process");
const file = "vp-real.xml";

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

describe("VirProcessModel round-trip fidelity", () => {
  it("round-trips vp-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseVirProcessXml(original);

    const exportedXml = buildExportedVirProcessXml(parsedOriginal);
    const parsedExported = parseVirProcessXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(2);
  });

  it("re-serializes vp-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseVirProcessXml(buildExportedVirProcessXml(parseVirProcessXml(original)));
    const secondPass = parseVirProcessXml(buildExportedVirProcessXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the always-empty processSecurityModels arm", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<processSecurityModels/>");
    const exportedXml = buildExportedVirProcessXml(parseVirProcessXml(original));
    expect(exportedXml).toContain("<processSecurityModels/>");
  });

  it("has no refId attribute anywhere in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("reads PW_DRN_CMPLNT's one task + one status, and BD_IAPERMIT's one task + three emails + six statuses", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsed = parseVirProcessXml(original);

    const drn = parsed.records.find((r) => toVirProcessRow(r).r1ProcessCode === "PW_DRN_CMPLNT")!;
    const drnRow = toVirProcessRow(drn);
    expect(drnRow.taskCount).toBe(1);
    expect(drnRow.statusCount).toBe(1);
    expect(drnRow.emailCount).toBe(0);

    const task = toProcessTaskRow(getArmNodes(drn, "task")[0]);
    expect(task.sdProDes).toBe("Complaint");
    const status = toActivityStatusRow(getArmNodes(drn, "status")[0]);
    expect(status.r3ActStatDes).toBe("Closed");

    const ia = parsed.records.find((r) => toVirProcessRow(r).r1ProcessCode === "BD_IAPERMIT")!;
    const iaRow = toVirProcessRow(ia);
    expect(iaRow.taskCount).toBe(1);
    expect(iaRow.emailCount).toBe(3);
    expect(iaRow.statusCount).toBe(6);

    const email = toProcessEmailSettingRow(getArmNodes(ia, "email")[0]);
    expect(email.processName).toBe("BD_IAPERMIT");
  });
});
