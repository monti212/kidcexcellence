"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Shield,
  Users,
  Clock,
  BarChart2,
  Eye,
  Search,
  ExternalLink,
  FileText,
} from "lucide-react";
import {
  type ApprovedVerification,
  type PendingVerification,
} from "@/lib/platform-service";
import {
  notifyPlatformSessionChanged,
  usePlatformSession,
} from "@/lib/use-platform-session";

interface AdminUpload {
  id: string;
  type: "document" | "gallery" | "profile-image" | "cover-image";
  documentKey?: string;
  label: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt?: string;
  url: string;
}

interface AdminPendingVerification extends PendingVerification {
  uploads: AdminUpload[];
  verificationPayment?: {
    status: "unpaid" | "paid";
    amount?: number;
    currency?: string;
    paidAt?: string;
    reference?: string;
    packageId?: string;
    packageName?: string;
  } | null;
}

interface AdminRegisteredProvider {
  userId: string;
  name: string;
  email: string;
  category: string;
  rawCategory: string;
  location: string;
  published: boolean;
  createdAt: string;
  savedAt?: string;
  verificationStatus: "not_submitted" | "pending" | "approved" | "rejected";
  verificationPayment: {
    status: "unpaid" | "paid";
    amount?: number;
    currency?: string;
    paidAt?: string;
    reference?: string;
    packageId?: string;
    packageName?: string;
  };
  pendingId?: string;
  approvedDate?: string;
  documentCount: number;
  imageCount: number;
  uploads: AdminUpload[];
  missingDocuments: string[];
  missingProfileFields: string[];
}

interface AdminState {
  pendingProviders: AdminPendingVerification[];
  registeredProviders: AdminRegisteredProvider[];
  approvedProviders: ApprovedVerification[];
  rejectedCount: number;
  stats: {
    totalProviders: number;
    totalParents: number;
    registeredProviders: number;
  };
  platformAnalytics: {
    totalPageViews: number;
    totalVisitors: number;
    todayPageViews: number;
    todayVisitors: number;
    last7DaysPageViews: number;
    last7DaysVisitors: number;
    last28DaysPageViews: number;
    last28DaysVisitors: number;
    previous28DaysPageViews: number;
    lastVisitedAt?: string;
    daily: Array<{
      date: string;
      pageViews: number;
      visitors: number;
    }>;
    topPages: Array<{
      path: string;
      pageViews: number;
      lastVisitedAt?: string;
    }>;
  };
  admin: {
    name: string;
    email: string;
  };
}

const DEFAULT_ADMIN_STATE: AdminState = {
  pendingProviders: [],
  registeredProviders: [],
  approvedProviders: [],
  rejectedCount: 0,
  stats: {
    totalProviders: 0,
    totalParents: 0,
    registeredProviders: 0,
  },
  platformAnalytics: {
    totalPageViews: 0,
    totalVisitors: 0,
    todayPageViews: 0,
    todayVisitors: 0,
    last7DaysPageViews: 0,
    last7DaysVisitors: 0,
    last28DaysPageViews: 0,
    last28DaysVisitors: 0,
    previous28DaysPageViews: 0,
    daily: [],
    topPages: [],
  },
  admin: {
    name: "Admin",
    email: "",
  },
};

const ADMIN_DASHBOARD_REFRESH_MS = 5000;

function AdminDashboard() {
  const [adminState, setAdminState] = useState<AdminState>(DEFAULT_ADMIN_STATE);
  const {
    pendingProviders,
    registeredProviders,
    approvedProviders,
    rejectedCount,
    stats,
    platformAnalytics,
    admin,
  } = adminState;
  const [searchQuery, setSearchQuery] = useState("");
  const [actionError, setActionError] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [lastDashboardRefreshAt, setLastDashboardRefreshAt] = useState<Date | null>(null);
  const filteredApprovedProviders = approvedProviders.filter((provider) =>
    provider.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const refreshDashboard = useCallback(async () => {
    const response = await fetch("/api/admin/verifications", {
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    if (payload) {
      setAdminState(payload);
      setLastDashboardRefreshAt(new Date());
    }
    setDashboardLoading(false);
  }, []);

  useEffect(() => {
    const initialRefreshTimer = window.setTimeout(() => {
      void refreshDashboard();
    }, 0);

    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshDashboard();
      }
    }, ADMIN_DASHBOARD_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshDashboard();
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initialRefreshTimer);
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshDashboard]);

  const approveProvider = async (id: string) => {
    setActionError("");
    const response = await fetch("/api/admin/verifications", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "approve" }),
    }).catch(() => null);
    if (response?.ok) {
      setAdminState(await response.json());
      return;
    }
    setActionError("Admin session required. Please sign in again.");
  };

  const rejectProvider = async (id: string) => {
    setActionError("");
    const response = await fetch("/api/admin/verifications", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "reject" }),
    }).catch(() => null);
    if (response?.ok) {
      setAdminState(await response.json());
      return;
    }
    setActionError("Admin session required. Please sign in again.");
  };

  const categoryIcon = (category: string) =>
    category.toLowerCase().includes("nursery") ? "🌱"
    : category.toLowerCase().includes("nanny") ? "👩‍👧"
    : category.toLowerCase().includes("clinic") ? "🏥"
    : category.toLowerCase().includes("tutor") ? "📚"
    : "🏫";

  const statusBadgeClass = (status: AdminRegisteredProvider["verificationStatus"]) =>
    status === "approved" ? "bg-green-100 text-green-700"
    : status === "pending" ? "bg-orange-100 text-orange-700"
    : status === "rejected" ? "bg-red-100 text-red-700"
    : "bg-gray-100 text-gray-700";

  const statusLabel = (provider: AdminRegisteredProvider) =>
    provider.verificationStatus === "pending" ? "Submitted for admin review"
    : provider.verificationStatus === "approved" ? "Approved"
    : provider.verificationStatus === "rejected" ? "Rejected"
    : "Waiting for provider to submit";

  const pageViewChange =
    platformAnalytics.previous28DaysPageViews > 0
      ? Math.round(
          ((platformAnalytics.last28DaysPageViews - platformAnalytics.previous28DaysPageViews) /
            platformAnalytics.previous28DaysPageViews) *
            100
        )
      : null;
  const maxDailyPageViews = Math.max(
    1,
    ...platformAnalytics.daily.map((day) => day.pageViews)
  );

  return (
    <div className="min-h-screen brand-page">
      {/* Admin Header */}
      <div
        className="text-white px-6 py-4 flex items-center gap-3 shadow-md"
        style={{ background: "linear-gradient(135deg, var(--brand-ink), var(--brand-leaf))" }}
      >
        <Shield className="w-6 h-6" />
        <div>
          <h1 className="font-black text-lg">Kidcellence Admin</h1>
          <p className="text-white/70 text-xs">Provider Verification Dashboard</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/admin/featured-providers">
            <Button size="sm" className="rounded-full bg-yellow-400 text-[var(--brand-ink)] hover:bg-yellow-500 font-black">
              Featured Providers
            </Button>
          </Link>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-black">
            {admin.name.charAt(0).toUpperCase() || "A"}
          </div>
          <span className="text-sm font-medium">{admin.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Pending Verifications", value: pendingProviders.length, icon: <Clock className="w-5 h-5 text-orange-500" />, bg: "bg-orange-50", border: "border-orange-100" },
            { label: "Total Providers", value: stats.totalProviders, icon: <Users className="w-5 h-5 text-blue-500" />, bg: "bg-blue-50", border: "border-blue-100" },
            { label: "Registered Providers", value: stats.registeredProviders, icon: <Users className="w-5 h-5 text-violet-500" />, bg: "bg-violet-50", border: "border-violet-100" },
            { label: "Total Parents", value: stats.totalParents, icon: <Users className="w-5 h-5 text-emerald-600" />, bg: "bg-emerald-50", border: "border-emerald-50" },
            { label: "Verified Providers", value: approvedProviders.length, icon: <CheckCircle2 className="w-5 h-5 text-green-500" />, bg: "bg-green-50", border: "border-green-100" },
            { label: "Rejected This Session", value: rejectedCount, icon: <XCircle className="w-5 h-5 text-red-500" />, bg: "bg-red-50", border: "border-red-100" },
          ].map((stat) => (
            <div key={stat.label} className={`bg-white rounded-lg border ${stat.border} shadow-sm p-5`}>
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                {stat.icon}
              </div>
              <div className="text-2xl font-extrabold text-[var(--brand-ink)]">{stat.value}</div>
              <div className="text-[var(--brand-muted)] text-sm mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-8 rounded-lg border border-[var(--brand-line)] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-[var(--brand-leaf)]" />
              <h2 className="text-lg font-black text-[var(--brand-ink)]">Website Traffic</h2>
            </div>
            <div className="flex flex-col gap-1 sm:items-end">
              <Badge className="w-fit rounded-full border border-green-200 bg-green-50 text-xs text-green-700">
                Live
              </Badge>
              <p className="text-xs font-bold text-[var(--brand-muted)]">
                {lastDashboardRefreshAt
                  ? `Updated ${lastDashboardRefreshAt.toLocaleTimeString()}`
                  : "Updates every 5 seconds"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total visitors", value: platformAnalytics.totalVisitors },
              { label: "Total page views", value: platformAnalytics.totalPageViews },
              { label: "Visitors today", value: platformAnalytics.todayVisitors },
              { label: "Page views today", value: platformAnalytics.todayPageViews },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4">
                <div className="text-2xl font-extrabold text-[var(--brand-ink)]">
                  {stat.value.toLocaleString()}
                </div>
                <div className="mt-1 text-sm text-[var(--brand-muted)]">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-lg border border-[var(--brand-line)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[var(--brand-ink)]">Last 28 days</p>
                  <p className="mt-1 text-xs text-[var(--brand-muted)]">
                    {platformAnalytics.last28DaysVisitors.toLocaleString()} visitors ·{" "}
                    {platformAnalytics.last28DaysPageViews.toLocaleString()} page views
                  </p>
                </div>
                {pageViewChange !== null && (
                  <Badge className={`rounded-full border-0 text-xs ${
                    pageViewChange >= 0
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}>
                    {pageViewChange >= 0 ? "+" : ""}{pageViewChange}%
                  </Badge>
                )}
              </div>
              <div className="mt-4 flex h-28 items-end gap-1">
                {platformAnalytics.daily.length === 0 ? (
                  <div className="flex h-full w-full items-center justify-center rounded-lg bg-[var(--brand-ivory)] text-sm font-bold text-[var(--brand-muted)]">
                    No traffic recorded yet
                  </div>
                ) : (
                  platformAnalytics.daily.map((day) => (
                    <div
                      key={day.date}
                      className="min-w-0 flex-1 rounded-t bg-[var(--brand-sky)]"
                      title={`${day.date}: ${day.pageViews} page views, ${day.visitors} visitors`}
                      style={{ height: `${Math.max(8, (day.pageViews / maxDailyPageViews) * 100)}%` }}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--brand-line)] p-4">
              <p className="text-sm font-black text-[var(--brand-ink)]">Top Pages</p>
              <div className="mt-3 space-y-2">
                {platformAnalytics.topPages.length === 0 ? (
                  <p className="rounded-lg bg-[var(--brand-ivory)] px-3 py-4 text-sm font-bold text-[var(--brand-muted)]">
                    No pages viewed yet.
                  </p>
                ) : (
                  platformAnalytics.topPages.map((page) => (
                    <div key={page.path} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--brand-ivory)] px-3 py-2">
                      <span className="min-w-0 truncate text-sm font-bold text-[var(--brand-ink)]">
                        {page.path}
                      </span>
                      <span className="shrink-0 text-sm font-black text-[var(--brand-leaf)]">
                        {page.pageViews.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pending Verifications */}
        <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-black text-[var(--brand-ink)]">Pending Verifications</h2>
              {pendingProviders.length > 0 && (
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-black flex items-center justify-center">
                  {pendingProviders.length}
                </span>
              )}
            </div>
          </div>

          {actionError && (
            <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {actionError}
            </div>
          )}

          {dashboardLoading ? (
            <div className="py-10 text-center text-sm text-[var(--brand-muted)]">
              Loading verification queue...
            </div>
          ) : pendingProviders.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-[var(--brand-muted)] font-medium">No pending verification submissions</p>
              <p className="text-gray-400 text-sm">No pending verifications at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingProviders.map((provider) => (
                <div key={provider.id} className="border border-[var(--brand-line)] rounded-lg p-5 hover:border-emerald-200 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] text-2xl">
                      {categoryIcon(provider.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-black text-[var(--brand-ink)]">{provider.name}</h3>
                        <Badge className="rounded-full bg-emerald-50 text-emerald-700 border-0 text-xs">
                          {provider.category}
                        </Badge>
                        <Badge className="rounded-full bg-orange-100 text-orange-700 border-0 text-xs">
                          Pending
                        </Badge>
                      </div>
                      <p className="text-[var(--brand-muted)] text-sm mb-2">
                        📍 {provider.location} · Submitted {provider.submittedDate}
                      </p>
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                        <Badge
                          className={`rounded-full border ${
                            provider.verificationPayment?.status === "paid"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          {provider.verificationPayment?.status === "paid"
                            ? `Verification fee paid${
                                provider.verificationPayment.amount
                                  ? ` · P ${provider.verificationPayment.amount}`
                                  : ""
                              }${provider.verificationPayment.packageName ? ` · ${provider.verificationPayment.packageName}` : ""}`
                            : "Verification fee unpaid"}
                        </Badge>
                        {provider.verificationPayment?.reference && (
                          <span className="font-bold text-[var(--brand-muted)]">
                            {provider.verificationPayment.reference}
                          </span>
                        )}
                      </div>
                      <div className="mb-4 flex flex-wrap gap-2">
                        {provider.uploads.length === 0 ? (
                          <span className="text-xs font-medium text-red-600">
                            No reviewable files found
                          </span>
                        ) : (
                          provider.uploads.map((upload) => (
                            <a
                              key={upload.id}
                              href={upload.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-3 py-2 text-xs font-bold text-[var(--brand-ink)] hover:border-[var(--brand-leaf)]"
                            >
                              <FileText className="h-3.5 w-3.5 text-[var(--brand-leaf)]" />
                              {upload.label}
                              <ExternalLink className="h-3 w-3 text-[var(--brand-muted)]" />
                            </a>
                          ))
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveProvider(provider.id)}
                          className="rounded-lg text-white text-xs flex items-center gap-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectProvider(provider.id)}
                          className="rounded-lg text-xs border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Registered Providers */}
        <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6 mb-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-500" />
              <h2 className="text-lg font-black text-[var(--brand-ink)]">Registered Providers</h2>
              {registeredProviders.length > 0 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-700">
                  {registeredProviders.length}
                </span>
              )}
            </div>
          </div>

          {dashboardLoading ? (
            <div className="py-10 text-center text-sm text-[var(--brand-muted)]">
              Loading registered providers...
            </div>
          ) : registeredProviders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--brand-line)] bg-[var(--brand-ivory)] px-4 py-8 text-center">
              <Users className="mx-auto h-8 w-8 text-[var(--brand-muted)]" />
              <p className="mt-2 font-bold text-[var(--brand-muted)]">No registered providers yet.</p>
              <p className="mt-1 text-sm text-gray-400">Provider accounts will appear here after signup.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {registeredProviders.map((provider) => {
                const needsProviderAction =
                  provider.verificationStatus === "not_submitted" ||
                  provider.verificationStatus === "rejected";
                const blockers = [
                  ...provider.missingProfileFields,
                  ...provider.missingDocuments,
                  provider.verificationPayment.status === "paid" ? "" : "Verification payment",
                  provider.pendingId ? "" : "Click Submit for review on the provider Documents tab",
                ].filter(Boolean);

                return (
                  <div key={provider.userId} className="rounded-lg border border-[var(--brand-line)] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] text-xl">
                        {categoryIcon(provider.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-[var(--brand-ink)]">{provider.name}</h3>
                          <Badge className="rounded-full bg-emerald-50 text-emerald-700 border-0 text-xs">
                            {provider.category}
                          </Badge>
                          <Badge className={`rounded-full border-0 text-xs ${statusBadgeClass(provider.verificationStatus)}`}>
                            {statusLabel(provider)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-[var(--brand-muted)]">
                          {provider.email} · {provider.location}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <Badge
                            className={`rounded-full border ${
                              provider.verificationPayment.status === "paid"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-red-200 bg-red-50 text-red-700"
                            }`}
                          >
                            {provider.verificationPayment.status === "paid" ? "Payment paid" : "Payment unpaid"}
                          </Badge>
                          <Badge className="rounded-full border border-blue-100 bg-blue-50 text-blue-700">
                            {provider.documentCount} document{provider.documentCount === 1 ? "" : "s"}
                          </Badge>
                          <Badge className="rounded-full border border-cyan-100 bg-cyan-50 text-cyan-700">
                            {provider.imageCount} image{provider.imageCount === 1 ? "" : "s"}
                          </Badge>
                          <Badge className="rounded-full border border-[var(--brand-line)] bg-white text-[var(--brand-muted)]">
                            {provider.published ? "Published listing" : "Draft listing"}
                          </Badge>
                        </div>

                        {provider.uploads.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {provider.uploads.map((upload) => (
                              <a
                                key={upload.id}
                                href={upload.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-3 py-2 text-xs font-bold text-[var(--brand-ink)] hover:border-[var(--brand-leaf)]"
                              >
                                <FileText className="h-3.5 w-3.5 text-[var(--brand-leaf)]" />
                                {upload.label}
                                <ExternalLink className="h-3 w-3 text-[var(--brand-muted)]" />
                              </a>
                            ))}
                          </div>
                        )}

                        {needsProviderAction && blockers.length > 0 && (
                          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                            <p className="font-black">Still waiting on the provider</p>
                            <p className="mt-1 text-xs font-semibold">
                              Missing: {blockers.slice(0, 8).join(", ")}
                              {blockers.length > 8 ? `, and ${blockers.length - 8} more` : ""}.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Approved Providers */}
        <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5" style={{ color: "var(--brand-leaf)" }} />
              <h2 className="text-lg font-black text-[var(--brand-ink)]">Approved Providers</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 rounded-lg border-[var(--brand-line)] text-sm h-9 w-40"
              />
            </div>
          </div>

          {filteredApprovedProviders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--brand-line)] bg-[var(--brand-ivory)] px-4 py-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--brand-muted)]" />
              <p className="mt-2 font-bold text-[var(--brand-muted)]">
                No approved providers yet.
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Providers will appear here after documents are submitted and approved.
              </p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--brand-line)]">
                  <th className="text-left py-2 pr-4 text-[var(--brand-muted)] font-medium">Provider</th>
                  <th className="text-left py-2 pr-4 text-[var(--brand-muted)] font-medium">Category</th>
                  <th className="text-left py-2 pr-4 text-[var(--brand-muted)] font-medium">Approved Date</th>
                  <th className="text-left py-2 text-[var(--brand-muted)] font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredApprovedProviders.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-[var(--brand-ink)]">{p.name}</td>
                    <td className="py-3 pr-4">
                      <Badge className="rounded-full bg-emerald-50 text-emerald-700 border-0 text-xs">{p.category}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-[var(--brand-muted)]">{p.date}</td>
                    <td className="py-3">
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminGate() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { user, loading, refresh } = usePlatformSession();

  const login = async () => {
    setError("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "login",
        role: "admin",
        email,
        password,
      }),
    }).catch(() => null);

    if (response?.ok) {
      await refresh();
      notifyPlatformSessionChanged();
      return;
    }

    const payload = response ? await response.json().catch(() => null) : null;
    setError(payload?.error ?? "Admin sign-in failed.");
  };

  if (loading) {
    return (
      <div className="min-h-screen brand-page flex items-center justify-center text-[var(--brand-muted)]">
        Checking admin session...
      </div>
    );
  }

  if (user?.role === "admin") return <AdminDashboard />;

  return (
    <div className="min-h-screen brand-page flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-xl p-8 text-center">
          <div
            className="w-16 h-16 rounded-lg mx-auto mb-4 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--brand-ink), var(--brand-leaf))" }}
          >
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--brand-ink)] mb-1">Admin Access</h1>
          <p className="text-[var(--brand-muted)] text-sm mb-6">
            Sign in with an allowed admin email. First sign-in creates your admin password.
          </p>
          <Separator className="mb-5" />
          <div className="space-y-3">
            <Input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border-[var(--brand-line)] focus-visible:ring-emerald-600"
            />
            <Input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              className="rounded-lg border-[var(--brand-line)] focus-visible:ring-emerald-600"
            />
            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-left text-xs font-bold text-red-700">
                {error}
              </div>
            )}
            <Button
              className="w-full rounded-lg text-white font-black h-11"
              style={{ background: "var(--brand-leaf)" }}
              onClick={login}
            >
              Login
            </Button>
          </div>
          <p className="text-gray-400 text-xs mt-4">
            Admin emails must be built in or listed in ADMIN_EMAILS.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <AdminGate />
    </Suspense>
  );
}
