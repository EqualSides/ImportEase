import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedEmailMessageXml,
  parseEmailMessageXml,
  toEmailMessageRow,
} from "../lib/xml/emailMessage";

/**
 * EmailMessageModel round-trip fidelity, against a real 3-record excerpt
 * (fixtures/email-message/em-real.xml, taken from the same 75-record
 * agency export) — same structural-diff approach as tests/roundtrip.test.ts.
 * One record's contentsBody carries `&#xD;` CRLF entities, which is the
 * specific thing this suite exists to prove survives untouched — a naive
 * text handler could easily normalize or mangle those on the way through.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "email-message");
const file = "em-real.xml";

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

describe("EmailMessageModel round-trip fidelity", () => {
  it("round-trips em-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseEmailMessageXml(original);

    const exportedXml = buildExportedEmailMessageXml(parsedOriginal);
    const parsedExported = parseEmailMessageXml(exportedXml);

    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(3);
  });

  it("re-serializes em-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseEmailMessageXml(
      buildExportedEmailMessageXml(parseEmailMessageXml(original))
    );
    const secondPass = parseEmailMessageXml(buildExportedEmailMessageXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("has no refId attribute in the real sample", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).not.toContain("refId=");
  });

  it("preserves untouched &#xD; CRLF entities in contentsBody byte-for-byte", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("&#xD;");
    const parsed = parseEmailMessageXml(original);
    const exportedXml = buildExportedEmailMessageXml(parsed);
    const originalCount = (original.match(/&#xD;/g) ?? []).length;
    const exportedCount = (exportedXml.match(/&#xD;/g) ?? []).length;
    expect(exportedCount).toBe(originalCount);
    const row = toEmailMessageRow(
      parsed.records.find((r) => toEmailMessageRow(r).contentsCode === "PMT_EXPIRED")!
    );
    expect(row.contentsBody).toContain("Comment:");
  });
});
