import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExportedOrganizationAgencyXml,
  parseOrganizationAgencyXml,
} from "../lib/xml/organizationAgency";

/**
 * OrganizationAgencyModel round-trip fidelity, against the real 12-record
 * export (fixtures/org-agency/oa-real.xml) — same structural-diff approach
 * as tests/roundtrip.test.ts. This sample confirmed the same non-unique-
 * refId situation Standard Choice has: every record reuses
 * `refId="1@OrganizationAgencyModel"`, which is exactly why row identity
 * uses the synthetic uid (getNodeUid in lib/xml/pnode.ts) rather than refId.
 */

const fixturesDir = join(__dirname, "..", "fixtures", "org-agency");
const file = "oa-real.xml";

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

describe("OrganizationAgencyModel round-trip fidelity", () => {
  it("round-trips oa-real.xml structurally unmodified", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const parsedOriginal = parseOrganizationAgencyXml(original);

    const exportedXml = buildExportedOrganizationAgencyXml(parsedOriginal);
    const parsedExported = parseOrganizationAgencyXml(exportedXml);

    expect(parsedExported.listAttrs.version).toBe(parsedOriginal.listAttrs.version);
    expect(parsedExported.listAttrs.exportUser).toBe("IMPORTEASE");
    expect(parsedExported.listAttrs.exportDateTime).toMatch(
      /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} (AM|PM)$/
    );

    expectSameRecords(parsedOriginal.records, parsedExported.records);
    expect(parsedOriginal.records.length).toBe(12);
  });

  it("re-serializes oa-real.xml stably on a second pass", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    const firstPass = parseOrganizationAgencyXml(
      buildExportedOrganizationAgencyXml(parseOrganizationAgencyXml(original))
    );
    const secondPass = parseOrganizationAgencyXml(buildExportedOrganizationAgencyXml(firstPass));
    expectSameRecords(firstPass.records, secondPass.records);
  });

  it("preserves the self-closing empty agencyI18NModels collection", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original).toContain("<agencyI18NModels/>");
    const exportedXml = buildExportedOrganizationAgencyXml(parseOrganizationAgencyXml(original));
    expect(exportedXml).toContain("<agencyI18NModels/>");
    expect(exportedXml).not.toContain("<agencyI18NModels></agencyI18NModels>");
  });

  it("every record shares the same refId, confirming synthetic-uid identity is required here too", () => {
    const original = readFileSync(join(fixturesDir, file), "utf-8");
    expect(original.match(/refId="1@OrganizationAgencyModel"/g)?.length).toBe(12);
  });
});
