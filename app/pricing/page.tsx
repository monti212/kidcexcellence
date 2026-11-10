import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/components/kidcellence/Icon";

export const metadata: Metadata = {
  title: "Pricing | Kidcellence",
  description: "Kidcellence pricing for families and provider verification.",
};

const monthlySubscriptions: Array<{
  name: string;
  price: string;
  interval: string;
  note: string;
  renewal: string;
  verification: string;
  href: string;
  icon: IconName;
  iconBg: string;
  iconColor: string;
  primary: boolean;
}> = [
  {
    name: "Parents / Guardians",
    price: "P0",
    interval: "first month",
    note: "For families searching, comparing, and contacting trusted child related service providers.",
    renewal: "Then P60 monthly",
    verification: "Everything included for the first month",
    href: "/auth?role=parent",
    icon: "heart",
    iconBg: "#f4fbfc",
    iconColor: "#2a7b86",
    primary: false,
  },
  {
    name: "Nannies / Helpers / Babysitters",
    price: "P0",
    interval: "first month",
    note: "For individual care providers listing their services and managing enquiries.",
    renewal: "Then P60 monthly",
    verification: "Verification checkout waived during the free month",
    href: "/auth?role=provider&category=nannies",
    icon: "nanny",
    iconBg: "#54b2bf",
    iconColor: "#ffffff",
    primary: true,
  },
  {
    name: "Other Service Providers",
    price: "P0",
    interval: "first month",
    note: "For tutors, specialists, transport, parties, agencies, schools, and other providers.",
    renewal: "Then P150 monthly",
    verification: "Verification checkout waived during the free month",
    href: "/auth?role=provider",
    icon: "school",
    iconBg: "#3f3e44",
    iconColor: "#ffffff",
    primary: true,
  },
];

const vetWithUsPaymentPackages = [
  {
    id: "standard",
    name: "Standard Package",
    price: 795,
    summary: "Core nanny/helper vetting for everyday household placements.",
    features: ["Traceable nanny/helper", "Thorough vetting", "Personalized matching"],
  },
  {
    id: "vip",
    name: "VIP Package",
    price: 995,
    summary: "Priority vetting for families with sensitive household information.",
    features: ["Everything in Standard", "NDA support", "Priority handling"],
  },
];

function getVetWithUsPaymentHref(packageId: string) {
  return `/api/verifications/payment?packageId=${encodeURIComponent(packageId)}`;
}

const card: CSSProperties = { background: "#ffffff", borderRadius: 28, padding: 32, display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 14px 40px rgba(63,62,68,.08)", minWidth: 0 };
const outlineBtn: CSSProperties = { marginTop: "auto", textAlign: "center", padding: 15, borderRadius: 16, border: "2px solid #2a7b86", color: "#2a7b86", fontWeight: 800, textDecoration: "none" };
const solidBtn: CSSProperties = { marginTop: "auto", textAlign: "center", padding: 15, borderRadius: 16, background: "#2a7b86", color: "#ffffff", fontWeight: 800, textDecoration: "none" };

function Checklist({ items, color = "#2a7b86" }: { items: string[]; color?: string }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, fontSize: 15 }}>
      {items.map((item) => (
        <li key={item} style={{ display: "flex", gap: 10 }}>
          <Icon name="check" size={20} color={color} strokeWidth={2.4} style={{ flexShrink: 0 }} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details style={{ background: "#ffffff", borderRadius: 20, padding: "20px 24px" }}>
      <summary style={{ fontWeight: 800, fontSize: 17 }}>{q}</summary>
      <p style={{ margin: "12px 0 0", color: "#686973", lineHeight: 1.6 }}>{children}</p>
    </details>
  );
}

export default function PricingPage() {
  return (
    <div style={{ color: "#3f3e44", background: "#fff5d3" }}>
      <div className="mx-auto flex max-w-[1280px] flex-col gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-[72px]">
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <span style={{ background: "#ffffff", padding: "8px 14px", borderRadius: 999, fontWeight: 800, fontSize: 14, color: "#2a7b86" }}>
            Pricing
          </span>
          <h1 className="text-[40px] sm:text-[56px]" style={{ margin: 0, fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1.05, maxWidth: 800 }}>
            Full access is free for your first month.
          </h1>
          <p style={{ margin: 0, fontSize: 18, color: "#686973", maxWidth: 640, lineHeight: 1.6 }}>
            Parents and providers can use every Kidcellence feature for one month
            before any subscription payment is needed. Provider verification
            checkout is also waived while the free month is active.
          </p>
        </div>

        <section aria-labelledby="plans-heading" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
            <h2 id="plans-heading" style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>
              Choose the account that matches your role.
            </h2>
            <p style={{ margin: 0, maxWidth: 380, fontSize: 15, lineHeight: 1.6, color: "#686973" }}>
              Full access starts immediately. Monthly pricing begins after the free month.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 24 }}>
            {monthlySubscriptions.map((plan) => (
              <article key={plan.name} style={card}>
                <span style={{ width: 60, height: 60, borderRadius: "50%", background: plan.iconBg, display: "flex", alignItems: "center", justifyContent: "center", ...(plan.iconBg === "#f4fbfc" ? { border: "1px solid #d7edf0" } : {}) }}>
                  <Icon name={plan.icon} size={30} color={plan.iconColor} strokeWidth={1.8} />
                </span>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{plan.name}</h3>
                <p style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-1.5px" }}>{plan.price}</span>
                  <span style={{ color: "#686973" }}>{plan.interval}</span>
                </p>
                <p style={{ margin: 0, fontWeight: 700, color: "#2a7b86" }}>{plan.renewal}</p>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#686973" }}>{plan.note}</p>
                <Checklist items={[plan.verification]} />
                <Link href={plan.href} style={plan.primary ? solidBtn : outlineBtn}>
                  Start free month
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* Vet With Us */}
        <section
          aria-labelledby="vetting-heading"
          className="p-6 sm:p-12"
          style={{ background: "#ffffff", borderRadius: 32, display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}
        >
          <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ alignSelf: "flex-start", background: "#fff5d3", color: "#c2412a", fontWeight: 800, fontSize: 13, padding: "6px 12px", borderRadius: 999 }}>
              VET WITH US
            </span>
            <h2 id="vetting-heading" className="text-[28px] sm:text-[36px]" style={{ margin: 0, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.1 }}>
              Choose a managed vetting option.
            </h2>
            <p style={{ margin: 0, color: "#686973", fontSize: 16, lineHeight: 1.6 }}>
              View the package details, then continue to the payment gateway.
            </p>
          </div>
          <div style={{ flex: "1 1 520px", minWidth: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 16 }}>
            {vetWithUsPaymentPackages.map((pkg) => {
              const paymentHref = getVetWithUsPaymentHref(pkg.id);
              const vip = pkg.id === "vip";
              return (
                <div
                  key={pkg.name}
                  style={{ background: vip ? "#3f3e44" : "#f4fbfc", color: vip ? "#ffffff" : "#3f3e44", borderRadius: 24, padding: 28, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{pkg.name}</h3>
                    {vip && (
                      <span style={{ background: "#ffcc2f", color: "#3f3e44", fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999 }}>Priority</span>
                    )}
                  </div>
                  <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-1px" }}>P{pkg.price}</span>
                  <p style={{ margin: 0, color: vip ? "#d7edf0" : "#686973", fontSize: 15, lineHeight: 1.5 }}>{pkg.summary}</p>
                  <Checklist items={pkg.features} color={vip ? "#ffcc2f" : "#2a7b86"} />
                  <a
                    href={paymentHref}
                    target="_blank"
                    rel="noreferrer"
                    style={vip
                      ? { marginTop: "auto", textAlign: "center", padding: 14, borderRadius: 14, background: "#ffcc2f", color: "#3f3e44", fontWeight: 800, textDecoration: "none" }
                      : { marginTop: "auto", textAlign: "center", padding: 14, borderRadius: 14, border: "2px solid #2a7b86", color: "#2a7b86", fontWeight: 800, textDecoration: "none", background: "#ffffff" }}
                  >
                    Pay P{pkg.price}
                  </a>
                </div>
              );
            })}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820, width: "100%", margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 800, textAlign: "center" }}>Questions</h2>
          <Faq q="Can one account be both a parent and a provider?">
            Yes. You can switch between your parent and provider account types in Settings.
          </Faq>
          <Faq q="What does verification need?">
            Each category has its own checklist. A nanny uploads a certified ID, CV, proof of residence and police clearance.
          </Faq>
          <Faq q="What happens after the free month?">
            Monthly pricing begins after the free month: P60 a month for parents and for nannies, helpers and babysitters, and P150 a month for other service providers.
          </Faq>
        </section>
      </div>
    </div>
  );
}
