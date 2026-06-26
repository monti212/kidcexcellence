import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  getSessionFromRequest,
  listUploads,
  recordUpload,
  uploadRootPath,
  type PlatformUploadRecord,
} from "@/lib/platform-store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_GALLERY_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const GALLERY_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 96);
}

function uploadResponse(upload: PlatformUploadRecord) {
  return {
    id: upload.id,
    type: upload.type,
    documentKey: upload.documentKey,
    label: upload.label,
    fileName: upload.fileName,
    contentType: upload.contentType,
    size: upload.size,
    createdAt: upload.createdAt,
    url: `/api/uploads/${upload.id}`,
  };
}

async function requireProvider(request: Request) {
  const auth = await getSessionFromRequest(request);
  if (!auth) return { error: "Authentication required", status: 401 as const };
  if (auth.session.role !== "provider") {
    return { error: "Provider account required", status: 403 as const };
  }
  return { auth };
}

export async function GET(request: Request) {
  const gate = await requireProvider(request);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") === "gallery" ? "gallery" : searchParams.get("type") === "document" ? "document" : undefined;
  const uploads = await listUploads(gate.auth.session.userId, type);
  return NextResponse.json({ uploads: uploads.map(uploadResponse) });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const gate = await requireProvider(request);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const rateLimit = consumeRateLimit({
    key: `uploads:${gate.auth.session.userId}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const type = formData?.get("type") === "gallery" ? "gallery" : "document";
  const documentKey =
    typeof formData?.get("documentKey") === "string"
      ? String(formData.get("documentKey"))
      : undefined;
  const label =
    typeof formData?.get("label") === "string" && String(formData.get("label")).trim()
      ? String(formData.get("label")).trim()
      : type === "gallery"
        ? "Gallery photo"
        : "Provider document";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const allowedTypes = type === "gallery" ? GALLERY_TYPES : DOCUMENT_TYPES;
  const maxBytes = type === "gallery" ? MAX_GALLERY_BYTES : MAX_DOCUMENT_BYTES;
  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "File is too large." }, { status: 400 });
  }

  const id = `upload-${randomUUID()}`;
  const fileName = safeFileName(file.name || `${id}.bin`);
  const userUploadDir = path.join(uploadRootPath, gate.auth.session.userId);
  const filePath = path.join(userUploadDir, `${id}-${fileName}`);

  await mkdir(userUploadDir, { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  const upload = await recordUpload({
    id,
    userId: gate.auth.session.userId,
    type,
    documentKey,
    label,
    fileName,
    contentType: file.type,
    size: file.size,
    path: filePath,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ upload: uploadResponse(upload) });
}
