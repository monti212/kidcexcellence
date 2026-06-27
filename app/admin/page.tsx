"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
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
  label: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
}

interface AdminPendingVerification extends PendingVerification {
  uploads: AdminUpload[];
}

interface AdminState {
  pendingProviders: AdminPendingVerification[];
  approvedProviders: ApprovedVerification[];
  rejectedCount: number;
  stats: {
    totalProviders: number;
    totalParents: number;
    registeredProviders: number;
  };
  admin: {
    name: string;
    email: string;
  };
}

const DEFAULT_ADMIN_STATE: AdminState = {
  pendingProviders: [],
  approvedProviders: [],
  rejectedCount: 0,
  stats: {
    totalProviders: 0,
    totalParents: 0,
    registeredProviders: 0,
  },
  admin: {
    name: "Admin",
    email: "",
  },
};

function AdminDashboard() {
  const [adminState, setAdminState] = useState<AdminState>(DEFAULT_ADMIN_STATE);
  const { pendingProviders, approvedProviders, rejectedCount, stats, admin } = adminState;
  const [searchQuery, setSearchQuery] = useState("");
  const [actionError, setActionError] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/verifications", { credentials: "same-origin", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload) setAdminState(payload);
      })
      .catch(() => undefined)
      .finally(() => setDashboardLoading(false));
  }, []);

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

  return (
    <div className="min-h-screen brand-page">
      {/* Admin Header */}
      <div
        className="text-white px-6 py-4 flex items-center gap-3 shadow-md"
        style={{ background: "linear-gradient(135deg, var(--brand-ink), var(--brand-leaf))" }}
      >
        <Shield className="w-6 h-6" />
        <div>
          <h1 className="font-black text-lg">Kidcexcellence Admin</h1>
          <p className="text-white/70 text-xs">Provider Verification Dashboard</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
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
              <p className="text-[var(--brand-muted)] font-medium">All providers verified!</p>
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
                {approvedProviders.filter((p) =>
                  p.name.toLowerCase().includes(searchQuery.toLowerCase())
                ).map((p) => (
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
          <p className="text-[var(--brand-muted)] text-sm mb-6">Sign in with an allowed admin account</p>
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
          <p className="text-gray-400 text-xs mt-4">Admin emails must be listed in ADMIN_EMAILS.</p>
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
