import { NextResponse } from "next/server";
import { buildExportZip } from "@/lib/zip/zip";
import type { ZipEntryData } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const zipName: string = (body?.zipName as string) || "export.zip";
  const entries: ZipEntryData[] | undefined = body?.entries;

  if (!Array.isArray(entries)) {
    return NextResponse.json({ error: "Missing entries" }, { status: 400 });
  }

  try {
    const bytes = await buildExportZip(entries);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName.replace(/"/g, "")}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build zip" },
      { status: 400 }
    );
  }
}
