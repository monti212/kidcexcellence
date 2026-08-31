import { NextResponse } from "next/server";
import {
  decideVerification,
  effectiveVerificationPayment,
  getSessionFromRequest,
  platformAnalyticsSummary,
  readStore,
} from "@/lib/platform-store";
import { accountProvidersFromStore, getCategoryLabel } from "@/lib/platform-service";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";
import {
  missingVerificationDocuments,
  missingVerificationProfileFields,
} from "@/lib/verification-requirements";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const auth = await getSessionFromRequest(request);
  return auth?.session.role === "admin" ? auth : null;
}

function publicUpload(upload: Awaited<ReturnType<typeof readStore>>["uploads"][number]) {
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

function providerUploads(store: Awaited<ReturnType<typeof readStore>>, userId: string) {
  return store.uploads.filter((upload) => upload.userId === userId);
}

function dashboardPayload(
  store: Awaited<ReturnType<typeof readStore>>,
  admin: { name: string; email: string }
) {
  const registeredProviders = store.users
    .filter((user) => user.role === "provider")
    .map((user) => {
      const profile = store.providerProfiles[user.id];
      const uploads = providerUploads(store, user.id);
      const documents = uploads.filter((upload) => upload.type === "document");
      const profileImages = uploads.filter((upload) => upload.type === "profile-image");
      const coverImages = uploads.filter((upload) => upload.type === "cover-image");
      const galleryImages = uploads.filter((upload) => upload.type === "gallery");
      const pending = store.verifications.pendingProviders.find(
        (item) => item.userId === user.id
      );
      const approved = store.verifications.approvedProviders.find(
        (item) => item.userId === user.id
      );
      const category = profile?.category ?? user.category ?? "";
      const verificationPayment = effectiveVerificationPayment(profile, user);

      return {
        userId: user.id,
        name: profile?.displayName || user.name,
        email: user.email,
        category: category ? getCategoryLabel(category) : "Provider",
        rawCategory: category,
        location: profile?.location || user.location || "Botswana",
        published: profile?.published ?? false,
        createdAt: user.createdAt,
        savedAt: profile?.savedAt,
        verificationStatus:
          approved ? "approved" : pending ? "pending" : profile?.verificationStatus ?? "not_submitted",
        verificationPayment,
        pendingId: pending?.id,
        approvedDate: approved?.date,
        documentCount: documents.length,
        imageCount: profileImages.length + coverImages.length + galleryImages.length,
        uploads: uploads.map(publicUpload),
        missingDocuments: profile
          ? missingVerificationDocuments(
              category,
              documents.map((document) => document.documentKey ?? "")
            ).map((document) => document.label)
          : [],
        missingProfileFields: profile
          ? missingVerificationProfileFields(profile, {
              profileImageUploaded: profileImages.length > 0,
              coverImageUploaded: coverImages.length > 0,
              galleryCount: galleryImages.length,
            })
          : ["Saved provider profile"],
      };
    })
    .sort((a, b) => {
      const aTime = new Date(a.savedAt ?? a.createdAt).getTime();
      const bTime = new Date(b.savedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

  return {
    ...store.verifications,
    pendingProviders: store.verifications.pendingProviders.map((pending) => ({
      ...pending,
      verificationPayment: pending.userId
        ? effectiveVerificationPayment(
            store.providerProfiles[pending.userId],
            store.users.find((user) => user.id === pending.userId) ?? {
              id: pending.userId,
              createdAt: pending.submittedDate,
            }
          )
        : null,
      uploads: pending.userId
        ? providerUploads(store, pending.userId)
            .filter((upload) => upload.type === "document")
            .map(publicUpload)
        : [],
    })),
    registeredProviders,
    stats: {
      totalProviders: accountProvidersFromStore(store).length,
      totalParents: store.users.filter((user) => user.role === "parent").length,
      registeredProviders: store.users.filter((user) => user.role === "provider").length,
    },
    platformAnalytics: platformAnalyticsSummary(store),
    admin,
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  }

  const rateLimit = consumeRateLimit({
    key: `admin-verifications:${auth.session.userId}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many admin requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const store = await readStore();
  return NextResponse.json(dashboardPayload(store, auth.user));
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  }

  const rateLimit = consumeRateLimit({
    key: `admin-verification-mutation:${auth.session.userId}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many admin actions. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => null);
  const action = body?.action === "reject" ? "reject" : "approve";

  if (!body?.id) {
    return NextResponse.json({ error: "Verification id is required" }, { status: 400 });
  }

  await decideVerification(String(body.id), action);
  const store = await readStore();
  return NextResponse.json(dashboardPayload(store, auth.user));
}
