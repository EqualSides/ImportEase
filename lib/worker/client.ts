"use client";

import type { ParseZipResult, ZipEntryData } from "../types";
import type { WorkerRequest, WorkerResponse } from "./importWorker";

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, { resolve: (msg: WorkerResponse) => void; reject: (err: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  // The `new URL(..., import.meta.url)` form is what lets Next.js's bundler
  // (webpack and Turbopack both) recognize and bundle this as a separate
  // worker chunk automatically — no next.config changes needed.
  worker = new Worker(new URL("./importWorker.ts", import.meta.url));
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    const entry = pending.get(msg.requestId);
    if (!entry) return;
    pending.delete(msg.requestId);
    if (msg.type === "error") entry.reject(new Error(msg.message));
    else entry.resolve(msg);
  };
  worker.onerror = (e) => {
    const err = new Error(e.message || "The background worker crashed unexpectedly.");
    for (const entry of pending.values()) entry.reject(err);
    pending.clear();
  };
  return worker;
}

function send(request: WorkerRequest, transfer: Transferable[] = []): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    pending.set(request.requestId, { resolve, reject });
    getWorker().postMessage(request, transfer);
  });
}

export async function parseZipInWorker(file: File): Promise<ParseZipResult> {
  const buffer = await file.arrayBuffer();
  const requestId = nextRequestId++;
  const msg = await send({ type: "parse", requestId, buffer, zipName: file.name }, [buffer]);
  if (msg.type !== "parsed") throw new Error("Unexpected worker response");
  return msg.result;
}

export async function exportZipInWorker(entries: ZipEntryData[], zipName: string): Promise<Uint8Array> {
  const requestId = nextRequestId++;
  // Entry bytes are NOT transferred here (only copied via structured
  // clone): the same entries/records are still live in React state and
  // may be edited or exported again, so transferring them away would
  // silently neuter that data.
  const msg = await send({ type: "export", requestId, entries, zipName });
  if (msg.type !== "exported") throw new Error("Unexpected worker response");
  return msg.bytes;
}
