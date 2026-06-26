import { readFile, rm } from "node:fs/promises";
import { NextResponse } from "next/server";
import {
  getSessionFromRequest,
  getUploadForUser,
  removeUpload,
} from "@/lib/platform-store";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

async function requireUpload(request: Request, id: string) {
  const auth = await getSessionFromRequest(request);
  if (!auth) return { error: "Authentication required", status: 401 as const };
  const upload = await getUploadForUser(id, auth.session.userId);
  if (!upload) return { error: "Upload not found", status: 404 as const };
  return { upload };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const gate = await requireUpload(request, id);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const file = await readFile(gate.upload.path).catch(() => null);
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new Response(file, {
    headers: {
      "Content-Type": gate.upload.contentType,
      "Content-Disposition": `inline; filename="${gate.upload.fileName.replaceAll('"', "")}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await context.params;
  const upload = await removeUpload(id, auth.session.userId);
  if (!upload) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  await rm(upload.path, { force: true });
  return NextResponse.json({ ok: true });
}
