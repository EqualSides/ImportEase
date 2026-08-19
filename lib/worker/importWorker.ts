/// <reference lib="webworker" />

/**
 * Runs the zip/XML parse and serialize work off the main thread. Real
 * agency exports can run 40MB+ (see architecture-and-safety-update.md —
 * a 47.8MB ASIGroupModel.xml was seen in one real sample); doing that work
 * on the main thread would freeze the UI for the duration.
 *
 * Relative imports only (no "@/..." alias) — this file is bundled as a
 * separate worker chunk, and keeping it self-contained avoids any risk of
 * alias resolution differing between the main and worker bundles.
 */
import { parseUploadedZip, buildExportZip } from "../zip/zip";
import type { ParseZipResult, ZipEntryData } from "../types";

export type WorkerRequest =
  | { type: "parse"; requestId: number; buffer: ArrayBuffer; zipName: string }
  | { type: "export"; requestId: number; entries: ZipEntryData[]; zipName: string };

export type WorkerResponse =
  | { type: "parsed"; requestId: number; result: ParseZipResult }
  | { type: "exported"; requestId: number; bytes: Uint8Array; zipName: string }
  | { type: "error"; requestId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === "parse") {
      const result = await parseUploadedZip(msg.buffer, msg.zipName);
      // TS's DOM lib types a Uint8Array's .buffer as the broader
      // ArrayBufferLike (which could in principle be a SharedArrayBuffer),
      // which the transfer list's Transferable[] doesn't accept — these
      // are always plain ArrayBuffers in practice (from JSZip).
      const transfer = result.entries
        .filter((en): en is Extract<ZipEntryData, { kind: "passthrough" }> => en.kind === "passthrough")
        .map((en) => en.bytes.buffer) as Transferable[];
      const response: WorkerResponse = { type: "parsed", requestId: msg.requestId, result };
      ctx.postMessage(response, transfer);
    } else if (msg.type === "export") {
      const bytes = await buildExportZip(msg.entries);
      const response: WorkerResponse = {
        type: "exported",
        requestId: msg.requestId,
        bytes,
        zipName: msg.zipName,
      };
      ctx.postMessage(response, [bytes.buffer] as Transferable[]);
    }
  } catch (err) {
    const response: WorkerResponse = {
      type: "error",
      requestId: msg.requestId,
      message: err instanceof Error ? err.message : "Worker error",
    };
    ctx.postMessage(response);
  }
};
