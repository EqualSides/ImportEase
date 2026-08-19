import type { ListAttrs, PNode } from "./xml/standardChoice";

export interface StandardChoiceZipEntry {
  path: string;
  kind: "standardChoice";
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

export type ZipEntryData = StandardChoiceZipEntry | PassthroughZipEntry;

export interface ParseZipResult {
  zipName: string;
  entries: ZipEntryData[];
}
