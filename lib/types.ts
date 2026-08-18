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
  base64: string;
}

export type ZipEntryData = StandardChoiceZipEntry | PassthroughZipEntry;

export interface ParseZipResult {
  zipName: string;
  entries: ZipEntryData[];
}
