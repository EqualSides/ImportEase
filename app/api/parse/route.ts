import { NextResponse } from "next/server";
import { parseUploadedZip } from "@/lib/zip/zip";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "Expected a .zip file" }, { status: 400 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const result = await parseUploadedZip(buffer, file.name);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse zip" },
      { status: 400 }
    );
  }
}
