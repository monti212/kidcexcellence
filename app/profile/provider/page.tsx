"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  CreditCard,
  Lock,
  Upload,
  ImagePlus,
  LogIn,
  X,
  ToggleLeft,
  ToggleRight,
  UserPlus,
} from "lucide-react";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { PROVIDER_CATEGORY_OPTIONS } from "@/lib/mock-data";
import { usePlatformSession } from "@/lib/use-platform-session";
import {
  VERIFICATION_FEE,
  getVerificationDocuments,
  getVerificationProviderType,
  missingVerificationDocuments,
} from "@/lib/verification-requirements";
import {
  VETTING_PACKAGES,
  categorySupportsVettingPackages,
} from "@/lib/vetting-packages";

interface FeeRow {
  grade: string;
  termly: string;
  annually: string;
}

interface StoredProviderProfile {
  displayName: string;
  category: string;
  location: string;
  bio: string;
  phone: string;
  whatsapp: string;
  services: string[];
  experience: string;
  availability: string;
  price: string;
  priceUnit: "monthly" | "per day" | "per hour" | "termly";
  age?: string;
  stayArrangement?: "stay-in" | "stay-out";
  workStartDate?: string;
  willingToRelocate?: boolean;
  childrenCount?: string;
  workExperienceSummary?: string;
  yearsExperience?: string;
  references?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelationship?: string;
  mission?: string;
  vision?: string;
  values?: string;
  medicalAids?: string;
  liveIn: boolean;
  published: boolean;
  verificationStatus: "not_submitted" | "pending" | "approved" | "rejected";
  verificationPaymentStatus: "unpaid" | "paid";
  verificationFeeAmount?: number;
  verificationFeeCurrency?: string;
  verificationFeePaidAt?: string;
  verificationPaymentReference?: string;
  verificationPackageId?: string;
  verificationPackageName?: string;
  feeRows: FeeRow[];
  savedAt?: string;
}

interface ProviderUpload {
  id: string;
  type: "document" | "gallery" | "profile-image";
  documentKey?: string;
  label: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  url: string;
}

const DEFAULT_PROVIDER_PROFILE: StoredProviderProfile = {
  displayName: "",
  category: "schools",
  location: "",
  bio: "",
  phone: "",
  whatsapp: "",
  services: [],
  experience: "",
  availability: "",
  price: "",
  priceUnit: "termly",
  age: "",
  stayArrangement: "stay-out",
  workStartDate: "",
  willingToRelocate: false,
  childrenCount: "",
  workExperienceSummary: "",
  yearsExperience: "",
  references: "",
  nextOfKinName: "",
  nextOfKinPhone: "",
  nextOfKinRelationship: "",
  mission: "",
  vision: "",
  values: "",
  medicalAids: "",
  liveIn: false,
  published: false,
  verificationStatus: "not_submitted",
  verificationPaymentStatus: "unpaid",
  feeRows: [
    { grade: "Baby Class", termly: "2800", annually: "8400" },
    { grade: "Toddler Class", termly: "3000", annually: "9000" },
    { grade: "Nursery", termly: "3200", annually: "9600" },
  ],
};

export default function ProviderProfilePage() {
  const { user, session, loading } = usePlatformSession();
  const [storedProfile, setStoredProfile] = useLocalStorageState<StoredProviderProfile>(
    "kidcellence.provider.profile",
    DEFAULT_PROVIDER_PROFILE,
    (value): value is StoredProviderProfile =>
      typeof value === "object" &&
      value !== null &&
      "category" in value &&
      "liveIn" in value &&
      "feeRows" in value
  );
  const [displayName, setDisplayName] = useState(storedProfile.displayName ?? "");
  const [category, setCategory] = useState(storedProfile.category);
  const [location, setLocation] = useState(storedProfile.location ?? "");
  const [bio, setBio] = useState(storedProfile.bio ?? "");
  const [phone, setPhone] = useState(storedProfile.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(storedProfile.whatsapp ?? "");
  const [services, setServices] = useState(
    Array.isArray(storedProfile.services) ? storedProfile.services.join(", ") : ""
  );
  const [experience, setExperience] = useState(storedProfile.experience ?? "");
  const [availability, setAvailability] = useState(storedProfile.availability ?? "");
  const [price, setPrice] = useState(storedProfile.price ?? "");
  const [priceUnit, setPriceUnit] = useState<StoredProviderProfile["priceUnit"]>(
    storedProfile.priceUnit ?? "termly"
  );
  const [age, setAge] = useState(storedProfile.age ?? "");
  const [stayArrangement, setStayArrangement] = useState<"stay-in" | "stay-out">(
    storedProfile.stayArrangement ?? "stay-out"
  );
  const [workStartDate, setWorkStartDate] = useState(storedProfile.workStartDate ?? "");
  const [willingToRelocate, setWillingToRelocate] = useState(Boolean(storedProfile.willingToRelocate));
  const [childrenCount, setChildrenCount] = useState(storedProfile.childrenCount ?? "");
  const [workExperienceSummary, setWorkExperienceSummary] = useState(storedProfile.workExperienceSummary ?? "");
  const [yearsExperience, setYearsExperience] = useState(storedProfile.yearsExperience ?? "");
  const [references, setReferences] = useState(storedProfile.references ?? "");
  const [nextOfKinName, setNextOfKinName] = useState(storedProfile.nextOfKinName ?? "");
  const [nextOfKinPhone, setNextOfKinPhone] = useState(storedProfile.nextOfKinPhone ?? "");
  const [nextOfKinRelationship, setNextOfKinRelationship] = useState(storedProfile.nextOfKinRelationship ?? "");
  const [mission, setMission] = useState(storedProfile.mission ?? "");
  const [vision, setVision] = useState(storedProfile.vision ?? "");
  const [values, setValues] = useState(storedProfile.values ?? "");
  const [medicalAids, setMedicalAids] = useState(storedProfile.medicalAids ?? "");
  const [, setLiveIn] = useState(storedProfile.liveIn);
  const [published, setPublished] = useState(Boolean(storedProfile.published));
  const [verificationStatus, setVerificationStatus] = useState(
    storedProfile.verificationStatus ?? "not_submitted"
  );
  const [verificationPaymentStatus, setVerificationPaymentStatus] = useState(
    storedProfile.verificationPaymentStatus ?? "unpaid"
  );
  const [verificationFeePaidAt, setVerificationFeePaidAt] = useState(
    storedProfile.verificationFeePaidAt ?? ""
  );
  const [verificationPaymentReference, setVerificationPaymentReference] = useState(
    storedProfile.verificationPaymentReference ?? ""
  );
  const [verificationPackageId, setVerificationPackageId] = useState(
    storedProfile.verificationPackageId ?? "standard"
  );
  const [verificationPackageName, setVerificationPackageName] = useState(
    storedProfile.verificationPackageName ?? ""
  );
  const [verified, setVerified] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploads, setUploads] = useState<ProviderUpload[]>([]);
  const [feeRows, setFeeRows] = useState<FeeRow[]>(storedProfile.feeRows);

  const isSchool = ["schools", "nurseries"].includes(category);
  const isIndividualCare = ["nannies", "helpers", "babysitters"].includes(category);
  const isPediatric = category === "pediatric-clinics";
  const documentUploads = uploads.filter((upload) => upload.type === "document");
  const galleryUploads = uploads.filter((upload) => upload.type === "gallery");
  const profileImageUpload = uploads.find((upload) => upload.type === "profile-image");
  const verificationProviderType = getVerificationProviderType(category);
  const documents = getVerificationDocuments(category);
  const sensitiveDocuments = documents.filter((document) => document.sensitive);
  const standardDocuments = documents.filter((document) => !document.sensitive);
  const missingDocuments = missingVerificationDocuments(
    category,
    documentUploads.map((upload) => upload.documentKey ?? "")
  );
  const verificationPaid = verificationPaymentStatus === "paid";
  const hasVettingPackages = categorySupportsVettingPackages(category);
  const selectedVettingPackage =
    VETTING_PACKAGES.find((plan) => plan.id === verificationPackageId) ?? VETTING_PACKAGES[0];
  const verificationPrice = hasVettingPackages
    ? selectedVettingPackage.price
    : VERIFICATION_FEE.amount;

  const refreshUploads = useCallback(async () => {
    if (!session) {
      setUploads([]);
      return;
    }

    const response = await fetch("/api/uploads", {
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return;
    const payload = await response.json();
    setUploads(payload.uploads ?? []);
  }, [session]);

  const refreshProviderProfile = useCallback(async () => {
    if (!session) return;

    const response = await fetch("/api/profiles/provider", {
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return;

    const payload = await response.json();
    setVerified(Boolean(payload.verified));
    if (!payload.profile) {
      setDisplayName(user?.name ?? "");
      setCategory(user?.category ?? DEFAULT_PROVIDER_PROFILE.category);
      setLocation(user?.location ?? "");
      setPhone(user?.phone ?? "");
      setWhatsapp(user?.phone ?? "");
      return;
    }

    setDisplayName(payload.profile.displayName ?? user?.name ?? "");
    setCategory(payload.profile.category ?? DEFAULT_PROVIDER_PROFILE.category);
    setLocation(payload.profile.location ?? user?.location ?? "");
    setBio(payload.profile.bio ?? "");
    setPhone(payload.profile.phone ?? user?.phone ?? "");
    setWhatsapp(payload.profile.whatsapp ?? payload.profile.phone ?? user?.phone ?? "");
    setServices(Array.isArray(payload.profile.services) ? payload.profile.services.join(", ") : "");
    setExperience(payload.profile.experience ?? "");
    setAvailability(payload.profile.availability ?? "");
    setPrice(payload.profile.price ?? "");
    setPriceUnit(payload.profile.priceUnit ?? "termly");
    setAge(payload.profile.age ?? "");
    setStayArrangement(payload.profile.stayArrangement ?? "stay-out");
    setWorkStartDate(payload.profile.workStartDate ?? "");
    setWillingToRelocate(Boolean(payload.profile.willingToRelocate));
    setChildrenCount(payload.profile.childrenCount ?? "");
    setWorkExperienceSummary(payload.profile.workExperienceSummary ?? "");
    setYearsExperience(payload.profile.yearsExperience ?? "");
    setReferences(payload.profile.references ?? "");
    setNextOfKinName(payload.profile.nextOfKinName ?? "");
    setNextOfKinPhone(payload.profile.nextOfKinPhone ?? "");
    setNextOfKinRelationship(payload.profile.nextOfKinRelationship ?? "");
    setMission(payload.profile.mission ?? "");
    setVision(payload.profile.vision ?? "");
    setValues(payload.profile.values ?? "");
    setMedicalAids(payload.profile.medicalAids ?? "");
    setLiveIn(Boolean(payload.profile.liveIn));
    setPublished(Boolean(payload.profile.published));
    setVerificationStatus(payload.profile.verificationStatus ?? "not_submitted");
    setVerificationPaymentStatus(payload.profile.verificationPaymentStatus ?? "unpaid");
    setVerificationFeePaidAt(payload.profile.verificationFeePaidAt ?? "");
    setVerificationPaymentReference(payload.profile.verificationPaymentReference ?? "");
    setVerificationPackageId(payload.profile.verificationPackageId ?? "standard");
    setVerificationPackageName(payload.profile.verificationPackageName ?? "");
    setVerified(Boolean(payload.verified));
    setFeeRows(Array.isArray(payload.profile.feeRows) ? payload.profile.feeRows : DEFAULT_PROVIDER_PROFILE.feeRows);
    setStoredProfile({
      displayName: payload.profile.displayName ?? user?.name ?? "",
      category: payload.profile.category ?? DEFAULT_PROVIDER_PROFILE.category,
      location: payload.profile.location ?? user?.location ?? "",
      bio: payload.profile.bio ?? "",
      phone: payload.profile.phone ?? user?.phone ?? "",
      whatsapp: payload.profile.whatsapp ?? payload.profile.phone ?? user?.phone ?? "",
      services: Array.isArray(payload.profile.services) ? payload.profile.services : [],
      experience: payload.profile.experience ?? "",
      availability: payload.profile.availability ?? "",
      price: payload.profile.price ?? "",
      priceUnit: payload.profile.priceUnit ?? "termly",
      age: payload.profile.age ?? "",
      stayArrangement: payload.profile.stayArrangement ?? "stay-out",
      workStartDate: payload.profile.workStartDate ?? "",
      willingToRelocate: Boolean(payload.profile.willingToRelocate),
      childrenCount: payload.profile.childrenCount ?? "",
      workExperienceSummary: payload.profile.workExperienceSummary ?? "",
      yearsExperience: payload.profile.yearsExperience ?? "",
      references: payload.profile.references ?? "",
      nextOfKinName: payload.profile.nextOfKinName ?? "",
      nextOfKinPhone: payload.profile.nextOfKinPhone ?? "",
      nextOfKinRelationship: payload.profile.nextOfKinRelationship ?? "",
      mission: payload.profile.mission ?? "",
      vision: payload.profile.vision ?? "",
      values: payload.profile.values ?? "",
      medicalAids: payload.profile.medicalAids ?? "",
      liveIn: Boolean(payload.profile.liveIn),
      published: Boolean(payload.profile.published),
      verificationStatus: payload.profile.verificationStatus ?? "not_submitted",
      verificationPaymentStatus: payload.profile.verificationPaymentStatus ?? "unpaid",
      verificationFeeAmount: payload.profile.verificationFeeAmount,
      verificationFeeCurrency: payload.profile.verificationFeeCurrency,
      verificationFeePaidAt: payload.profile.verificationFeePaidAt,
      verificationPaymentReference: payload.profile.verificationPaymentReference,
      verificationPackageId: payload.profile.verificationPackageId,
      verificationPackageName: payload.profile.verificationPackageName,
      feeRows: Array.isArray(payload.profile.feeRows) ? payload.profile.feeRows : DEFAULT_PROVIDER_PROFILE.feeRows,
      savedAt: payload.profile.savedAt,
    });
  }, [session, setStoredProfile, user]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      refreshUploads();
    }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshUploads]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      refreshProviderProfile();
    }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshProviderProfile]);

  const saveProviderProfile = async (nextPublished = published) => {
    if (!session) {
      setSaveMessage("Sign in to save your provider profile.");
      return;
    }

    const nextProfile = {
      displayName,
      category,
      location,
      bio,
      phone,
      whatsapp,
      services: services.split(",").map((item) => item.trim()).filter(Boolean),
      experience,
      availability,
      price,
      priceUnit,
      age,
      stayArrangement,
      workStartDate,
      willingToRelocate,
      childrenCount,
      workExperienceSummary,
      yearsExperience,
      references,
      nextOfKinName,
      nextOfKinPhone,
      nextOfKinRelationship,
      mission,
      vision,
      values,
      medicalAids,
      liveIn: stayArrangement === "stay-in",
      published: nextPublished,
      verificationStatus,
      verificationPaymentStatus,
      verificationFeeAmount: verificationPaid ? verificationPrice : undefined,
      verificationFeeCurrency: verificationPaid ? "BWP" : undefined,
      verificationFeePaidAt: verificationFeePaidAt || undefined,
      verificationPaymentReference: verificationPaymentReference || undefined,
      verificationPackageId: hasVettingPackages ? verificationPackageId : undefined,
      verificationPackageName: hasVettingPackages ? verificationPackageName : undefined,
      feeRows,
      savedAt: new Date().toISOString(),
    };
    const response = await fetch("/api/profiles/provider", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.userId, profile: nextProfile }),
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setSaveMessage(payload?.error ?? "Could not save profile.");
      return;
    }

    const payload = await response.json();
    const savedProfile = { ...nextProfile, ...payload.profile };
    setStoredProfile(savedProfile);
    setPublished(Boolean(payload.profile.published));
    setVerificationStatus(payload.profile.verificationStatus ?? "not_submitted");
    setVerificationPaymentStatus(payload.profile.verificationPaymentStatus ?? "unpaid");
    setVerificationFeePaidAt(payload.profile.verificationFeePaidAt ?? "");
    setVerificationPaymentReference(payload.profile.verificationPaymentReference ?? "");
    setVerificationPackageId(payload.profile.verificationPackageId ?? "standard");
    setVerificationPackageName(payload.profile.verificationPackageName ?? "");
    setVerified(Boolean(payload.verified));
    setSaveMessage(payload.profile.published ? "Published!" : "Saved!");
    setTimeout(() => setSaveMessage(""), 3000);
  };

  const updateFeeRow = (idx: number, field: keyof FeeRow, value: string) => {
    setFeeRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const addFeeRow = () => {
    setFeeRows((prev) => [...prev, { grade: "", termly: "", annually: "" }]);
  };

  const removeFeeRow = (idx: number) => {
    setFeeRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadFile = async (
    file: File | undefined,
    type: "document" | "gallery" | "profile-image",
    label: string,
    documentKey?: string
  ) => {
    if (!file) return;
    if (!session) {
      setUploadMessage("Sign in with a provider account to upload files.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("type", type);
    formData.set("label", label);
    if (documentKey) formData.set("documentKey", documentKey);

    const response = await fetch("/api/uploads", {
      method: "POST",
      credentials: "same-origin",
      body: formData,
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setUploadMessage(payload?.error ?? "Could not upload file.");
      return;
    }

    const payload = await response.json();
    setUploads((prev) => [
      payload.upload,
      ...prev.filter(
        (upload) =>
          !(
            payload.upload.type === "document" &&
            upload.documentKey === payload.upload.documentKey
          ) &&
          !(payload.upload.type === "profile-image" && upload.type === "profile-image") &&
          upload.id !== payload.upload.id
      ),
    ]);
    setUploadMessage(`${label} uploaded.`);
    window.setTimeout(() => setUploadMessage(""), 3000);
  };

  const deleteUpload = async (uploadId: string) => {
    const response = await fetch(`/api/uploads/${uploadId}`, {
      method: "DELETE",
      credentials: "same-origin",
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setUploadMessage(payload?.error ?? "Could not remove upload.");
      return;
    }

    setUploads((prev) => prev.filter((upload) => upload.id !== uploadId));
  };

  const payVerificationFee = async () => {
    const response = await fetch("/api/verifications/payment", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageId: hasVettingPackages ? verificationPackageId : undefined,
      }),
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setUploadMessage(payload?.error ?? "Could not record verification payment.");
      return;
    }

    const payload = await response.json();
    setVerificationPaymentStatus(payload.payment?.status ?? "paid");
    setVerificationFeePaidAt(payload.payment?.paidAt ?? "");
    setVerificationPaymentReference(payload.payment?.reference ?? "");
    setVerificationPackageId(payload.payment?.packageId ?? verificationPackageId);
    setVerificationPackageName(payload.payment?.packageName ?? verificationPackageName);
    setUploadMessage("Verification fee recorded. Upload the required documents to submit.");
    window.setTimeout(() => setUploadMessage(""), 3000);
  };

  const submitVerification = async () => {
    const response = await fetch("/api/verifications", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setUploadMessage(payload?.error ?? "Could not submit verification.");
      return;
    }

    setVerificationStatus("pending");
    setUploadMessage("Verification submitted for admin review.");
  };

  const canSubmitVerification = verificationPaid && missingDocuments.length === 0;

  if (loading) {
    return (
      <div className="min-h-screen brand-page px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-lg border border-[var(--brand-line)] bg-white p-6 text-center text-sm font-bold text-[var(--brand-muted)] shadow-sm">
          Checking your provider account...
        </div>
      </div>
    );
  }

  if (!session || user?.role !== "provider") {
    return (
      <div className="min-h-screen brand-page px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-lg border border-[var(--brand-line)] bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--brand-ivory)] text-[var(--brand-leaf)]">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-[var(--brand-ink)]">
            Sign in to manage a provider listing
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--brand-muted)]">
            Provider accounts can add services, pricing, photos, documents, verification, and public listing details.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/auth?mode=login">
              <Button variant="outline" className="w-full rounded-full border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)] sm:w-auto">
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Button>
            </Link>
            <Link href="/auth?role=provider">
              <Button className="w-full rounded-full bg-[var(--brand-leaf)] font-black text-white hover:bg-[var(--brand-coral)] sm:w-auto">
                <UserPlus className="mr-2 h-4 w-4" />
                Sign up as provider
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen brand-page py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-[var(--brand-ink)]">Provider Profile</h1>
          <p className="text-[var(--brand-muted)] mt-1">Manage your listing information</p>
        </div>

        {/* Cover + Avatar */}
        <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm overflow-hidden mb-6">
          <div
            className="h-36 relative"
            style={{ background: "linear-gradient(135deg, var(--brand-leaf), var(--brand-gold))" }}
          />
          <div className="px-6 pb-5">
            <div className="relative -mt-12 mb-4 w-fit">
              <div className="w-20 h-20 rounded-lg border-4 border-white shadow-md overflow-hidden bg-[var(--brand-ivory)] flex items-center justify-center text-4xl">
                {profileImageUpload ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImageUpload.url}
                    alt="Provider profile picture"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  "🏫"
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--brand-line)] bg-white text-[var(--brand-leaf)] shadow-sm hover:bg-[var(--brand-ivory)]">
                <input
                  type="file"
                  className="sr-only"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) =>
                    uploadFile(event.target.files?.[0], "profile-image", "Profile picture")
                  }
                  disabled={loading}
                />
                <ImagePlus className="h-4 w-4" />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--brand-ink)]">{user?.name ?? "Provider profile"}</h2>
                <p className="text-[var(--brand-muted)] text-sm">
                  {user ? user.location ?? "Botswana" : "Sign in to sync this listing"}
                </p>
              </div>
              {verified && (
                <Badge className="rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </Badge>
              )}
              <Badge
                className={`rounded-full border ${
                  published
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-[var(--brand-line)] bg-[var(--brand-ivory)] text-[var(--brand-muted)]"
                }`}
              >
                {published ? "Published" : "Draft"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-[var(--brand-line)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-black text-[var(--brand-ink)]">
              {published ? "Your listing is visible in provider search." : "Your listing is private."}
            </div>
            <div className="mt-1 text-xs text-[var(--brand-muted)]">
              {verified
                ? "Your verified badge is active."
                : "Upload your documents for admin review to qualify for the verified badge."}
            </div>
          </div>
          {published && session && (
            <a
              href={`/provider/account-${session.userId}`}
              className="text-sm font-black text-[var(--brand-leaf)] hover:underline"
            >
              View public listing
            </a>
          )}
        </div>

        <Tabs defaultValue="basic">
          <TabsList className="grid grid-cols-4 bg-white border border-[var(--brand-line)] rounded-lg p-1 shadow-sm mb-6 w-full">
            <TabsTrigger value="basic" className="rounded-lg text-sm">Basic Info</TabsTrigger>
            <TabsTrigger value="documents" className="rounded-lg text-sm">Documents</TabsTrigger>
            <TabsTrigger value="pricing" className="rounded-lg text-sm">Pricing</TabsTrigger>
            <TabsTrigger value="gallery" className="rounded-lg text-sm">Gallery</TabsTrigger>
          </TabsList>

          {/* Basic Info */}
          <TabsContent value="basic">
            <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6 space-y-5">
              <div>
                <Label className="text-sm font-medium text-[var(--brand-ink)]">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v ?? "schools")}>
                  <SelectTrigger className="mt-1 rounded-lg border-[var(--brand-line)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_CATEGORY_OPTIONS.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="provider-display-name" className="text-sm font-medium text-[var(--brand-ink)]">
                  Public display name
                </Label>
                <Input
                  id="provider-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={isSchool ? "Sunshine Early Learning Centre" : "Kefilwe Modise"}
                  className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-[var(--brand-ink)]">Location / Area</Label>
                <Input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Phakalane, Gaborone"
                  className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-[var(--brand-ink)]">About / Description</Label>
                <Textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Describe your care approach, qualifications, and what families can expect."
                  className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] resize-none"
                  rows={4}
                />
              </div>

              {isIndividualCare && (
                <div className="grid gap-4 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Age</Label>
                    <Input
                      type="number"
                      min="18"
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                      placeholder="e.g. 32"
                      className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Availability date</Label>
                    <Input
                      type="date"
                      value={workStartDate}
                      onChange={(event) => setWorkStartDate(event.target.value)}
                      className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Stay arrangement</Label>
                    <Select
                      value={stayArrangement}
                      onValueChange={(value) =>
                        setStayArrangement(value === "stay-in" ? "stay-in" : "stay-out")
                      }
                    >
                      <SelectTrigger className="mt-1 rounded-lg border-[var(--brand-line)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stay-in">Stay in</SelectItem>
                        <SelectItem value="stay-out">Stay out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Number of kids</Label>
                    <Input
                      type="number"
                      min="0"
                      value={childrenCount}
                      onChange={(event) => setChildrenCount(event.target.value)}
                      placeholder="e.g. 2"
                      className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-[var(--brand-line)] bg-white p-4">
                    <div>
                      <div className="text-sm font-medium text-[var(--brand-ink)]">Willing to relocate</div>
                      <div className="text-xs text-gray-400">Open to moving for work</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWillingToRelocate(!willingToRelocate)}
                      className="text-[var(--brand-leaf)]"
                      aria-label={willingToRelocate ? "Disable relocation" : "Enable relocation"}
                    >
                      {willingToRelocate ? (
                        <ToggleRight className="h-8 w-8" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-gray-300" />
                      )}
                    </button>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Years of work experience</Label>
                    <Input
                      type="number"
                      min="0"
                      value={yearsExperience}
                      onChange={(event) => setYearsExperience(event.target.value)}
                      placeholder="e.g. 5"
                      className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">References</Label>
                    <Input
                      value={references}
                      onChange={(event) => setReferences(event.target.value)}
                      placeholder="Available on request or list referee names"
                      className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Brief work experience</Label>
                    <Textarea
                      value={workExperienceSummary}
                      onChange={(event) => setWorkExperienceSummary(event.target.value)}
                      placeholder="Summarise previous families, duties, ages cared for, and household responsibilities."
                      className="mt-1 resize-none rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                      rows={3}
                    />
                  </div>
                  <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label className="text-sm font-medium text-[var(--brand-ink)]">Next of kin name</Label>
                      <Input value={nextOfKinName} onChange={(event) => setNextOfKinName(event.target.value)} className="mt-1 rounded-lg border-[var(--brand-line)]" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-[var(--brand-ink)]">Relationship</Label>
                      <Input value={nextOfKinRelationship} onChange={(event) => setNextOfKinRelationship(event.target.value)} className="mt-1 rounded-lg border-[var(--brand-line)]" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-[var(--brand-ink)]">Phone</Label>
                      <Input value={nextOfKinPhone} onChange={(event) => setNextOfKinPhone(event.target.value)} className="mt-1 rounded-lg border-[var(--brand-line)]" />
                    </div>
                  </div>
                </div>
              )}

              {isSchool && (
                <div className="grid gap-4 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4">
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Mission</Label>
                    <Textarea value={mission} onChange={(event) => setMission(event.target.value)} rows={2} className="mt-1 resize-none rounded-lg border-[var(--brand-line)]" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Vision</Label>
                    <Textarea value={vision} onChange={(event) => setVision(event.target.value)} rows={2} className="mt-1 resize-none rounded-lg border-[var(--brand-line)]" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Values</Label>
                    <Textarea value={values} onChange={(event) => setValues(event.target.value)} rows={2} className="mt-1 resize-none rounded-lg border-[var(--brand-line)]" />
                  </div>
                </div>
              )}

              {isPediatric && (
                <div className="rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4">
                  <Label className="text-sm font-medium text-[var(--brand-ink)]">Medical aids accepted</Label>
                  <Textarea
                    value={medicalAids}
                    onChange={(event) => setMedicalAids(event.target.value)}
                    placeholder="All medical aids, or list the specific schemes accepted."
                    rows={3}
                    className="mt-1 resize-none rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                  />
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-[var(--brand-ink)]">Services</Label>
                <Textarea
                  value={services}
                  onChange={(event) => setServices(event.target.value)}
                  placeholder="Baby class, aftercare, holiday programme"
                  className="mt-1 resize-none rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                  rows={3}
                />
                <p className="mt-1 text-xs text-[var(--brand-muted)]">Separate services with commas.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium text-[var(--brand-ink)]">Experience</Label>
                  <Input
                    value={experience}
                    onChange={(event) => setExperience(event.target.value)}
                    placeholder="10 years of childcare experience"
                    className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-[var(--brand-ink)]">Availability</Label>
                  <Input
                    value={availability}
                    onChange={(event) => setAvailability(event.target.value)}
                    placeholder="Monday to Friday, 7:00 AM - 5:30 PM"
                    className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                  />
                </div>
              </div>

              <Separator />

              <h4 className="font-semibold text-[var(--brand-ink)]">Contact Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-[var(--brand-ink)]">Phone Number</Label>
                  <Input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+267 71 234 567"
                    className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-[var(--brand-ink)]">WhatsApp Number</Label>
                  <Input
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(event.target.value)}
                    placeholder="+26771234567"
                    className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium text-[var(--brand-ink)]">Email Address</Label>
                  <Input
                    type="email"
                    value={user?.email ?? ""}
                    readOnly
                    className="mt-1 rounded-lg border-[var(--brand-line)] bg-[var(--brand-ivory)]"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents">
            <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6 space-y-5">
              <p className="text-[var(--brand-muted)] text-sm bg-blue-50 rounded-lg p-3 border border-blue-100">
                Pay the verification fee and upload the required documents for your provider type.
                Once approved, your public profile displays the Verified badge.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-[var(--brand-ink)]">
                    <CreditCard className="h-4 w-4 text-[var(--brand-leaf)]" />
                    {hasVettingPackages ? "Nanny/helper vetting package" : "Verification fee"}
                  </div>
                  {hasVettingPackages ? (
                    <div className="mt-3 grid gap-2">
                      {VETTING_PACKAGES.map((plan) => {
                        const selected = verificationPackageId === plan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => {
                              if (verificationPaid) return;
                              setVerificationPackageId(plan.id);
                              setVerificationPackageName(plan.name);
                            }}
                            className={`rounded-lg border p-3 text-left transition-colors ${
                              selected
                                ? "border-[var(--brand-leaf)] bg-white"
                                : "border-[var(--brand-line)] bg-[var(--brand-ivory)] hover:border-[var(--brand-leaf)]"
                            } ${verificationPaid ? "cursor-default" : "cursor-pointer"}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-black text-[var(--brand-ink)]">
                                {plan.name}
                              </span>
                              <span className="text-lg font-black text-[var(--brand-ink)]">
                                P {plan.price}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[var(--brand-muted)]">
                              {plan.summary}
                            </p>
                          </button>
                        );
                      })}
                      <div className="rounded-lg bg-white px-3 py-2">
                        <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-muted)]">
                          {selectedVettingPackage.name} includes
                        </div>
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-[var(--brand-muted)]">
                          {selectedVettingPackage.features.map((feature) => (
                            <li key={feature} className="flex gap-2">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-leaf)]" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-2 text-2xl font-black text-[var(--brand-ink)]">
                        P {VERIFICATION_FEE.amount}
                      </div>
                      <p className="mt-1 text-xs text-[var(--brand-muted)]">
                        One-time additional review fee for the verification badge.
                      </p>
                    </>
                  )}
                  {verificationPaid ? (
                    <Badge className="mt-3 rounded-full border-green-200 bg-green-50 text-green-700">
                      Paid{verificationPackageName ? ` · ${verificationPackageName}` : ""}
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      onClick={payVerificationFee}
                      className="mt-3 h-9 rounded-lg bg-[var(--brand-leaf)] text-xs font-black text-white hover:bg-[var(--brand-coral)]"
                    >
                      Pay P {verificationPrice}
                    </Button>
                  )}
                  {verificationFeePaidAt && (
                    <p className="mt-2 text-xs text-[var(--brand-muted)]">
                      Paid {new Date(verificationFeePaidAt).toLocaleDateString()}{" "}
                      {verificationPaymentReference && `· ${verificationPaymentReference}`}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-[var(--brand-line)] bg-white p-4">
                  <div className="text-sm font-black text-[var(--brand-ink)]">
                    Required for {verificationProviderType === "individual" ? "individuals" : "schools and organisations"}
                  </div>
                  <ul className="mt-3 space-y-2 text-xs text-[var(--brand-muted)]">
                    {documents.map((document) => {
                      const uploaded = documentUploads.some(
                        (upload) => upload.documentKey === document.key
                      );
                      return (
                        <li key={document.key} className="flex items-start gap-2">
                          <CheckCircle2
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                              uploaded ? "text-green-600" : "text-gray-300"
                            }`}
                          />
                          <span>
                            <span className="font-bold text-[var(--brand-ink)]">
                              {document.label}
                            </span>{" "}
                            {document.hint}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[var(--brand-ink)]">
                    {verificationStatus === "approved" && "Verification approved"}
                    {verificationStatus === "pending" && "Verification under review"}
                    {verificationStatus === "rejected" && "Updates required"}
                    {verificationStatus === "not_submitted" && "Ready for verification?"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--brand-muted)]">
                    {verificationStatus === "approved" &&
                      "Your public profile displays the Verified badge."}
                    {verificationStatus === "pending" &&
                      "An administrator is reviewing your submitted documents."}
                    {verificationStatus === "rejected" &&
                      "Update your documents, then submit them for another review."}
                    {verificationStatus === "not_submitted" &&
                      (verificationPaid
                        ? missingDocuments.length
                          ? `Missing: ${missingDocuments.map((document) => document.label).join(", ")}.`
                          : "All required documents are uploaded. Submit when ready."
                        : "Pay the verification fee before submitting for review.")}
                  </p>
                </div>
                {(verificationStatus === "not_submitted" ||
                  verificationStatus === "rejected") && (
                  <Button
                    type="button"
                    onClick={submitVerification}
                    disabled={!canSubmitVerification}
                    className="shrink-0 rounded-lg bg-[var(--brand-leaf)] text-white hover:bg-[var(--brand-leaf)]/90"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Submit for review
                  </Button>
                )}
              </div>

              {/* Admin-only sensitive documents */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-600">Admin Review Only</span>
                  <Badge className="rounded-full text-xs bg-red-50 text-red-600 border-red-200">Sensitive</Badge>
                </div>

                {sensitiveDocuments.map((doc) => {
                  const uploaded = documentUploads.find((upload) => upload.documentKey === doc.key);
                  return (
                  <div key={doc.label} className="border border-red-100 rounded-lg p-4 bg-red-50/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[var(--brand-ink)] text-sm">{doc.label}</div>
                        <div className="text-gray-400 text-xs mt-0.5">{doc.hint}</div>
                      </div>
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp"
                          onChange={(event) => uploadFile(event.target.files?.[0], "document", doc.label, doc.key)}
                          disabled={loading}
                        />
                        <Lock className="mr-1 h-3.5 w-3.5" />
                        <Upload className="mr-1 h-3.5 w-3.5" />
                        Upload
                      </label>
                    </div>
                    <div className="mt-3 flex min-h-10 items-center justify-between rounded-lg bg-gray-200/60 px-3">
                      <span className="text-xs text-gray-500">
                        {uploaded ? `${uploaded.fileName} · visible to admin only` : "Visible to admin only"}
                      </span>
                      {uploaded && (
                        <button
                          onClick={() => deleteUpload(uploaded.id)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label={`Remove ${doc.label}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
                })}
              </div>

              <Separator />

              {/* Standard documents */}
              <div className="space-y-4">
                <h4 className="font-semibold text-[var(--brand-ink)] text-sm">Supporting Documents</h4>
                {standardDocuments.map((doc) => {
                  const uploaded = documentUploads.find((upload) => upload.documentKey === doc.key);
                  return (
                  <div key={doc.label} className="border border-[var(--brand-line)] rounded-lg p-4 hover:border-[var(--brand-line)] transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[var(--brand-ink)] text-sm">{doc.label}</div>
                        <div className="text-gray-400 text-xs mt-0.5">{doc.hint}</div>
                      </div>
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-[var(--brand-line)] px-3 py-2 text-xs font-bold text-[var(--brand-leaf)] hover:bg-[var(--brand-ivory)]">
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp"
                          onChange={(event) => uploadFile(event.target.files?.[0], "document", doc.label, doc.key)}
                          disabled={loading}
                        />
                        <Upload className="w-3.5 h-3.5 mr-1" />
                        Upload
                      </label>
                    </div>
                    <div className="mt-3 flex min-h-8 items-center justify-between rounded-lg border border-dashed border-[var(--brand-line)] bg-gray-50 px-3">
                      <span className="text-xs text-gray-400">{uploaded ? uploaded.fileName : "No file uploaded"}</span>
                      {uploaded && (
                        <button
                          onClick={() => deleteUpload(uploaded.id)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label={`Remove ${doc.label}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
                })}
              </div>
              {uploadMessage && (
                <div className="rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-4 py-3 text-sm font-bold text-[var(--brand-leaf)]">
                  {uploadMessage}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Pricing */}
          <TabsContent value="pricing">
            <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6">
              {isSchool ? (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-[var(--brand-ink)]">Fee Structure by Grade</h3>
                    <Button
                      size="sm"
                      onClick={addFeeRow}
                      className="rounded-lg text-white text-xs"
                      style={{ background: "var(--brand-leaf)" }}
                    >
                      + Add Grade
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-xs font-semibold text-[var(--brand-muted)] uppercase tracking-wide px-2">
                      <span>Grade / Level</span>
                      <span>Per Term (BWP)</span>
                      <span>Per Year (BWP)</span>
                    </div>
                    {feeRows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-3 items-center">
                        <Input
                          value={row.grade}
                          onChange={(e) => updateFeeRow(idx, "grade", e.target.value)}
                          placeholder="e.g. Nursery"
                          className="rounded-lg border-[var(--brand-line)] text-sm focus-visible:ring-[var(--brand-leaf)]"
                        />
                        <Input
                          value={row.termly}
                          onChange={(e) => updateFeeRow(idx, "termly", e.target.value)}
                          placeholder="0"
                          type="number"
                          className="rounded-lg border-[var(--brand-line)] text-sm focus-visible:ring-[var(--brand-leaf)]"
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            value={row.annually}
                            onChange={(e) => updateFeeRow(idx, "annually", e.target.value)}
                            placeholder="0"
                            type="number"
                            className="rounded-lg border-[var(--brand-line)] text-sm focus-visible:ring-[var(--brand-leaf)]"
                          />
                          <button
                            onClick={() => removeFeeRow(idx)}
                            className="text-gray-400 hover:text-red-500 shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <h3 className="mb-2 font-bold text-[var(--brand-ink)]">
                    {isPediatric ? "Consultation price" : "Starting price"}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-[var(--brand-ink)]">
                        {isPediatric ? "Consultation price (BWP)" : "Price (BWP)"}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        placeholder="e.g. 350"
                        className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-[var(--brand-ink)]">Billing unit</Label>
                      <Select
                        value={priceUnit}
                        onValueChange={(value) =>
                          setPriceUnit((value ?? "per hour") as StoredProviderProfile["priceUnit"])
                        }
                      >
                        <SelectTrigger className="mt-1 rounded-lg border-[var(--brand-line)]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per hour">Per hour</SelectItem>
                          <SelectItem value="per day">Per day</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="termly">Termly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {isIndividualCare && (
                    <div className="mt-2 flex items-center justify-between rounded-lg border border-[var(--brand-line)] p-4">
                      <div>
                        <div className="text-sm font-medium text-[var(--brand-ink)]">Stay in arrangement</div>
                        <div className="text-xs text-gray-400">Provider can live with the family</div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setStayArrangement(stayArrangement === "stay-in" ? "stay-out" : "stay-in")
                        }
                        className="text-[var(--brand-leaf)]"
                        aria-label={stayArrangement === "stay-in" ? "Disable stay in" : "Enable stay in"}
                      >
                        {stayArrangement === "stay-in" ? (
                          <ToggleRight className="h-8 w-8" />
                        ) : (
                          <ToggleLeft className="h-8 w-8 text-gray-300" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Gallery */}
          <TabsContent value="gallery">
            <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-[var(--brand-ink)]">Photo Gallery</h3>
                  <p className="text-gray-400 text-xs mt-0.5">Upload photos to showcase your facility</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--brand-line)] px-3 py-2 text-xs font-bold text-[var(--brand-leaf)] hover:bg-[var(--brand-ivory)]">
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => uploadFile(event.target.files?.[0], "gallery", "Gallery photo")}
                    disabled={loading}
                  />
                  <ImagePlus className="w-3.5 h-3.5" />
                  Add Photos
                </label>
              </div>

              <label className="mb-4 block cursor-pointer rounded-lg border-2 border-dashed border-[var(--brand-line)] p-8 text-center transition-colors hover:border-[var(--brand-leaf)]">
                <input
                  type="file"
                  className="sr-only"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => uploadFile(event.target.files?.[0], "gallery", "Gallery photo")}
                  disabled={loading}
                />
                <ImagePlus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Drag and drop images here, or click to browse</p>
                <p className="text-gray-300 text-xs mt-1">JPG, PNG up to 5MB each</p>
              </label>

              {uploadMessage && (
                <div className="mb-4 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-4 py-3 text-sm font-bold text-[var(--brand-leaf)]">
                  {uploadMessage}
                </div>
              )}

              {galleryUploads.length ? (
                <div className="grid grid-cols-3 gap-3">
                  {galleryUploads.map((upload) => (
                  <div key={upload.id} className="relative aspect-square rounded-lg overflow-hidden group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={upload.url} alt={upload.label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => deleteUpload(upload.id)}
                        className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center"
                        aria-label={`Remove ${upload.fileName}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--brand-line)] bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
                  No gallery photos uploaded yet.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Save */}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => void saveProviderProfile(false)}
            disabled={loading}
            className="rounded-lg border-[var(--brand-line)] text-[var(--brand-muted)]"
          >
            {published ? "Unpublish" : "Save Draft"}
          </Button>
          <Button
            onClick={() => void saveProviderProfile(true)}
            disabled={loading}
            className="rounded-lg text-white font-semibold px-8"
            style={{ background: "var(--brand-leaf)" }}
          >
            {published ? "Update Published Listing" : "Publish Listing"}
          </Button>
        </div>
        {saveMessage && (
          <div className="mt-4 rounded-lg border border-[var(--brand-line)] bg-white px-4 py-3 text-sm font-bold text-[var(--brand-muted)]">
            {saveMessage}
          </div>
        )}
      </div>
    </div>
  );
}
