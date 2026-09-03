import { NextResponse } from "next/server";
import {
  getSessionFromRequest,
  readStore,
  submitProviderVerification,
} from "@/lib/platform-store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";
import {
  getVerificationDocuments,
  getVerificationFee,
  getVerificationProviderType,
  missingVerificationDocuments,
  missingVerificationProfileFields,
} from "@/lib/verification-requirements";
import { getVettingPackagesForCategory } from "@/lib/vetting-packages";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getSessionFromRequest(request);
  if (!auth || auth.user.role !== "provider") {
    return NextResponse.json({ error: "Provider authentication required" }, { status: 401 });
  }

  const store = await readStore();
  const profile = store.providerProfiles[auth.session.userId];
  const pending = store.verifications.pendingProviders.find(
    (item) => item.userId === auth.session.userId
  );
  const approved = store.verifications.approvedProviders.find(
    (item) => item.userId === auth.session.userId
  );
  const uploadedDocumentKeys = store.uploads
    .filter((upload) => upload.userId === auth.session.userId && upload.type === "document")
    .map((upload) => upload.documentKey ?? "");
  const profileImageUploaded = store.uploads.some(
    (upload) => upload.userId === auth.session.userId && upload.type === "profile-image"
  );
  const coverImageUploaded = store.uploads.some(
    (upload) => upload.userId === auth.session.userId && upload.type === "cover-image"
  );
  const galleryCount = store.uploads.filter(
    (upload) => upload.userId === auth.session.userId && upload.type === "gallery"
  ).length;
  const category = profile?.category ?? auth.user.category ?? "schools";

  return NextResponse.json({
    status: profile?.verificationStatus ?? "not_submitted",
    providerType: getVerificationProviderType(category),
    fee: getVerificationFee(category),
    payment: {
      status: profile?.verificationPaymentStatus ?? "unpaid",
      amount: profile?.verificationFeeAmount,
      currency: profile?.verificationFeeCurrency,
      paidAt: profile?.verificationFeePaidAt,
      reference: profile?.verificationPaymentReference,
      packageId: profile?.verificationPackageId,
      packageName: profile?.verificationPackageName,
    },
    packages: getVettingPackagesForCategory(category),
    requiredDocuments: getVerificationDocuments(category),
    missingDocuments: missingVerificationDocuments(category, uploadedDocumentKeys),
    missingProfileFields: profile
      ? missingVerificationProfileFields(profile, { profileImageUploaded, coverImageUploaded, galleryCount })
      : ["Saved provider profile"],
    pending: pending ?? null,
    approved: approved ?? null,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  if (!auth || auth.user.role !== "provider") {
    return NextResponse.json({ error: "Provider authentication required" }, { status: 401 });
  }

  const rateLimit = consumeRateLimit({
    key: `provider-verification:${auth.session.userId}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many verification submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  try {
    const submission = await submitProviderVerification(auth.session.userId);
    return NextResponse.json({ submission, status: "pending" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not submit verification." },
      { status: 400 }
    );
  }
}
