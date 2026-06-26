"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Shield,
  Users,
  Clock,
  BarChart2,
  Lock,
  Search,
} from "lucide-react";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import {
  APPROVED_VERIFICATIONS,
  PENDING_VERIFICATIONS,
  type ApprovedVerification,
  type PendingVerification,
} from "@/lib/platform-service";

interface AdminState {
  pendingProviders: PendingVerification[];
  approvedProviders: ApprovedVerification[];
  rejectedCount: number;
}

const DEFAULT_ADMIN_STATE: AdminState = {
  pendingProviders: PENDING_VERIFICATIONS,
  approvedProviders: APPROVED_VERIFICATIONS,
  rejectedCount: 0,
};

function AdminDashboard() {
  const [adminState, setAdminState] = useLocalStorageState<AdminState>(
    "kidcexcellence.admin.state",
    DEFAULT_ADMIN_STATE,
    (value): value is AdminState =>
      typeof value === "object" &&
      value !== null &&
      "pendingProviders" in value &&
      "approvedProviders" in value &&
      "rejectedCount" in value
  );
  const { pendingProviders, approvedProviders, rejectedCount } = adminState;
  const [showSensitive, setShowSensitive] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const approveProvider = async (id: string) => {
    const response = await fetch("/api/admin/verifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "approve" }),
    }).catch(() => null);
    if (response?.ok) {
      setAdminState(await response.json());
      return;
    }
    const provider = pendingProviders.find((item) => item.id === id);
    if (!provider) return;
    setAdminState({
      pendingProviders: pendingProviders.filter((p) => p.id !== id),
      approvedProviders: [
        {
          id: `approved-${provider.id}`,
          name: provider.name,
          category: provider.category,
          verified: true,
          date: new Date().toISOString().slice(0, 10),
        },
        ...approvedProviders,
      ],
      rejectedCount,
    });
  };

  const rejectProvider = async (id: string) => {
    const response = await fetch("/api/admin/verifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "reject" }),
    }).catch(() => null);
    if (response?.ok) {
      setAdminState(await response.json());
      return;
    }
    setAdminState({
      pendingProviders: pendingProviders.filter((p) => p.id !== id),
      approvedProviders,
      rejectedCount: rejectedCount + 1,
    });
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
            A
          </div>
          <span className="text-sm font-medium">Admin</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Pending Verifications", value: pendingProviders.length, icon: <Clock className="w-5 h-5 text-orange-500" />, bg: "bg-orange-50", border: "border-orange-100" },
            { label: "Total Providers", value: 47, icon: <Users className="w-5 h-5 text-blue-500" />, bg: "bg-blue-50", border: "border-blue-100" },
            { label: "Total Parents", value: 156, icon: <Users className="w-5 h-5 text-emerald-600" />, bg: "bg-emerald-50", border: "border-emerald-50" },
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

          {pendingProviders.length === 0 ? (
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
                      <div className="flex flex-wrap gap-2 mb-3">
                        {provider.documents.map((doc) => (
                          <span key={doc} className="bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-xs">
                            📄 {doc}
                          </span>
                        ))}
                      </div>
                      {/* View ID button (sensitive) */}
                      <button
                        onClick={() => setShowSensitive(showSensitive === provider.id ? null : provider.id)}
                        className="text-xs font-medium text-blue-600 flex items-center gap-1 hover:text-blue-800 mb-3"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {showSensitive === provider.id ? "Hide" : "View"} ID Document
                      </button>

                      {showSensitive === provider.id && (
                        <div className="relative h-24 bg-gray-200 rounded-lg flex items-center justify-center mb-3 border border-[var(--brand-line)] overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400 opacity-80 backdrop-blur" />
                          <div className="relative z-10 flex flex-col items-center text-gray-600">
                            <Lock className="w-6 h-6 mb-1" />
                            <span className="text-sm font-black">Sensitive Document</span>
                            <span className="text-xs opacity-70">ID details blurred for privacy</span>
                          </div>
                        </div>
                      )}

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
  const isAdmin = searchParams.get("admin") === "true";
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(isAdmin);

  if (authenticated) return <AdminDashboard />;

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
          <p className="text-[var(--brand-muted)] text-sm mb-6">Enter your admin password to continue</p>
          <Separator className="mb-5" />
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border-[var(--brand-line)] focus-visible:ring-emerald-600"
            />
            <Button
              className="w-full rounded-lg text-white font-black h-11"
              style={{ background: "var(--brand-leaf)" }}
              onClick={() => setAuthenticated(password === "admin123" || password.length > 0)}
            >
              Login
            </Button>
          </div>
          <p className="text-gray-400 text-xs mt-4">Or access via: /admin?admin=true</p>
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
