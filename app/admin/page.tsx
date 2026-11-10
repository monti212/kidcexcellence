"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, Suspense, type CSSProperties } from "react";
import Link from "next/link";
import { Icon, Star } from "@/components/kidcellence/Icon";
import {
  AdminBand,
  Avatar,
  KpiCard,
  Notice,
  Pill,
  linkButton,
  panelStyle,
  type PillTone,
} from "@/components/kidcellence/admin/AdminUi";
import { routes } from "@/lib/kidcellence/routes";
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
    providerSignupsToday: number;
    providerSignupsLast7Days: number;
    parentSignupsToday: number;
    parentSignupsLast7Days: number;
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
    providerSignupsToday: 0,
    providerSignupsLast7Days: 0,
    parentSignupsToday: 0,
    parentSignupsLast7Days: 0,
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

type View = "desk" | "providers" | "traffic";
type QueueFilter = "pending" | "approved";

const fmt = (value: number) => value.toLocaleString();

function UploadLinks({ uploads }: { uploads: AdminUpload[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {uploads.map((upload) => (
        <a
          key={upload.id}
          href={upload.url}
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 12, background: "#f4fbfc", border: "1px solid #d7edf0", fontSize: 12, fontWeight: 700, color: "#3f3e44", textDecoration: "none" }}
        >
          <Icon name="file" size={14} color="#2a7b86" />
          {upload.label}
        </a>
      ))}
    </div>
  );
}

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
  const [actionNotice, setActionNotice] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [lastDashboardRefreshAt, setLastDashboardRefreshAt] = useState<Date | null>(null);
  const [view, setView] = useState<View>("desk");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUploadId, setPreviewUploadId] = useState<string | null>(null);
  const filteredApprovedProviders = approvedProviders.filter((provider) =>
    provider.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const refreshDashboard = useCallback(async () => {
    const response = await fetch("/api/admin/verifications", {
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;

    // Without this, a failed request leaves the dashboard on its all-zero
    // default, which is indistinguishable from a platform that genuinely has no
    // providers, parents or traffic. Say so instead of reporting zeros.
    if (payload) {
      setAdminState(payload);
      setDashboardError("");
      setLastDashboardRefreshAt(new Date());
    } else if (!response) {
      setDashboardError(
        "Could not reach the server, so these figures are out of date."
      );
    } else {
      const failure = await response.json().catch(() => null);
      setDashboardError(
        failure?.error ??
          `The dashboard could not be loaded (HTTP ${response.status}), so these figures are out of date.`
      );
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

  const decide = async (provider: AdminPendingVerification, action: "approve" | "reject") => {
    setActionError("");
    setActionNotice("");
    setActionBusy(true);
    const response = await fetch("/api/admin/verifications", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: provider.id, action }),
    }).catch(() => null);
    setActionBusy(false);
    if (response?.ok) {
      setAdminState(await response.json());
      setSelectedId(null);
      setPreviewUploadId(null);
      setActionNotice(
        action === "approve"
          ? `${provider.name} approved. Their Verified badge is now live.`
          : `${provider.name} rejected. They can fix their submission and resubmit.`
      );
      return;
    }
    const payload = response ? await response.json().catch(() => null) : null;
    setActionError(payload?.error ?? "Admin session required. Please sign in again.");
  };

  const removeProvider = async (provider: AdminRegisteredProvider) => {
    const confirmed = window.confirm(
      `Permanently remove ${provider.name} (${provider.email || "no email"})?\n\n` +
        "This deletes their account, listing, uploads and conversations. It cannot be undone."
    );
    if (!confirmed) return;

    setActionError("");
    setActionNotice("");
    const response = await fetch("/api/admin/verifications", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: provider.userId }),
    }).catch(() => null);
    if (response?.ok) {
      setAdminState(await response.json());
      setActionNotice(`${provider.name} removed. Their listing, uploads and conversations were deleted.`);
      return;
    }
    const payload = await response?.json().catch(() => null);
    setActionError(payload?.error ?? "Could not remove provider. Please sign in again.");
  };

  const statusTone = (status: AdminRegisteredProvider["verificationStatus"]): PillTone =>
    status === "approved" ? "approved"
    : status === "pending" ? "pending"
    : status === "rejected" ? "rejected"
    : "neutral";

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

  const waitingOnProviders = registeredProviders.filter(
    (provider) => provider.verificationStatus === "not_submitted" || provider.verificationStatus === "rejected"
  ).length;

  const selected =
    pendingProviders.find((provider) => provider.id === selectedId) ?? pendingProviders[0] ?? null;
  const previewUpload =
    selected?.uploads.find((upload) => upload.id === previewUploadId) ?? selected?.uploads[0] ?? null;

  const tabs: [View, string][] = [
    ["desk", "Verification desk"],
    ["providers", "Providers & accounts"],
    ["traffic", "Website traffic"],
  ];

  const filterButton = (on: boolean): CSSProperties => ({
    fontWeight: 800,
    fontSize: 13,
    padding: "9px 14px",
    minHeight: 40,
    borderRadius: 999,
    border: `1px solid ${on ? "#3f3e44" : "#d7edf0"}`,
    background: on ? "#3f3e44" : "#ffffff",
    color: on ? "#ffffff" : "#3f3e44",
  });

  return (
    <div style={{ color: "#3f3e44", background: "#f4fbfc", minHeight: "100vh" }}>
      <AdminBand
        title="Kidcellence Admin"
        subtitle={admin.email ? `${admin.name} · ${admin.email}` : admin.name}
      >
        <nav aria-label="Admin" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
          {tabs.map(([id, label]) => {
            const on = id === view;
            return (
              <button
                key={id}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => setView(id)}
                style={{ padding: "14px 18px", minHeight: 48, border: 0, borderRadius: "16px 16px 0 0", background: on ? "#f4fbfc" : "transparent", color: on ? "#2a7b86" : "#ffffff", fontWeight: 800 }}
              >
                {label}
              </button>
            );
          })}
          <Link
            href={routes.adminFeatured}
            style={{ margin: "0 0 10px auto", padding: "10px 18px", minHeight: 44, borderRadius: 999, background: "#ffcc2f", color: "#3f3e44", fontWeight: 800, display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
          >
            <Star size={18} color="#3f3e44" />
            Featured Providers
          </Link>
        </nav>
      </AdminBand>

      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px 64px", display: "flex", flexDirection: "column", gap: 24 }}>
        {dashboardError && <Notice tone="warning">{dashboardError}</Notice>}
        {actionError && <Notice tone="error">{actionError}</Notice>}
        {actionNotice && (
          <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, background: "#3f3e44", color: "#ffffff", borderRadius: 16, padding: "14px 18px" }}>
            <Icon name="check" size={20} color="#ffcc2f" strokeWidth={2.6} />
            <span style={{ flex: 1, fontWeight: 700 }}>{actionNotice}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setActionNotice("")}
              style={{ width: 40, height: 40, borderRadius: "50%", border: 0, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="x" size={14} color="#ffffff" strokeWidth={2.4} />
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 16 }}>
          <KpiCard
            label="Awaiting review"
            value={fmt(pendingProviders.length)}
            note={`${fmt(approvedProviders.length)} verified · ${fmt(rejectedCount)} rejected this session`}
          />
          <KpiCard
            label="Signups this week"
            value={fmt(stats.parentSignupsLast7Days + stats.providerSignupsLast7Days)}
            note={`${fmt(stats.parentSignupsLast7Days)} parents · ${fmt(stats.providerSignupsLast7Days)} providers · ${fmt(stats.parentSignupsToday + stats.providerSignupsToday)} today`}
          />
          <KpiCard
            label="Site visits, 7 days"
            value={fmt(platformAnalytics.last7DaysVisitors)}
            note={`${fmt(platformAnalytics.last7DaysPageViews)} page views · ${fmt(platformAnalytics.todayVisitors)} visitors today`}
          />
          <KpiCard
            label="Registered providers"
            value={fmt(stats.registeredProviders)}
            note={`${fmt(stats.totalProviders)} visible listings · ${fmt(stats.totalParents)} parents`}
          />
          <KpiCard warm label="Waiting on providers" value={fmt(waitingOnProviders)}>
            <button
              type="button"
              onClick={() => setView("providers")}
              style={{ ...linkButton, alignSelf: "flex-start", fontSize: 13, padding: 0, minHeight: 32 }}
            >
              Review accounts
            </button>
          </KpiCard>
        </div>

        {/* VERIFICATION DESK */}
        {view === "desk" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
            <section style={{ ...panelStyle, flex: "999 1 620px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Verification queue</h2>
                <div role="group" aria-label="Filter queue" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" aria-pressed={queueFilter === "pending"} onClick={() => setQueueFilter("pending")} style={filterButton(queueFilter === "pending")}>
                    Pending ({pendingProviders.length})
                  </button>
                  <button type="button" aria-pressed={queueFilter === "approved"} onClick={() => setQueueFilter("approved")} style={filterButton(queueFilter === "approved")}>
                    Approved ({approvedProviders.length})
                  </button>
                </div>
              </div>

              {queueFilter === "pending" ? (
                dashboardLoading ? (
                  <p style={{ margin: "24px 0", textAlign: "center", color: "#686973" }}>Loading verification queue...</p>
                ) : pendingProviders.length === 0 ? (
                  <p style={{ margin: "24px 0", textAlign: "center", color: "#686973" }}>
                    No pending verification submissions. All verifications reviewed.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="kc-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                      <thead>
                        <tr>
                          <th scope="col">Provider</th>
                          <th scope="col">Category</th>
                          <th scope="col">Submitted</th>
                          <th scope="col">Files</th>
                          <th scope="col">Fee</th>
                          <th scope="col"><span className="kc-sr-only">Open</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingProviders.map((provider) => {
                          const isSelected = selected?.id === provider.id;
                          return (
                            <tr key={provider.id} style={{ background: isSelected ? "#f4fbfc" : "#ffffff" }}>
                              <td>
                                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <Avatar id={provider.id} name={provider.name} />
                                  <strong>{provider.name}</strong>
                                </span>
                              </td>
                              <td>{provider.category}</td>
                              <td style={{ color: "#686973" }}>{provider.submittedDate}</td>
                              <td><strong>{provider.uploads.length}</strong></td>
                              <td>
                                <Pill tone={provider.verificationPayment?.status === "paid" ? "approved" : "warning"}>
                                  {provider.verificationPayment?.status === "paid" ? "Paid" : "Unpaid"}
                                </Pill>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedId(provider.id);
                                    setPreviewUploadId(null);
                                  }}
                                  style={linkButton}
                                >
                                  {isSelected ? "Open" : "Review"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", borderRadius: 14, border: "1px solid #d7edf0", background: "#ffffff", maxWidth: 320 }}>
                    <Icon name="search" size={18} color="#686973" />
                    <span className="kc-sr-only">Search approved providers</span>
                    <input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ border: 0, outline: 0, background: "transparent", minHeight: 44, flex: 1, minWidth: 0, fontSize: 14, color: "#3f3e44" }}
                    />
                  </label>
                  {filteredApprovedProviders.length === 0 ? (
                    <p style={{ margin: "24px 0", textAlign: "center", color: "#686973" }}>
                      No approved providers yet. Providers will appear here after documents are submitted and approved.
                    </p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="kc-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                        <thead>
                          <tr>
                            <th scope="col">Provider</th>
                            <th scope="col">Category</th>
                            <th scope="col">Approved date</th>
                            <th scope="col">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredApprovedProviders.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <Avatar id={p.id} name={p.name} />
                                  <strong>{p.name}</strong>
                                </span>
                              </td>
                              <td>{p.category}</td>
                              <td style={{ color: "#686973" }}>{p.date}</td>
                              <td><Pill tone="approved">Verified</Pill></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>

            {queueFilter === "pending" && (
              <aside
                aria-label="Selected submission"
                style={{ flex: "1 1 380px", minWidth: 0, background: "#ffffff", borderRadius: 24, padding: 24, boxShadow: "0 14px 40px rgba(42,123,134,.14)", border: "2px solid #54b2bf", display: "flex", flexDirection: "column", gap: 16 }}
              >
                {selected ? (
                  <>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Avatar id={selected.id} name={selected.name} size={52} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{selected.name}</h2>
                        <span style={{ fontSize: 14, color: "#686973" }}>
                          {selected.category} · {selected.location}
                        </span>
                      </div>
                      <Pill tone="pending">Pending</Pill>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: "#686973" }}>Submitted {selected.submittedDate}</p>

                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <Pill tone={selected.verificationPayment?.status === "paid" ? "approved" : "warning"}>
                        {selected.verificationPayment?.status === "paid"
                          ? `Verification fee paid${
                              selected.verificationPayment.amount
                                ? ` · P ${selected.verificationPayment.amount}`
                                : ""
                            }${selected.verificationPayment.packageName ? ` · ${selected.verificationPayment.packageName}` : ""}`
                          : "Verification fee unpaid"}
                      </Pill>
                      {selected.verificationPayment?.reference && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#686973", wordBreak: "break-all" }}>
                          {selected.verificationPayment.reference}
                        </span>
                      )}
                    </div>

                    {previewUpload && (
                      <div style={{ minHeight: 170, borderRadius: 18, background: "#f4fbfc", border: "1px solid #d7edf0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#686973", fontSize: 14, fontWeight: 700, textAlign: "center", padding: 12, overflow: "hidden" }}>
                        {previewUpload.contentType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin-only upload served by our own API route
                          <img src={previewUpload.url} alt={previewUpload.label} style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 12, objectFit: "contain" }} />
                        ) : (
                          <Icon name="file" size={34} color="#2a7b86" strokeWidth={1.8} />
                        )}
                        <span style={{ color: "#3f3e44" }}>{previewUpload.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, wordBreak: "break-all" }}>{previewUpload.fileName}</span>
                        <a href={previewUpload.url} target="_blank" rel="noreferrer" style={{ fontWeight: 800, color: "#2a7b86" }}>
                          Open in new tab
                        </a>
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selected.uploads.length === 0 ? (
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#c2412a" }}>No reviewable files found</p>
                      ) : (
                        selected.uploads.map((upload) => (
                          <div
                            key={upload.id}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 6px 6px 12px", borderRadius: 14, background: previewUpload?.id === upload.id ? "#fff5d3" : "#f4fbfc" }}
                          >
                            <Icon name="file" size={18} color="#2a7b86" />
                            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{upload.label}</span>
                            <button type="button" onClick={() => setPreviewUploadId(upload.id)} style={{ ...linkButton, fontSize: 13, minHeight: 36 }}>
                              View
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => decide(selected, "approve")}
                        style={{ flex: "1 1 140px", fontWeight: 800, fontSize: 15, padding: 14, minHeight: 48, borderRadius: 14, border: 0, background: actionBusy ? "#9fb9bd" : "#2a7b86", color: "#ffffff" }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => decide(selected, "reject")}
                        style={{ flex: "1 1 140px", fontWeight: 800, fontSize: 15, padding: 14, minHeight: 48, borderRadius: 14, border: "2px solid #3f3e44", background: "#ffffff", color: "#3f3e44" }}
                      >
                        Reject
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 12px", color: "#686973", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                    <Icon name="shieldCheck" size={40} color="#54b2bf" strokeWidth={1.8} />
                    <strong style={{ color: "#3f3e44", fontSize: 17 }}>{dashboardLoading ? "Loading…" : "Queue clear"}</strong>
                    {!dashboardLoading && <span>New submissions appear here automatically.</span>}
                  </div>
                )}
              </aside>
            )}
          </div>
        )}

        {/* PROVIDERS & ACCOUNTS */}
        {view === "providers" && (
          <section style={panelStyle}>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
                Registered providers ({registeredProviders.length})
              </h2>
              <p style={{ margin: "4px 0 0", color: "#686973", fontSize: 14 }}>
                Removing an account deletes its listing, uploads and conversations. It cannot be undone, so Remove asks you to confirm.
              </p>
            </div>
            {dashboardLoading ? (
              <p style={{ margin: "24px 0", textAlign: "center", color: "#686973" }}>Loading registered providers...</p>
            ) : registeredProviders.length === 0 ? (
              <p style={{ margin: "24px 0", textAlign: "center", color: "#686973" }}>
                No registered providers yet. Provider accounts will appear here after signup.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="kc-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Category</th>
                      <th scope="col">Status</th>
                      <th scope="col">Payment</th>
                      <th scope="col">Files</th>
                      <th scope="col">Listing</th>
                      <th scope="col"><span className="kc-sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
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
                        <tr key={provider.userId} style={{ verticalAlign: "top" }}>
                          <td style={{ maxWidth: 340 }}>
                            <span style={{ display: "flex", gap: 10 }}>
                              <Avatar id={provider.userId} name={provider.name} />
                              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                <strong>{provider.name}</strong>
                                <span style={{ color: "#686973", fontSize: 13, wordBreak: "break-all" }}>{provider.email}</span>
                                <span style={{ color: "#686973", fontSize: 13 }}>{provider.location}</span>
                                {needsProviderAction && blockers.length > 0 && (
                                  <span style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: "#3f3e44", background: "#fff5d3", borderRadius: 10, padding: "6px 8px" }}>
                                    <strong>Still waiting on the provider.</strong> Missing: {blockers.slice(0, 8).join(", ")}
                                    {blockers.length > 8 ? `, and ${blockers.length - 8} more` : ""}.
                                  </span>
                                )}
                              </span>
                            </span>
                          </td>
                          <td>{provider.category}</td>
                          <td><Pill tone={statusTone(provider.verificationStatus)}>{statusLabel(provider)}</Pill></td>
                          <td>
                            <Pill tone={provider.verificationPayment.status === "paid" ? "approved" : "warning"}>
                              {provider.verificationPayment.status === "paid" ? "Payment paid" : "Payment unpaid"}
                            </Pill>
                          </td>
                          <td style={{ minWidth: 160 }}>
                            <span style={{ display: "block", fontSize: 13, color: "#686973", marginBottom: provider.uploads.length ? 6 : 0 }}>
                              {provider.documentCount} document{provider.documentCount === 1 ? "" : "s"} · {provider.imageCount} image{provider.imageCount === 1 ? "" : "s"}
                            </span>
                            {provider.uploads.length > 0 && (
                              <details>
                                <summary style={{ color: "#2a7b86", fontWeight: 800, fontSize: 13 }}>Show files</summary>
                                <div style={{ marginTop: 8 }}>
                                  <UploadLinks uploads={provider.uploads} />
                                </div>
                              </details>
                            )}
                          </td>
                          <td>
                            <Pill tone={provider.published ? "pending" : "neutral"}>
                              {provider.published ? "Published listing" : "Draft listing"}
                            </Pill>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeProvider(provider)}
                              style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 13, padding: "9px 14px", minHeight: 40, borderRadius: 12, border: 0, background: "#c2412a", color: "#ffffff", whiteSpace: "nowrap" }}
                            >
                              <Icon name="trash" size={16} color="#ffffff" strokeWidth={2.2} />
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* WEBSITE TRAFFIC */}
        {view === "traffic" && (
          <section style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Website traffic</h2>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <Pill tone="approved">Live</Pill>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#686973" }}>
                  {lastDashboardRefreshAt
                    ? `Updated ${lastDashboardRefreshAt.toLocaleTimeString()}`
                    : "Updates every 5 seconds"}
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12 }}>
              {[
                { label: "Total visitors", value: platformAnalytics.totalVisitors },
                { label: "Total page views", value: platformAnalytics.totalPageViews },
                { label: "Visitors today", value: platformAnalytics.todayVisitors },
                { label: "Page views today", value: platformAnalytics.todayPageViews },
              ].map((stat) => (
                <div key={stat.label} style={{ background: "#f4fbfc", border: "1px solid #d7edf0", borderRadius: 18, padding: 16 }}>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>{fmt(stat.value)}</div>
                  <div style={{ fontSize: 14, color: "#686973" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16 }}>
              <div style={{ border: "1px solid #d7edf0", borderRadius: 18, padding: 16, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Last 28 days</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#686973" }}>
                      {fmt(platformAnalytics.last28DaysVisitors)} visitors · {fmt(platformAnalytics.last28DaysPageViews)} page views
                    </p>
                  </div>
                  {pageViewChange !== null && (
                    <Pill tone={pageViewChange >= 0 ? "pending" : "warning"}>
                      {pageViewChange >= 0 ? "+" : ""}{pageViewChange}%
                    </Pill>
                  )}
                </div>
                <div style={{ marginTop: 16, display: "flex", height: 112, alignItems: "flex-end", gap: 4 }}>
                  {platformAnalytics.daily.length === 0 ? (
                    <div style={{ display: "flex", height: "100%", width: "100%", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "#f4fbfc", fontSize: 14, fontWeight: 700, color: "#686973" }}>
                      No traffic recorded yet
                    </div>
                  ) : (
                    platformAnalytics.daily.map((day) => (
                      <div
                        key={day.date}
                        title={`${day.date}: ${day.pageViews} page views, ${day.visitors} visitors`}
                        style={{ minWidth: 0, flex: 1, borderRadius: "4px 4px 0 0", background: "#54b2bf", height: `${Math.max(8, (day.pageViews / maxDailyPageViews) * 100)}%` }}
                      />
                    ))
                  )}
                </div>
              </div>

              <div style={{ border: "1px solid #d7edf0", borderRadius: 18, padding: 16, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Top pages</p>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {platformAnalytics.topPages.length === 0 ? (
                    <p style={{ margin: 0, borderRadius: 12, background: "#f4fbfc", padding: "16px 12px", fontSize: 14, fontWeight: 700, color: "#686973" }}>
                      No pages viewed yet.
                    </p>
                  ) : (
                    platformAnalytics.topPages.map((page) => (
                      <div key={page.path} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 12, background: "#f4fbfc", padding: "8px 12px" }}>
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontWeight: 700 }}>{page.path}</span>
                        <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 800, color: "#2a7b86" }}>{fmt(page.pageViews)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
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
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#686973", background: "#f4fbfc" }}>
        Checking admin session...
      </div>
    );
  }

  if (user?.role === "admin") return <AdminDashboard />;

  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 16px", background: "#f4fbfc" }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#ffffff", borderRadius: 24, padding: 32, boxShadow: "0 14px 40px rgba(42,123,134,.14)", border: "1px solid #d7edf0", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(120deg, #54b2bf 0%, #2a7b86 100%)" }}>
          <Icon name="shieldCheck" size={32} color="#ffffff" strokeWidth={2} />
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800 }}>Admin Access</h1>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#686973", lineHeight: 1.5 }}>
          Sign in with an allowed admin email. First sign-in creates your admin password.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void login();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}
        >
          <label>
            <span className="kc-label">Email</span>
            <input
              className="kc-input"
              type="email"
              autoComplete="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span className="kc-label">Password</span>
            <input
              className="kc-input"
              type="password"
              autoComplete="current-password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <Notice tone="error">{error}</Notice>}
          <button type="submit" className="kc-btn" style={{ width: "100%", borderRadius: 14, minHeight: 48 }}>
            Login
          </button>
        </form>
        <p style={{ margin: "16px 0 0", fontSize: 12, color: "#686973" }}>
          Admin emails must be built in or listed in ADMIN_EMAILS.
        </p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#686973" }}>Loading...</div>}>
      <AdminGate />
    </Suspense>
  );
}
