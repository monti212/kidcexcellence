"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Icon } from "@/components/kidcellence/Icon";
import {
  DocumentRow,
  Field,
  FieldGroup,
  Notice,
  Panel,
  StatTile,
  Toggle,
  UploadButton,
} from "@/components/kidcellence/dashboard/ui";
import {
  VerificationBanner,
  verificationStage,
} from "@/components/kidcellence/dashboard/VerificationBanner";
import { routes } from "@/lib/kidcellence/routes";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { PROVIDER_CATEGORY_OPTIONS } from "@/lib/mock-data";
import { usePlatformSession } from "@/lib/use-platform-session";
import {
  VERIFICATION_FEE,
  getVerificationDocuments,
  getVerificationProviderType,
  missingVerificationProfileFields,
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
  hasChildren?: "yes" | "no";
  workStartDate?: string;
  willingToRelocate?: boolean;
  childrenCount?: string;
  workExperienceSummary?: string;
  yearsExperience?: string;
  references?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelationship?: string;
  ownerFullName?: string;
  tradingHours?: string;
  numberPlate?: string;
  prdp?: string;
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
  coveredByFreeAccess?: boolean;
  feeRows: FeeRow[];
  savedAt?: string;
}

interface ProviderUpload {
  id: string;
  type: "document" | "gallery" | "profile-image" | "cover-image";
  documentKey?: string;
  label: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  url: string;
}

interface ProviderAnalyticsDay {
  date: string;
  profileViews: number;
  enquiries: number;
  messagesReceived: number;
}

interface ProviderAnalytics {
  profileViews: number;
  enquiries: number;
  messagesReceived: number;
  engagement: number;
  todayViews: number;
  last7DaysViews: number;
  last28DaysViews: number;
  previous28DaysViews: number;
  profileCompletion: number;
  lastViewedAt?: string;
  lastEnquiryAt?: string;
  lastMessageAt?: string;
  daily: ProviderAnalyticsDay[];
}

interface PublishRequirementIssue {
  section: string;
  field: string;
  tab: ProviderProfileTab;
  hint: string;
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
  hasChildren: "no",
  workStartDate: "",
  willingToRelocate: false,
  childrenCount: "",
  workExperienceSummary: "",
  yearsExperience: "",
  references: "",
  nextOfKinName: "",
  nextOfKinPhone: "",
  nextOfKinRelationship: "",
  ownerFullName: "",
  tradingHours: "",
  numberPlate: "",
  prdp: "",
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

const DEFAULT_PROVIDER_ANALYTICS: ProviderAnalytics = {
  profileViews: 0,
  enquiries: 0,
  messagesReceived: 0,
  engagement: 0,
  todayViews: 0,
  last7DaysViews: 0,
  last28DaysViews: 0,
  previous28DaysViews: 0,
  profileCompletion: 0,
  daily: [],
};

type ProviderProfileTab = "basic" | "documents" | "pricing" | "gallery";

function isProviderProfileTab(value: string | null): value is ProviderProfileTab {
  return value === "basic" || value === "documents" || value === "pricing" || value === "gallery";
}

export default function ProviderProfilePage() {
  return (
    <Suspense fallback={<ProviderProfileLoading />}>
      <ProviderProfileContent />
    </Suspense>
  );
}

function ProviderProfileLoading() {
  return <DashboardMessage>Checking your provider account...</DashboardMessage>;
}

function DashboardMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#f4fbfc", minHeight: "60vh", padding: "48px 16px" }}>
      <div role="status" style={{ maxWidth: 560, margin: "0 auto", background: "#ffffff", borderRadius: 24, padding: 24, textAlign: "center", fontSize: 15, fontWeight: 700, color: "#686973", boxShadow: "0 6px 20px rgba(63,62,68,.06)" }}>
        {children}
      </div>
    </div>
  );
}

interface FullAccessSubscription {
  status: "active" | "expired";
  daysRemaining: number;
  expiresAt: string;
}

function ProviderProfileContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const requestedCategory = searchParams.get("category");
  const requestedVettingCategory =
    requestedCategory && categorySupportsVettingPackages(requestedCategory)
      ? requestedCategory
      : "";
  const requestedPackage = VETTING_PACKAGES.find(
    (plan) => plan.id === searchParams.get("package")
  );
  const { user, session, loading } = usePlatformSession();
  const [activeTab, setActiveTab] = useState<ProviderProfileTab>(
    isProviderProfileTab(requestedTab) ? requestedTab : "basic"
  );
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
  const [category, setCategory] = useState(requestedVettingCategory || storedProfile.category);
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
  const [hasChildren, setHasChildren] = useState<"yes" | "no">(storedProfile.hasChildren ?? "no");
  const [workStartDate, setWorkStartDate] = useState(storedProfile.workStartDate ?? "");
  const [willingToRelocate, setWillingToRelocate] = useState(Boolean(storedProfile.willingToRelocate));
  const [childrenCount, setChildrenCount] = useState(storedProfile.childrenCount ?? "");
  const [workExperienceSummary, setWorkExperienceSummary] = useState(storedProfile.workExperienceSummary ?? "");
  const [yearsExperience, setYearsExperience] = useState(storedProfile.yearsExperience ?? "");
  const [references, setReferences] = useState(storedProfile.references ?? "");
  const [nextOfKinName, setNextOfKinName] = useState(storedProfile.nextOfKinName ?? "");
  const [nextOfKinPhone, setNextOfKinPhone] = useState(storedProfile.nextOfKinPhone ?? "");
  const [nextOfKinRelationship, setNextOfKinRelationship] = useState(storedProfile.nextOfKinRelationship ?? "");
  const [ownerFullName, setOwnerFullName] = useState(storedProfile.ownerFullName ?? "");
  const [tradingHours, setTradingHours] = useState(storedProfile.tradingHours ?? "");
  const [numberPlate, setNumberPlate] = useState(storedProfile.numberPlate ?? "");
  const [prdp, setPrdp] = useState(storedProfile.prdp ?? "");
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
    requestedPackage?.id ?? storedProfile.verificationPackageId ?? "standard"
  );
  const [verificationPackageName, setVerificationPackageName] = useState(
    requestedPackage?.name ?? storedProfile.verificationPackageName ?? ""
  );
  const [verified, setVerified] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [publishRequirements, setPublishRequirements] = useState<PublishRequirementIssue[]>([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploads, setUploads] = useState<ProviderUpload[]>([]);
  const [feeRows, setFeeRows] = useState<FeeRow[]>(storedProfile.feeRows);
  const [analytics, setAnalytics] = useState<ProviderAnalytics>(DEFAULT_PROVIDER_ANALYTICS);
  const [subscription, setSubscription] = useState<FullAccessSubscription | null>(null);
  const providerProfileHasLocalEditsRef = useRef(false);

  const markProviderProfileEdited = useCallback(() => {
    providerProfileHasLocalEditsRef.current = true;
  }, []);

  const isSchool = ["schools", "nurseries"].includes(category);
  const isIndividualCare = ["nannies", "helpers", "babysitters"].includes(category);
  const isPediatric = ["pediatric-clinics", "pediatric-therapy", "child-psychologists"].includes(category);
  const isTransport = category === "kiddies-transport";
  const isParty = category === "kiddies-parties";
  const documentUploads = uploads.filter((upload) => upload.type === "document");
  const galleryUploads = uploads.filter((upload) => upload.type === "gallery");
  const profileImageUpload = uploads.find((upload) => upload.type === "profile-image");
  const coverImageUpload = uploads.find((upload) => upload.type === "cover-image");
  const verificationProviderType = getVerificationProviderType(category);
  const documents = getVerificationDocuments(category);
  const sensitiveDocuments = documents.filter((document) => document.sensitive);
  const standardDocuments = documents.filter((document) => !document.sensitive);
  const missingDocuments = missingVerificationDocuments(
    category,
    documentUploads.map((upload) => upload.documentKey ?? "")
  );
  const missingProfileFields = missingVerificationProfileFields(
    {
      category,
      location,
      bio,
      price,
      age,
      stayArrangement,
      hasChildren,
      workStartDate,
      childrenCount,
      workExperienceSummary,
      yearsExperience,
      references,
      nextOfKinName,
      nextOfKinPhone,
      nextOfKinRelationship,
      ownerFullName,
      tradingHours,
      numberPlate,
      prdp,
      mission,
      vision,
      values,
      medicalAids,
      feeRows,
    },
    {
      profileImageUploaded: Boolean(profileImageUpload),
      coverImageUploaded: Boolean(coverImageUpload),
      galleryCount: galleryUploads.length,
    }
  );
  const verificationPaid = verificationPaymentStatus === "paid";
  const hasVettingPackages = categorySupportsVettingPackages(category);
  const selectedVettingPackage =
    VETTING_PACKAGES.find((plan) => plan.id === verificationPackageId) ?? VETTING_PACKAGES[0];
  const verificationPrice = hasVettingPackages
    ? selectedVettingPackage.price
    : VERIFICATION_FEE.amount;
  const analyticsTrend =
    analytics.previous28DaysViews > 0
      ? Math.round(
          ((analytics.last28DaysViews - analytics.previous28DaysViews) /
            analytics.previous28DaysViews) *
            100
        )
      : analytics.last28DaysViews > 0
        ? 100
        : 0;
  const analyticsSparklineMax = Math.max(
    1,
    ...analytics.daily.map((day) => day.profileViews)
  );
  const analyticsBars = analytics.daily.length
    ? analytics.daily.slice(-14)
    : Array.from({ length: 7 }, (_, index) => ({
        date: `empty-${index}`,
        profileViews: 0,
        enquiries: 0,
        messagesReceived: 0,
      }));

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
    setSubscription(payload.subscription ?? null);
    setAnalytics({
      ...DEFAULT_PROVIDER_ANALYTICS,
      ...(payload.analytics ?? {}),
      daily: Array.isArray(payload.analytics?.daily) ? payload.analytics.daily : [],
    });
    if (providerProfileHasLocalEditsRef.current) {
      return;
    }
    if (!payload.profile) {
      setDisplayName(user?.name ?? "");
      setCategory(requestedVettingCategory || user?.category || DEFAULT_PROVIDER_PROFILE.category);
      setLocation(user?.location ?? "");
      setPhone(user?.phone ?? "");
      setWhatsapp(user?.phone ?? "");
      return;
    }

    const profilePaymentStatus = payload.profile.verificationPaymentStatus ?? "unpaid";
    const nextCategory =
      profilePaymentStatus === "paid"
        ? payload.profile.category ?? DEFAULT_PROVIDER_PROFILE.category
        : requestedVettingCategory || payload.profile.category || DEFAULT_PROVIDER_PROFILE.category;
    const nextVerificationPackageId =
      profilePaymentStatus === "paid"
        ? payload.profile.verificationPackageId ?? "standard"
        : requestedPackage?.id ?? payload.profile.verificationPackageId ?? "standard";
    const nextVerificationPackageName =
      profilePaymentStatus === "paid"
        ? payload.profile.verificationPackageName ?? ""
        : requestedPackage?.name ?? payload.profile.verificationPackageName ?? "";

    setDisplayName(payload.profile.displayName ?? user?.name ?? "");
    setCategory(nextCategory);
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
    setHasChildren(payload.profile.hasChildren ?? "no");
    setWorkStartDate(payload.profile.workStartDate ?? "");
    setWillingToRelocate(Boolean(payload.profile.willingToRelocate));
    setChildrenCount(payload.profile.childrenCount ?? "");
    setWorkExperienceSummary(payload.profile.workExperienceSummary ?? "");
    setYearsExperience(payload.profile.yearsExperience ?? "");
    setReferences(payload.profile.references ?? "");
    setNextOfKinName(payload.profile.nextOfKinName ?? "");
    setNextOfKinPhone(payload.profile.nextOfKinPhone ?? "");
    setNextOfKinRelationship(payload.profile.nextOfKinRelationship ?? "");
    setOwnerFullName(payload.profile.ownerFullName ?? "");
    setTradingHours(payload.profile.tradingHours ?? "");
    setNumberPlate(payload.profile.numberPlate ?? "");
    setPrdp(payload.profile.prdp ?? "");
    setMission(payload.profile.mission ?? "");
    setVision(payload.profile.vision ?? "");
    setValues(payload.profile.values ?? "");
    setMedicalAids(payload.profile.medicalAids ?? "");
    setLiveIn(Boolean(payload.profile.liveIn));
    setPublished(Boolean(payload.profile.published));
    setVerificationStatus(payload.profile.verificationStatus ?? "not_submitted");
    setVerificationPaymentStatus(profilePaymentStatus);
    setVerificationFeePaidAt(payload.profile.verificationFeePaidAt ?? "");
    setVerificationPaymentReference(payload.profile.verificationPaymentReference ?? "");
    setVerificationPackageId(nextVerificationPackageId);
    setVerificationPackageName(nextVerificationPackageName);
    setVerified(Boolean(payload.verified));
    setFeeRows(Array.isArray(payload.profile.feeRows) ? payload.profile.feeRows : DEFAULT_PROVIDER_PROFILE.feeRows);
    setStoredProfile({
      displayName: payload.profile.displayName ?? user?.name ?? "",
      category: nextCategory,
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
      hasChildren: payload.profile.hasChildren ?? "no",
      workStartDate: payload.profile.workStartDate ?? "",
      willingToRelocate: Boolean(payload.profile.willingToRelocate),
      childrenCount: payload.profile.childrenCount ?? "",
      workExperienceSummary: payload.profile.workExperienceSummary ?? "",
      yearsExperience: payload.profile.yearsExperience ?? "",
      references: payload.profile.references ?? "",
      nextOfKinName: payload.profile.nextOfKinName ?? "",
      nextOfKinPhone: payload.profile.nextOfKinPhone ?? "",
      nextOfKinRelationship: payload.profile.nextOfKinRelationship ?? "",
      ownerFullName: payload.profile.ownerFullName ?? "",
      tradingHours: payload.profile.tradingHours ?? "",
      numberPlate: payload.profile.numberPlate ?? "",
      prdp: payload.profile.prdp ?? "",
      mission: payload.profile.mission ?? "",
      vision: payload.profile.vision ?? "",
      values: payload.profile.values ?? "",
      medicalAids: payload.profile.medicalAids ?? "",
      liveIn: Boolean(payload.profile.liveIn),
      published: Boolean(payload.profile.published),
      verificationStatus: payload.profile.verificationStatus ?? "not_submitted",
      verificationPaymentStatus: profilePaymentStatus,
      verificationFeeAmount: payload.profile.verificationFeeAmount,
      verificationFeeCurrency: payload.profile.verificationFeeCurrency,
      verificationFeePaidAt: payload.profile.verificationFeePaidAt,
      verificationPaymentReference: payload.profile.verificationPaymentReference,
      verificationPackageId: nextVerificationPackageId,
      verificationPackageName: nextVerificationPackageName,
      feeRows: Array.isArray(payload.profile.feeRows) ? payload.profile.feeRows : DEFAULT_PROVIDER_PROFILE.feeRows,
      savedAt: payload.profile.savedAt,
    });
  }, [requestedPackage, requestedVettingCategory, session, setStoredProfile, user]);

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
      hasChildren,
      workStartDate,
      willingToRelocate,
      childrenCount,
      workExperienceSummary,
      yearsExperience,
      references,
      nextOfKinName,
      nextOfKinPhone,
      nextOfKinRelationship,
      ownerFullName,
      tradingHours,
      numberPlate,
      prdp,
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
      const nextRequirements = Array.isArray(payload?.publishRequirements)
        ? payload.publishRequirements.filter(
            (issue: Partial<PublishRequirementIssue>) =>
              typeof issue.section === "string" &&
              typeof issue.field === "string" &&
              isProviderProfileTab(issue.tab ?? null) &&
              typeof issue.hint === "string"
          ) as PublishRequirementIssue[]
        : [];
      setPublishRequirements(nextRequirements);
      if (nextRequirements[0]) {
        setActiveTab(nextRequirements[0].tab);
      }
      setSaveMessage(payload?.error ?? "Could not save profile.");
      return;
    }

    const payload = await response.json();
    const savedProfile = { ...nextProfile, ...payload.profile };
    providerProfileHasLocalEditsRef.current = false;
    setStoredProfile(savedProfile);
    setPublished(Boolean(payload.profile.published));
    setVerificationStatus(payload.profile.verificationStatus ?? "not_submitted");
    setVerificationPaymentStatus(payload.profile.verificationPaymentStatus ?? "unpaid");
    setVerificationFeePaidAt(payload.profile.verificationFeePaidAt ?? "");
    setVerificationPaymentReference(payload.profile.verificationPaymentReference ?? "");
    setVerificationPackageId(payload.profile.verificationPackageId ?? "standard");
    setVerificationPackageName(payload.profile.verificationPackageName ?? "");
    setVerified(Boolean(payload.verified));
    setPublishRequirements([]);
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
    type: "document" | "gallery" | "profile-image" | "cover-image",
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
          !(payload.upload.type === "cover-image" && upload.type === "cover-image") &&
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
      setUploadMessage(payload?.error ?? "Could not open the payment page.");
      return;
    }

    const payload = await response.json();
    if (payload.payment?.status === "paid") {
      setVerificationPaymentStatus("paid");
      setVerificationFeePaidAt(payload.payment.paidAt ?? "");
      setVerificationPaymentReference(payload.payment.reference ?? "");
      setVerificationPackageId(payload.payment.packageId ?? verificationPackageId);
      setVerificationPackageName(payload.payment.packageName ?? verificationPackageName);
      setUploadMessage("Free full access is active for this month. No payment needed.");
      return;
    }

    if (payload.checkoutUrl) {
      window.location.assign(payload.checkoutUrl);
      return;
    }

    setUploadMessage("Payment page was not returned. Please contact Kidcellence before paying.");
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

  const canSubmitVerification =
    verificationPaid && missingDocuments.length === 0 && missingProfileFields.length === 0;

  const publicListingHref =
    published && session ? routes.provider(`account-${session.userId}`) : undefined;
  const firstName = (user?.name ?? "").trim().split(/\s+/)[0] ?? "";

  const goToTab = (tab: ProviderProfileTab) => {
    setActiveTab(tab);
    window.requestAnimationFrame(() =>
      document.getElementById("kc-listing-editor")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  if (loading) {
    return <ProviderProfileLoading />;
  }

  if (!session || user?.role !== "provider") {
    return (
      <div style={{ background: "#f4fbfc", padding: "48px 16px 80px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", background: "#ffffff", borderRadius: 24, padding: "32px 24px", textAlign: "center", boxShadow: "0 6px 20px rgba(63,62,68,.06)" }}>
          <span style={{ width: 64, height: 64, margin: "0 auto", borderRadius: "50%", background: "#f4fbfc", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="lock" size={28} color="#2a7b86" />
          </span>
          <h1 style={{ margin: "20px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px" }}>
            Sign in to manage a provider listing
          </h1>
          <p style={{ margin: "10px auto 0", maxWidth: 440, fontSize: 15, lineHeight: 1.6, color: "#686973" }}>
            Provider accounts can add services, pricing, photos, documents, verification, and public listing details.
          </p>
          <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link href={routes.login} className="kc-btn-outline">Log in</Link>
            <Link href={routes.providerSignup} className="kc-btn">Sign up as provider</Link>
          </div>
        </div>
      </div>
    );
  }

  const stage = verificationStage({
    status: verificationStatus,
    verified,
    missingProfileFields,
    missingDocumentCount: missingDocuments.length,
    documentCount: documents.length,
    paid: verificationPaid,
    publicListingHref,
    goTo: goToTab,
  });

  const sideItems: Array<{ tab: ProviderProfileTab; label: string; icon: "file" | "chart" | "image" | "shieldCheck" }> = [
    { tab: "basic", label: "Listing details", icon: "file" },
    { tab: "pricing", label: "Pricing", icon: "chart" },
    { tab: "gallery", label: "Photos", icon: "image" },
    { tab: "documents", label: "Verification", icon: "shieldCheck" },
  ];
  const tabTriggerClass =
    "min-h-11 flex-none rounded-full border border-[var(--kc-line)] bg-white px-4 text-[15px] font-bold text-[var(--kc-ink)] data-active:border-[var(--kc-teal-deep)] data-active:bg-[var(--kc-teal-deep)] data-active:text-white";
  const sectionLabel = { margin: 0, fontSize: 16, fontWeight: 800 } as const;

  return (
    <div style={{ color: "#3f3e44", background: "#f4fbfc" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 16px 64px", gap: 24 }} className="flex flex-col sm:px-6 lg:flex-row lg:items-start">
        {/* Side menu: a scrolling row on phones, a column beside the content on desktop. */}
        <aside style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }} className="lg:sticky lg:top-24 lg:w-60 lg:shrink-0">
          <nav
            className="kc-side flex flex-row gap-1 overflow-x-auto lg:flex-col"
            aria-label="Provider dashboard"
            style={{ background: "#ffffff", borderRadius: 24, padding: 10, boxShadow: "0 6px 20px rgba(63,62,68,.06)" }}
          >
            <a href="#top" className="w-auto shrink-0 whitespace-nowrap lg:w-full">
              <Icon name="chart" size={20} color="#686973" />Overview
            </a>
            {sideItems.map((item) => (
              <button
                key={item.tab}
                type="button"
                onClick={() => goToTab(item.tab)}
                aria-current={activeTab === item.tab ? "true" : undefined}
                className="w-auto shrink-0 whitespace-nowrap lg:w-full"
              >
                <Icon name={item.icon} size={20} color={activeTab === item.tab ? "#2a7b86" : "#686973"} />
                {item.label}
              </button>
            ))}
            <Link href={routes.messages} className="w-auto shrink-0 whitespace-nowrap lg:w-full">
              <Icon name="message" size={20} color="#686973" />Messages
            </Link>
            {publicListingHref && (
              <Link href={publicListingHref} className="w-auto shrink-0 whitespace-nowrap lg:w-full">
                <Icon name="eye" size={20} color="#686973" />Public listing
              </Link>
            )}
          </nav>
          {subscription && (
            <div style={{ background: "#fff5d3", borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              <strong style={{ fontSize: 14 }}>
                {subscription.status === "active" ? "Free month" : "Free month ended"}
              </strong>
              <span style={{ fontSize: 13, color: "#686973", lineHeight: 1.5 }}>
                {subscription.status === "active"
                  ? `${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? "" : "s"} of full access left, until ${new Date(subscription.expiresAt).toLocaleDateString()}.`
                  : `Full access ended ${new Date(subscription.expiresAt).toLocaleDateString()}.`}{" "}
                <Link href={routes.pricing} style={{ color: "#2a7b86", fontWeight: 700 }}>See pricing</Link>
              </span>
            </div>
          )}
        </aside>

        <div id="top" style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 24, scrollMarginTop: 96 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, color: "#686973", fontWeight: 600 }}>{firstName ? `Dumela, ${firstName}` : "Dumela"}</p>
              <h1 style={{ margin: "4px 0 0", fontSize: 36, fontWeight: 800, letterSpacing: "-1px" }}>Your listing</h1>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, background: "#ffffff", border: "1px solid #d7edf0", borderRadius: 14, padding: "8px 14px", minHeight: 44 }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: published ? "#2a7b86" : "#9fb9bd" }} />
                {published ? "Listing visible to parents" : "Listing private (draft)"}
              </span>
              {verified && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 14, background: "#2a7b86", color: "#ffffff", borderRadius: 14, padding: "8px 14px", minHeight: 44 }}>
                  <Icon name="shieldCheck" size={18} color="#ffffff" />Verified
                </span>
              )}
              {publicListingHref && (
                <Link href={publicListingHref} style={{ display: "flex", alignItems: "center", padding: "12px 18px", minHeight: 44, borderRadius: 14, background: "#2a7b86", color: "#ffffff", fontWeight: 800, textDecoration: "none" }}>
                  View public listing
                </Link>
              )}
            </div>
          </div>

          <VerificationBanner stage={stage} />

          {/* Performance, from /api/profiles/provider analytics */}
          <section aria-label="Listing performance" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 16 }}>
            <StatTile icon="eye" label="Profile views, 28 days" value={analytics.last28DaysViews.toLocaleString()} detail={`${analytics.todayViews} today · ${analytics.last7DaysViews} this week`} />
            <StatTile icon="message" label="Enquiries" value={analytics.enquiries.toLocaleString()} detail="New parent conversations started" />
            <StatTile icon="message" label="Messages" value={analytics.messagesReceived.toLocaleString()} detail="Inbound parent messages" />
            <StatTile icon="check" label="Listing complete" value={`${analytics.profileCompletion}%`} detail="Publish readiness" warm />
          </section>

          <Panel
            title="28-day view trend"
            description={
              <>
                {analytics.profileViews.toLocaleString()} lifetime views · engagement {analytics.engagement.toLocaleString()}
                {analytics.lastViewedAt ? ` · last viewed ${new Date(analytics.lastViewedAt).toLocaleDateString()}` : ""}
              </>
            }
            action={
              <span style={{ fontSize: 14, fontWeight: 800, padding: "6px 12px", borderRadius: 999, background: analyticsTrend >= 0 ? "#f4fbfc" : "#fff5d3", color: analyticsTrend >= 0 ? "#2a7b86" : "#c2412a", border: "1px solid #d7edf0" }}>
                {analyticsTrend >= 0 ? "+" : ""}
                {analyticsTrend}%
              </span>
            }
          >
            <div style={{ display: "flex", height: 80, alignItems: "flex-end", gap: 4 }}>
              {analyticsBars.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.profileViews} view${day.profileViews === 1 ? "" : "s"}`}
                  style={{
                    flex: 1,
                    borderRadius: "6px 6px 0 0",
                    background: "#54b2bf",
                    height: `${Math.max(8, (day.profileViews / analyticsSparklineMax) * 80)}px`,
                    opacity: day.profileViews ? 1 : 0.22,
                  }}
                />
              ))}
            </div>
          </Panel>

          {/* Listing editor */}
          <div id="kc-listing-editor" style={{ scrollMarginTop: 96, minWidth: 0 }}>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProviderProfileTab)}>
              <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
                <TabsTrigger value="basic" className={tabTriggerClass}>Listing details</TabsTrigger>
                <TabsTrigger value="documents" className={tabTriggerClass}>Verification</TabsTrigger>
                <TabsTrigger value="pricing" className={tabTriggerClass}>Pricing</TabsTrigger>
                <TabsTrigger value="gallery" className={tabTriggerClass}>Photos</TabsTrigger>
              </TabsList>

              {/* Listing details */}
              <TabsContent value="basic">
                <Panel title="Listing details" description="What parents see on your public listing.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Category">
                      <select className="kc-input" value={category} onChange={(event) => setCategory(event.target.value || "schools")}>
                        {PROVIDER_CATEGORY_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Public display name">
                      <input
                        id="provider-display-name"
                        className="kc-input"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder={isSchool ? "Sunshine Early Learning Centre" : "Kefilwe Modise"}
                      />
                    </Field>
                    <Field label="Location / Area" className="sm:col-span-2">
                      <input className="kc-input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Phakalane, Gaborone" />
                    </Field>
                    <Field label="About / Description" className="sm:col-span-2">
                      <textarea
                        className="kc-input"
                        style={{ resize: "vertical" }}
                        value={bio}
                        onChange={(event) => setBio(event.target.value)}
                        placeholder="Describe your care approach, qualifications, and what families can expect."
                        rows={4}
                      />
                    </Field>
                  </div>

                  {isIndividualCare && (
                    <FieldGroup onChange={markProviderProfileEdited} className="sm:grid-cols-2">
                      <Field label="Age">
                        <input className="kc-input" type="text" inputMode="numeric" pattern="[0-9]*" value={age} onChange={(event) => setAge(event.target.value)} placeholder="e.g. 32" />
                      </Field>
                      <Field label="Availability / resume work date">
                        <input className="kc-input" type="text" value={workStartDate} onChange={(event) => setWorkStartDate(event.target.value)} placeholder="e.g. 01/10/2026" />
                      </Field>
                      <Field label="Stay arrangement">
                        <select
                          className="kc-input"
                          value={stayArrangement}
                          onChange={(event) => {
                            markProviderProfileEdited();
                            setStayArrangement(event.target.value === "stay-in" ? "stay-in" : "stay-out");
                          }}
                        >
                          <option value="stay-in">Stay in</option>
                          <option value="stay-out">Stay out</option>
                        </select>
                      </Field>
                      <Field label="Do you have kids?">
                        <select
                          className="kc-input"
                          value={hasChildren}
                          onChange={(event) => {
                            markProviderProfileEdited();
                            setHasChildren(event.target.value === "yes" ? "yes" : "no");
                          }}
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </Field>
                      {hasChildren === "yes" && (
                        <Field label="Number of kids">
                          <input className="kc-input" type="text" inputMode="numeric" pattern="[0-9]*" value={childrenCount} onChange={(event) => setChildrenCount(event.target.value)} placeholder="e.g. 2" />
                        </Field>
                      )}
                      <div className="sm:col-span-2">
                        <Toggle
                          label="Willing to relocate"
                          description="Open to moving for work"
                          checked={willingToRelocate}
                          onToggle={() => {
                            markProviderProfileEdited();
                            setWillingToRelocate(!willingToRelocate);
                          }}
                        />
                      </div>
                      <Field label="Years of work experience">
                        <input className="kc-input" type="text" inputMode="numeric" pattern="[0-9]*" value={yearsExperience} onChange={(event) => setYearsExperience(event.target.value)} placeholder="e.g. 5" />
                      </Field>
                      <Field label="References">
                        <input className="kc-input" value={references} onChange={(event) => setReferences(event.target.value)} placeholder="Available on request or list referee names" />
                      </Field>
                      <Field label="Brief work experience" className="sm:col-span-2">
                        <textarea
                          className="kc-input"
                          style={{ resize: "vertical" }}
                          value={workExperienceSummary}
                          onChange={(event) => setWorkExperienceSummary(event.target.value)}
                          placeholder="Summarise previous families, duties, ages cared for, and household responsibilities."
                          rows={3}
                        />
                      </Field>
                      <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                        <Field label="Next of kin name">
                          <input className="kc-input" value={nextOfKinName} onChange={(event) => setNextOfKinName(event.target.value)} />
                        </Field>
                        <Field label="Relationship">
                          <input className="kc-input" value={nextOfKinRelationship} onChange={(event) => setNextOfKinRelationship(event.target.value)} />
                        </Field>
                        <Field label="Next of kin phone">
                          <input className="kc-input" value={nextOfKinPhone} onChange={(event) => setNextOfKinPhone(event.target.value)} />
                        </Field>
                      </div>
                    </FieldGroup>
                  )}

                  {isSchool && (
                    <FieldGroup>
                      <Field label="Mission">
                        <textarea className="kc-input" style={{ resize: "vertical" }} value={mission} onChange={(event) => setMission(event.target.value)} rows={2} />
                      </Field>
                      <Field label="Vision">
                        <textarea className="kc-input" style={{ resize: "vertical" }} value={vision} onChange={(event) => setVision(event.target.value)} rows={2} />
                      </Field>
                      <Field label="Values">
                        <textarea className="kc-input" style={{ resize: "vertical" }} value={values} onChange={(event) => setValues(event.target.value)} rows={2} />
                      </Field>
                    </FieldGroup>
                  )}

                  {isPediatric && (
                    <FieldGroup>
                      <Field label="Trading hours">
                        <input className="kc-input" value={tradingHours} onChange={(event) => setTradingHours(event.target.value)} placeholder="Monday to Friday, 8:00 AM - 5:00 PM" />
                      </Field>
                      <Field label="Medical aids accepted">
                        <textarea
                          className="kc-input"
                          style={{ resize: "vertical" }}
                          value={medicalAids}
                          onChange={(event) => setMedicalAids(event.target.value)}
                          placeholder="BPOMAS, PULA, ALL, CASH ONLY, or list the accepted schemes."
                          rows={3}
                        />
                      </Field>
                    </FieldGroup>
                  )}

                  {isTransport && (
                    <FieldGroup className="sm:grid-cols-2">
                      <Field label="Company or driver full names">
                        <input className="kc-input" value={ownerFullName} onChange={(event) => setOwnerFullName(event.target.value)} />
                      </Field>
                      <Field label="Number plate">
                        <input className="kc-input" value={numberPlate} onChange={(event) => setNumberPlate(event.target.value)} />
                      </Field>
                      <Field label="PRDP" className="sm:col-span-2">
                        <input className="kc-input" value={prdp} onChange={(event) => setPrdp(event.target.value)} />
                      </Field>
                    </FieldGroup>
                  )}

                  {isParty && (
                    <FieldGroup className="sm:grid-cols-2">
                      <Field label="Owner full names">
                        <input className="kc-input" value={ownerFullName} onChange={(event) => setOwnerFullName(event.target.value)} />
                      </Field>
                      <Field label="Trading hours">
                        <input className="kc-input" value={tradingHours} onChange={(event) => setTradingHours(event.target.value)} placeholder="Saturday to Sunday, 9:00 AM - 6:00 PM" />
                      </Field>
                    </FieldGroup>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Services" hint="Separate services with commas." className="sm:col-span-2">
                      <textarea
                        className="kc-input"
                        style={{ resize: "vertical" }}
                        value={services}
                        onChange={(event) => setServices(event.target.value)}
                        placeholder="Baby class, aftercare, holiday programme"
                        rows={3}
                      />
                    </Field>
                    <Field label="Experience">
                      <input className="kc-input" value={experience} onChange={(event) => setExperience(event.target.value)} placeholder="10 years of childcare experience" />
                    </Field>
                    <Field label="Availability">
                      <input className="kc-input" value={availability} onChange={(event) => setAvailability(event.target.value)} placeholder="Monday to Friday, 7:00 AM - 5:30 PM" />
                    </Field>
                  </div>

                  <div style={{ borderTop: "1px solid #d7edf0", paddingTop: 16 }}>
                    <h3 style={sectionLabel}>Contact information</h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field label="Phone number">
                        <input className="kc-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+267 71 234 567" />
                      </Field>
                      <Field label="WhatsApp number">
                        <input className="kc-input" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="+26771234567" />
                      </Field>
                      <Field label="Email address" className="sm:col-span-2">
                        <input className="kc-input" type="email" value={user?.email ?? ""} readOnly style={{ background: "#f4fbfc" }} />
                      </Field>
                    </div>
                  </div>
                </Panel>
              </TabsContent>

              {/* Verification */}
              <TabsContent value="documents">
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <Panel
                    title="Verification checklist"
                    description={`Required documents for ${
                      verificationProviderType === "individual"
                        ? "individual care providers"
                        : isPediatric
                          ? "paediatric specialists"
                          : isSchool
                            ? "schools and nurseries"
                            : "organisations"
                    }. Once approved, your public profile displays the Verified badge.`}
                  >
                    <Notice>
                      Your first month includes full provider access, so verification checkout is waived while it is active.
                    </Notice>
                    {[...sensitiveDocuments, ...standardDocuments].map((doc, index) => {
                      const uploaded = documentUploads.find((upload) => upload.documentKey === doc.key);
                      return (
                        <DocumentRow
                          key={doc.key}
                          index={index}
                          label={doc.label}
                          hint={doc.hint}
                          fileName={uploaded?.fileName}
                          sensitive={Boolean(doc.sensitive)}
                          disabled={loading}
                          onFile={(file) => uploadFile(file, "document", doc.label, doc.key)}
                          onRemove={uploaded ? () => deleteUpload(uploaded.id) : undefined}
                        />
                      );
                    })}
                    {uploadMessage && <Notice>{uploadMessage}</Notice>}
                  </Panel>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
                    <Panel
                      title={hasVettingPackages ? "Nanny/helper vetting package" : "Verification fee"}
                      style={{ flex: "999 1 360px" }}
                    >
                      {hasVettingPackages ? (
                        <div style={{ display: "grid", gap: 10 }}>
                          {VETTING_PACKAGES.map((plan) => {
                            const selected = verificationPackageId === plan.id;
                            return (
                              <button
                                key={plan.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => {
                                  if (verificationPaid) return;
                                  setVerificationPackageId(plan.id);
                                  setVerificationPackageName(plan.name);
                                }}
                                style={{
                                  textAlign: "left",
                                  padding: 16,
                                  borderRadius: 18,
                                  background: selected ? "#ffffff" : "#f4fbfc",
                                  border: `2px solid ${selected ? "#2a7b86" : "#d7edf0"}`,
                                  cursor: verificationPaid ? "default" : "pointer",
                                  color: "#3f3e44",
                                }}
                              >
                                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                  <strong style={{ fontSize: 16 }}>{plan.name}</strong>
                                  <strong style={{ fontSize: 20 }}>{verificationPaid ? "Included" : `P${plan.price}`}</strong>
                                </span>
                                <span style={{ display: "block", marginTop: 4, fontSize: 13, lineHeight: 1.5, color: "#686973" }}>{plan.summary}</span>
                              </button>
                            );
                          })}
                          <div style={{ borderRadius: 16, background: "#f4fbfc", padding: 14 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".6px", textTransform: "uppercase", color: "#686973" }}>
                              {selectedVettingPackage.name} includes
                            </div>
                            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 6 }}>
                              {selectedVettingPackage.features.map((feature) => (
                                <li key={feature} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.5, color: "#686973" }}>
                                  <Icon name="check" size={16} color="#2a7b86" strokeWidth={2.6} style={{ flex: "0 0 auto", marginTop: 2 }} />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-1px" }}>
                            {verificationPaid ? "P0" : `P${VERIFICATION_FEE.amount}`}
                          </div>
                          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#686973" }}>Included during the free full-access month.</p>
                        </div>
                      )}
                      {verificationPaid ? (
                        <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, color: "#2a7b86", background: "#f4fbfc", border: "1px solid #d7edf0", borderRadius: 999, padding: "6px 12px" }}>
                          <Icon name="check" size={16} color="#2a7b86" strokeWidth={2.6} />
                          Included{verificationPackageName ? ` · ${verificationPackageName}` : ""}
                        </span>
                      ) : (
                        <button type="button" onClick={payVerificationFee} className="kc-btn" style={{ alignSelf: "flex-start" }}>
                          Go to payment page - P{verificationPrice}
                        </button>
                      )}
                      {verificationFeePaidAt && (
                        <p style={{ margin: 0, fontSize: 13, color: "#686973" }}>
                          Paid {new Date(verificationFeePaidAt).toLocaleDateString()}{" "}
                          {verificationPaymentReference && `· ${verificationPaymentReference}`}
                        </p>
                      )}
                    </Panel>

                    <Panel title="Profile details required" style={{ flex: "1 1 280px" }}>
                      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                        {missingProfileFields.length ? (
                          missingProfileFields.map((field) => (
                            <li key={field} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                              <span aria-hidden="true" style={{ width: 18, height: 18, marginTop: 1, borderRadius: "50%", border: "2px solid #d7edf0", flex: "0 0 auto" }} />
                              <span>{field}</span>
                            </li>
                          ))
                        ) : (
                          <li style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                            <Icon name="check" size={18} color="#2a7b86" strokeWidth={2.6} style={{ flex: "0 0 auto" }} />
                            <span>All profile details for this provider type are complete.</span>
                          </li>
                        )}
                      </ul>
                    </Panel>
                  </div>

                  <section style={{ background: "#ffffff", borderRadius: 24, padding: 26, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", boxShadow: "0 6px 20px rgba(63,62,68,.06)" }}>
                    <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                        {verificationStatus === "approved" && "Verification approved"}
                        {verificationStatus === "pending" && "Verification under review"}
                        {verificationStatus === "rejected" && "Updates required"}
                        {verificationStatus === "not_submitted" && "Ready for verification?"}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.5, color: "#686973" }}>
                        {verificationStatus === "approved" && "Your public profile displays the Verified badge."}
                        {verificationStatus === "pending" && "An administrator is reviewing your submitted documents."}
                        {verificationStatus === "rejected" && "Update your documents, then submit them for another review."}
                        {verificationStatus === "not_submitted" &&
                          (verificationPaid
                            ? missingProfileFields.length
                              ? `Missing profile details: ${missingProfileFields.join(", ")}.`
                              : missingDocuments.length
                                ? `Missing documents: ${missingDocuments.map((document) => document.label).join(", ")}.`
                                : "All required details and documents are uploaded. Submit when ready."
                            : "Payment is only needed after the free full-access month ends.")}
                      </p>
                    </div>
                    {(verificationStatus === "not_submitted" || verificationStatus === "rejected") && (
                      <button type="button" onClick={submitVerification} disabled={!canSubmitVerification} className="kc-btn">
                        <Icon name="shieldCheck" size={18} color="#ffffff" />
                        Submit for review
                      </button>
                    )}
                  </section>
                </div>
              </TabsContent>

              {/* Pricing */}
              <TabsContent value="pricing">
                {isSchool ? (
                  <Panel
                    title="Fee structure by grade"
                    action={
                      <button type="button" onClick={addFeeRow} className="kc-btn-outline">
                        <Icon name="plus" size={18} />Add grade
                      </button>
                    }
                  >
                    <div style={{ display: "grid", gap: 10 }}>
                      <div className="grid grid-cols-3 gap-2" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".6px", textTransform: "uppercase", color: "#686973" }}>
                        <span>Grade / Level</span>
                        <span>Per term (BWP)</span>
                        <span>Per year (BWP)</span>
                      </div>
                      {feeRows.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-3 items-center gap-2">
                          <input className="kc-input" aria-label={`Grade ${idx + 1}`} value={row.grade} onChange={(e) => updateFeeRow(idx, "grade", e.target.value)} placeholder="e.g. Nursery" />
                          <input className="kc-input" aria-label={`Grade ${idx + 1} per term`} value={row.termly} onChange={(e) => updateFeeRow(idx, "termly", e.target.value)} placeholder="0" type="number" />
                          <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                            <input className="kc-input" aria-label={`Grade ${idx + 1} per year`} value={row.annually} onChange={(e) => updateFeeRow(idx, "annually", e.target.value)} placeholder="0" type="number" />
                            <button
                              type="button"
                              onClick={() => removeFeeRow(idx)}
                              aria-label={`Remove grade ${idx + 1}`}
                              style={{ flex: "0 0 auto", width: 36, height: 44, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              <Icon name="x" size={16} color="#686973" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                ) : (
                  <Panel
                    title={
                      isPediatric
                        ? "Consultation price"
                        : isTransport
                          ? "Price per month"
                          : isParty
                            ? "Services and prices"
                            : "Starting price"
                    }
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label={
                          isPediatric
                            ? "Consultation price (BWP)"
                            : isTransport
                              ? "Monthly transport price (BWP)"
                              : isParty
                                ? "Starting package price (BWP)"
                                : "Price (BWP)"
                        }
                      >
                        <input className="kc-input" type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="e.g. 350" />
                      </Field>
                      <Field label="Billing unit">
                        <select
                          className="kc-input"
                          value={priceUnit}
                          onChange={(event) =>
                            setPriceUnit((event.target.value || "per hour") as StoredProviderProfile["priceUnit"])
                          }
                        >
                          <option value="per hour">Per hour</option>
                          <option value="per day">Per day</option>
                          <option value="monthly">Monthly</option>
                          <option value="termly">Termly</option>
                        </select>
                      </Field>
                    </div>
                    {isIndividualCare && (
                      <Toggle
                        label="Stay in arrangement"
                        description="Provider can live with the family"
                        checked={stayArrangement === "stay-in"}
                        onToggle={() => setStayArrangement(stayArrangement === "stay-in" ? "stay-out" : "stay-in")}
                      />
                    )}
                  </Panel>
                )}
              </TabsContent>

              {/* Photos */}
              <TabsContent value="gallery">
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <Panel title="Profile picture and cover" description="Your profile picture appears on listing cards; the cover photo heads your public page.">
                    <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid #d7edf0" }}>
                      <div
                        className={coverImageUpload ? undefined : "kc-dots"}
                        style={{ height: 150, position: "relative", backgroundColor: "#54b2bf" }}
                      >
                        {coverImageUpload && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={coverImageUpload.url} alt="Provider cover photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                        <div style={{ position: "absolute", right: 12, bottom: 12 }}>
                          <UploadButton
                            label="Cover photo"
                            ariaLabel="Upload cover photo"
                            variant="outline"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={loading}
                            onFile={(file) => uploadFile(file, "cover-image", "Cover photo")}
                          />
                        </div>
                      </div>
                      <div style={{ padding: "0 18px 18px", display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ marginTop: -44, width: 96, height: 96, borderRadius: "50%", border: "4px solid #ffffff", background: "#f4fbfc", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(63,62,68,.12)", flex: "0 0 auto" }}>
                          {profileImageUpload ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profileImageUpload.url} alt="Provider profile picture" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <Icon name="image" size={32} color="#2a7b86" />
                          )}
                        </div>
                        <div style={{ flex: "1 1 160px", minWidth: 0, paddingTop: 12 }}>
                          <strong style={{ fontSize: 17, display: "block", overflowWrap: "anywhere" }}>{displayName || user?.name || "Provider profile"}</strong>
                          <span style={{ fontSize: 14, color: "#686973" }}>{location || user?.location || "Botswana"}</span>
                        </div>
                        <UploadButton
                          label="Profile picture"
                          ariaLabel="Upload profile picture"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={loading}
                          onFile={(file) => uploadFile(file, "profile-image", "Profile picture")}
                        />
                      </div>
                    </div>
                  </Panel>

                  <Panel
                    id="photos"
                    title="Photo gallery"
                    description="JPG, PNG or WebP, up to 5MB each."
                    action={<span style={{ fontSize: 14, color: "#686973", fontWeight: 600 }}>{galleryUploads.length} uploaded</span>}
                  >
                    {uploadMessage && <Notice>{uploadMessage}</Notice>}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))", gap: 14 }}>
                      {galleryUploads.map((upload) => (
                        <div key={upload.id} style={{ aspectRatio: "1", borderRadius: 18, overflow: "hidden", position: "relative", background: "#f4fbfc" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={upload.url} alt={upload.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <button
                            type="button"
                            onClick={() => deleteUpload(upload.id)}
                            aria-label={`Remove ${upload.fileName}`}
                            style={{ position: "absolute", top: 8, right: 8, width: 36, height: 36, borderRadius: "50%", border: 0, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}
                          >
                            <Icon name="x" size={14} color="#3f3e44" strokeWidth={2.4} />
                          </button>
                        </div>
                      ))}
                      <label style={{ aspectRatio: "1", borderRadius: 18, border: "2px dashed #54b2bf", background: "#f4fbfc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 800, fontSize: 14, color: "#2a7b86", cursor: "pointer", textAlign: "center", padding: 8 }}>
                        <input
                          type="file"
                          className="kc-sr-only"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) => {
                            uploadFile(event.target.files?.[0], "gallery", "Gallery photo");
                            event.target.value = "";
                          }}
                          disabled={loading}
                        />
                        <Icon name="plus" size={26} color="#2a7b86" />
                        Add photo
                      </label>
                    </div>
                    {galleryUploads.length === 0 && (
                      <p style={{ margin: 0, fontSize: 14, color: "#686973" }}>No gallery photos uploaded yet.</p>
                    )}
                  </Panel>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Save / publish */}
          <section style={{ background: "#ffffff", borderRadius: 24, padding: 20, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 6px 20px rgba(63,62,68,.06)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontSize: 14, color: "#686973", flex: "1 1 240px" }}>
                {published ? "Your listing is visible in provider search." : "Your listing is private."}{" "}
                {verified ? "Your verified badge is active." : "Upload your documents for admin review to qualify for the verified badge."}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button type="button" onClick={() => void saveProviderProfile(false)} disabled={loading} className="kc-btn-outline">
                  {published ? "Unpublish" : "Save draft"}
                </button>
                <button type="button" onClick={() => void saveProviderProfile(true)} disabled={loading} className="kc-btn">
                  {published ? "Update published listing" : "Publish listing"}
                </button>
              </div>
            </div>
            {saveMessage && (
              <div role="status" style={{ borderRadius: 16, background: "#f4fbfc", border: "1px solid #d7edf0", padding: "12px 16px", fontSize: 14 }}>
                <div style={{ fontWeight: 800 }}>{saveMessage}</div>
                {publishRequirements.length > 0 && (
                  <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}>
                    {publishRequirements.map((issue) => (
                      <li key={`${issue.section}-${issue.field}`} style={{ borderRadius: 12, background: "#ffffff", padding: "10px 12px" }}>
                        <button
                          type="button"
                          onClick={() => goToTab(issue.tab)}
                          style={{ border: 0, background: "none", padding: 0, fontWeight: 800, color: "#2a7b86", textAlign: "left", textDecoration: "underline" }}
                        >
                          {issue.section}: {issue.field}
                        </button>
                        <span style={{ display: "block", fontSize: 13, lineHeight: 1.5, color: "#686973" }}>{issue.hint}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
