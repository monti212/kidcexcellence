"use client";

import { useCallback, useEffect, useState } from "react";
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
  Camera,
  CheckCircle2,
  Lock,
  Upload,
  ImagePlus,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { usePlatformSession } from "@/lib/use-platform-session";

interface FeeRow {
  grade: string;
  termly: string;
  annually: string;
}

interface StoredProviderProfile {
  category: string;
  liveIn: boolean;
  feeRows: FeeRow[];
  savedAt?: string;
}

interface ProviderUpload {
  id: string;
  type: "document" | "gallery";
  documentKey?: string;
  label: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  url: string;
}

const DEFAULT_PROVIDER_PROFILE: StoredProviderProfile = {
  category: "schools",
  liveIn: false,
  feeRows: [
    { grade: "Baby Class", termly: "2800", annually: "8400" },
    { grade: "Toddler Class", termly: "3000", annually: "9000" },
    { grade: "Nursery", termly: "3200", annually: "9600" },
  ],
};

const SENSITIVE_DOCUMENTS = [
  { key: "national-id", label: "National ID / Passport", hint: "High-res scan of valid ID" },
];

const SUPPORTING_DOCUMENTS = [
  { key: "cv", label: "CV / Resume", hint: "PDF or Word document" },
  { key: "references", label: "References", hint: "Letters from previous employers" },
  { key: "proof-of-residence", label: "Proof of Residence", hint: "Utility bill or bank statement" },
  { key: "certified-id", label: "Certified ID Copy", hint: "Certified copy from commissioner" },
];

const SCHOOL_DOCUMENTS = [
  { key: "school-prospectus", label: "School Prospectus", hint: "PDF brochure or curriculum overview" },
];

export default function ProviderProfilePage() {
  const { user, session, loading } = usePlatformSession();
  const [storedProfile, setStoredProfile] = useLocalStorageState<StoredProviderProfile>(
    "kidcexcellence.provider.profile",
    DEFAULT_PROVIDER_PROFILE,
    (value): value is StoredProviderProfile =>
      typeof value === "object" &&
      value !== null &&
      "category" in value &&
      "liveIn" in value &&
      "feeRows" in value
  );
  const [category, setCategory] = useState(storedProfile.category);
  const [liveIn, setLiveIn] = useState(storedProfile.liveIn);
  const [verified] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploads, setUploads] = useState<ProviderUpload[]>([]);
  const [feeRows, setFeeRows] = useState<FeeRow[]>(storedProfile.feeRows);

  const isSchool = ["schools", "nurseries"].includes(category);
  const isNanny = ["nannies", "babysitters"].includes(category);
  const documentUploads = uploads.filter((upload) => upload.type === "document");
  const galleryUploads = uploads.filter((upload) => upload.type === "gallery");
  const documents = isSchool
    ? [...SUPPORTING_DOCUMENTS, ...SCHOOL_DOCUMENTS]
    : SUPPORTING_DOCUMENTS;

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
    if (!payload.profile) return;

    setCategory(payload.profile.category ?? DEFAULT_PROVIDER_PROFILE.category);
    setLiveIn(Boolean(payload.profile.liveIn));
    setFeeRows(Array.isArray(payload.profile.feeRows) ? payload.profile.feeRows : DEFAULT_PROVIDER_PROFILE.feeRows);
    setStoredProfile({
      category: payload.profile.category ?? DEFAULT_PROVIDER_PROFILE.category,
      liveIn: Boolean(payload.profile.liveIn),
      feeRows: Array.isArray(payload.profile.feeRows) ? payload.profile.feeRows : DEFAULT_PROVIDER_PROFILE.feeRows,
      savedAt: payload.profile.savedAt,
    });
  }, [session, setStoredProfile]);

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

  const saveProviderProfile = async () => {
    if (!session) {
      setSaveMessage("Sign in to save your provider profile.");
      return;
    }

    const nextProfile = { category, liveIn, feeRows, savedAt: new Date().toISOString() };
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

    setStoredProfile(nextProfile);
    setSaveMessage("Saved!");
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
    type: "document" | "gallery",
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
          ) && upload.id !== payload.upload.id
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
          >
            <button className="absolute bottom-3 right-3 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium text-[var(--brand-ink)] flex items-center gap-1 hover:bg-white transition-colors shadow-sm">
              <Camera className="w-3.5 h-3.5" />
              Change Cover
            </button>
          </div>
          <div className="px-6 pb-5">
            <div className="relative -mt-12 mb-4 w-fit">
              <div className="w-20 h-20 rounded-lg border-4 border-white shadow-md overflow-hidden bg-[var(--brand-ivory)] flex items-center justify-center text-4xl">
                🏫
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-[var(--brand-line)] shadow-sm flex items-center justify-center hover:bg-gray-50">
                <Camera className="w-3.5 h-3.5 text-[var(--brand-muted)]" />
              </button>
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
            </div>
          </div>
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
                    <SelectItem value="schools">School</SelectItem>
                    <SelectItem value="nurseries">Nursery</SelectItem>
                    <SelectItem value="nannies">Nanny</SelectItem>
                    <SelectItem value="babysitters">Babysitter</SelectItem>
                    <SelectItem value="pediatric-clinics">Pediatric Clinic</SelectItem>
                    <SelectItem value="tutors">Tutor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isSchool ? (
                <>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">School Name</Label>
                    <Input defaultValue={user?.name ?? ""} placeholder="Sunshine Early Learning Centre" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Curriculum Type</Label>
                    <Select defaultValue="cambridge">
                      <SelectTrigger className="mt-1 rounded-lg border-[var(--brand-line)]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cambridge">Cambridge EYFS</SelectItem>
                        <SelectItem value="national">National Curriculum (Botswana)</SelectItem>
                        <SelectItem value="montessori">Montessori</SelectItem>
                        <SelectItem value="waldorf">Waldorf / Steiner</SelectItem>
                        <SelectItem value="ib">IB Early Years</SelectItem>
                        <SelectItem value="mixed">Mixed Approach</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Year Established</Label>
                    <Input type="number" defaultValue="2010" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">First Name</Label>
                    <Input placeholder="e.g. Kefilwe" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Middle Name</Label>
                    <Input placeholder="Optional" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Last Name</Label>
                    <Input placeholder="e.g. Modise" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Known As / Display Name</Label>
                    <Input placeholder="e.g. Kefi" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-[var(--brand-ink)]">Location / Area</Label>
                <Select defaultValue="phakalane">
                  <SelectTrigger className="mt-1 rounded-lg border-[var(--brand-line)]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phakalane">Phakalane, Gaborone</SelectItem>
                    <SelectItem value="gaborone-west">Gaborone West</SelectItem>
                    <SelectItem value="tlokweng">Tlokweng</SelectItem>
                    <SelectItem value="block9">Block 9, Gaborone</SelectItem>
                    <SelectItem value="broadhurst">Broadhurst, Gaborone</SelectItem>
                    <SelectItem value="mogoditshane">Mogoditshane</SelectItem>
                    <SelectItem value="francistown">Francistown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-[var(--brand-ink)]">About / Description</Label>
                <Textarea
                  defaultValue="We provide outstanding early childhood education in a warm and nurturing environment. Our qualified staff follow the Cambridge curriculum enhanced with Setswana cultural values."
                  className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] resize-none"
                  rows={4}
                />
              </div>

              <Separator />

              <h4 className="font-semibold text-[var(--brand-ink)]">Contact Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-[var(--brand-ink)]">Phone Number</Label>
                  <Input defaultValue="+267 71 234 567" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-[var(--brand-ink)]">WhatsApp Number</Label>
                  <Input defaultValue="+26771234567" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium text-[var(--brand-ink)]">Email Address</Label>
                  <Input type="email" defaultValue={user?.email ?? ""} placeholder="info@sunshineelc.co.bw" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents">
            <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6 space-y-5">
              <p className="text-[var(--brand-muted)] text-sm bg-blue-50 rounded-lg p-3 border border-blue-100">
                Upload your documents for verification. Once approved, you&apos;ll receive the Verified badge on your profile.
              </p>

              {/* Admin-only sensitive documents */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-600">Admin Review Only</span>
                  <Badge className="rounded-full text-xs bg-red-50 text-red-600 border-red-200">Sensitive</Badge>
                </div>

                {SENSITIVE_DOCUMENTS.map((doc) => {
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
                {documents.map((doc) => {
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
              ) : isNanny ? (
                <div className="space-y-4">
                  <h3 className="font-bold text-[var(--brand-ink)] mb-2">Rate Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-[var(--brand-ink)]">Hourly Rate (BWP)</Label>
                      <Input type="number" placeholder="e.g. 50" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-[var(--brand-ink)]">Daily Rate (BWP)</Label>
                      <Input type="number" placeholder="e.g. 350" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-[var(--brand-ink)]">Monthly Salary (BWP)</Label>
                      <Input type="number" defaultValue="3500" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-[var(--brand-line)] rounded-lg mt-2">
                    <div>
                      <div className="font-medium text-[var(--brand-ink)] text-sm">Available for Live-In</div>
                      <div className="text-gray-400 text-xs">Live with the family</div>
                    </div>
                    <button onClick={() => setLiveIn(!liveIn)} className="text-[var(--brand-leaf)]">
                      {liveIn ? (
                        <ToggleRight className="w-8 h-8" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-gray-300" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-bold text-[var(--brand-ink)] mb-2">Service Rates</h3>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Hourly Rate (BWP)</Label>
                    <Input type="number" defaultValue="120" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-[var(--brand-ink)]">Consultation Fee (BWP)</Label>
                    <Input type="number" defaultValue="350" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
                  </div>
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
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" className="rounded-lg border-[var(--brand-line)] text-[var(--brand-muted)]">
            Cancel
          </Button>
          <Button
            onClick={saveProviderProfile}
            disabled={loading}
            className="rounded-lg text-white font-semibold px-8"
            style={{ background: "var(--brand-leaf)" }}
          >
            {saveMessage === "Saved!" ? "Saved!" : "Save Changes"}
          </Button>
        </div>
        {saveMessage && saveMessage !== "Saved!" && (
          <div className="mt-4 rounded-lg border border-[var(--brand-line)] bg-white px-4 py-3 text-sm font-bold text-[var(--brand-coral)]">
            {saveMessage}
          </div>
        )}
      </div>
    </div>
  );
}
