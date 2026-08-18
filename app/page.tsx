"use client";

import { useCallback, useState } from "react";
import StandardChoiceGrid from "@/components/StandardChoiceGrid";
import type { ParseZipResult, StandardChoiceZipEntry } from "@/lib/types";

export default function Home() {
  const [zipResult, setZipResult] = useState<ParseZipResult | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoading(true);
      setError(null);
      setZipResult(null);
      setActivePath(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/parse", { method: "POST", body: formData });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
        const result = body as ParseZipResult;
        setZipResult(result);
        const firstStandardChoice = result.entries.find(
          (en) => en.kind === "standardChoice"
        );
        setActivePath(firstStandardChoice?.path ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setLoading(false);
        e.target.value = "";
      }
    },
    []
  );

  const handleExport = useCallback(async () => {
    if (!zipResult) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipName: zipResult.zipName, entries: zipResult.entries }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipResult.zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [zipResult]);

  const standardChoiceEntries = (zipResult?.entries.filter(
    (en) => en.kind === "standardChoice"
  ) ?? []) as StandardChoiceZipEntry[];
  const passthroughCount =
    (zipResult?.entries.filter((en) => en.kind === "passthrough").length ?? 0);
  const activeEntry = standardChoiceEntries.find((en) => en.path === activePath) ?? null;

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 80px" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>ImportEase</h1>
        <p style={{ color: "#555", margin: 0 }}>
          Upload an Accela Configuration Manager export .zip, edit Standard Choices, export a
          .zip Accela will accept back.
        </p>
      </header>

      <section
        style={{
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <input type="file" accept=".zip" onChange={handleFileChange} disabled={loading} />
        {loading && <span>Parsing…</span>}
        {zipResult && (
          <>
            <span style={{ color: "#333" }}>
              <strong>{zipResult.zipName}</strong> — {standardChoiceEntries.length} Standard
              Choice file(s), {passthroughCount} passed through untouched
            </span>
            <button onClick={handleExport} disabled={exporting} style={{ marginLeft: "auto" }}>
              {exporting ? "Building zip…" : "Export .zip"}
            </button>
          </>
        )}
      </section>

      {error && (
        <div
          style={{
            background: "#fdecea",
            color: "#611a15",
            border: "1px solid #f5c2c0",
            borderRadius: 6,
            padding: "10px 14px",
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      {standardChoiceEntries.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {standardChoiceEntries.map((en) => (
            <button
              key={en.path}
              onClick={() => setActivePath(en.path)}
              style={{
                fontWeight: en.path === activePath ? 700 : 400,
                textDecoration: en.path === activePath ? "underline" : "none",
              }}
            >
              {en.path}
            </button>
          ))}
        </div>
      )}

      {activeEntry && (
        <StandardChoiceGrid
          key={activeEntry.path}
          records={activeEntry.records}
          onChange={() => {}}
        />
      )}

      {zipResult && standardChoiceEntries.length === 0 && (
        <p style={{ color: "#555" }}>
          No Standard Choices file was recognized in this zip. Everything else will still be
          passed through untouched on export.
        </p>
      )}
    </main>
  );
}
