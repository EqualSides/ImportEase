import type { ListAttrs, PNode } from "./xml/pnode";

export interface StandardChoiceZipEntry {
  path: string;
  kind: "standardChoice";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface SharedDropDownZipEntry {
  path: string;
  kind: "sharedDropDown";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface OrganizationAgencyZipEntry {
  path: string;
  kind: "organizationAgency";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface InspRelateInspZipEntry {
  path: string;
  kind: "inspRelateInsp";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface RefAddressTypeGroupZipEntry {
  path: string;
  kind: "refAddressTypeGroup";
  listAttrs: ListAttrs;
  records: PNode[];
}

export interface PassthroughZipEntry {
  path: string;
  kind: "passthrough";
  // Raw bytes, not base64: everything now stays client-side (see
  // lib/worker/), so there's no JSON-over-HTTP boundary that needs a
  // text-safe encoding — and base64 would add ~33% overhead on the large
  // files (40MB+) this app needs to handle.
  bytes: Uint8Array;
}

export type ZipEntryData =
  | StandardChoiceZipEntry
  | SharedDropDownZipEntry
  | OrganizationAgencyZipEntry
  | InspRelateInspZipEntry
  | RefAddressTypeGroupZipEntry
  | PassthroughZipEntry;

export interface ParseZipResult {
  zipName: string;
  entries: ZipEntryData[];
}
