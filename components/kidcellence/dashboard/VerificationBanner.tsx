import Link from "next/link";
import { Icon } from "@/components/kidcellence/Icon";

export type VerificationStatus = "not_submitted" | "pending" | "approved" | "rejected";

const STEPS = ["Listing", "Documents", "Payment", "Review", "Verified"] as const;

type Tone = "teal" | "gold" | "cream" | "dark";
const TONES: Record<Tone, { bg: string; fg: string; ctaBg: string; ctaFg: string; dark: boolean }> = {
  teal: { bg: "#54b2bf", fg: "#3f3e44", ctaBg: "#3f3e44", ctaFg: "#ffffff", dark: false },
  gold: { bg: "#ffcc2f", fg: "#3f3e44", ctaBg: "#3f3e44", ctaFg: "#ffffff", dark: false },
  cream: { bg: "#fff5d3", fg: "#3f3e44", ctaBg: "#c2412a", ctaFg: "#ffffff", dark: false },
  dark: { bg: "#2a7b86", fg: "#ffffff", ctaBg: "#ffffff", ctaFg: "#2a7b86", dark: true },
};

type Stage = {
  at: number;
  eyebrow: string;
  title: string;
  body: string;
  tone: Tone;
  cta?: { label: string; onClick?: () => void; href?: string };
};

/**
 * Maps the real verification state onto the design's five-step tracker
 * (ProviderOverviewScreen). Nothing here is sample data: every value comes
 * from the provider profile, uploads and requirement checks the page loads.
 */
export function verificationStage(input: {
  status: VerificationStatus;
  verified: boolean;
  missingProfileFields: string[];
  missingDocumentCount: number;
  documentCount: number;
  paid: boolean;
  publicListingHref?: string;
  goTo: (tab: "basic" | "documents") => void;
}): Stage {
  const { status, verified, missingProfileFields, missingDocumentCount, documentCount, paid, publicListingHref, goTo } = input;
  if (status === "approved" || verified) {
    return {
      at: 5,
      eyebrow: "VERIFIED",
      title: "Your Verified badge is live",
      body: "Parents see the Verified badge on your listing and in search results, and can filter for verified providers.",
      tone: "dark",
      cta: publicListingHref ? { label: "View my listing", href: publicListingHref } : undefined,
    };
  }
  if (status === "pending") {
    return {
      at: 3,
      eyebrow: "IN REVIEW",
      title: "Your documents are with our reviewers",
      body: "An administrator is reviewing your submitted documents. Your Verified badge appears as soon as they approve.",
      tone: "gold",
    };
  }
  if (status === "rejected") {
    return {
      at: 3,
      eyebrow: "ACTION NEEDED",
      title: "Updates required",
      body: "Update your documents, then submit them for another review.",
      tone: "cream",
      cta: { label: "Update documents", onClick: () => goTo("documents") },
    };
  }
  if (missingProfileFields.length > 0) {
    const shown = missingProfileFields.slice(0, 3).join(", ");
    const more = missingProfileFields.length > 3 ? ` and ${missingProfileFields.length - 3} more` : "";
    return {
      at: 0,
      eyebrow: "STEP 1 OF 5",
      title: "Complete your listing details",
      body: `Still needed for verification: ${shown}${more}.`,
      tone: "teal",
      cta: { label: "Complete details", onClick: () => goTo("basic") },
    };
  }
  if (missingDocumentCount > 0) {
    const uploaded = documentCount - missingDocumentCount;
    return {
      at: 1,
      eyebrow: "STEP 2 OF 5",
      title: `Upload ${missingDocumentCount} more document${missingDocumentCount === 1 ? "" : "s"}`,
      body: `${uploaded} of ${documentCount} required documents uploaded. Once all are in, submit them for admin review.`,
      tone: "teal",
      cta: { label: "Upload documents", onClick: () => goTo("documents") },
    };
  }
  if (!paid) {
    return {
      at: 2,
      eyebrow: "STEP 3 OF 5",
      title: "Pay the verification fee",
      body: "Payment is only needed after the free full-access month ends. Then submit for admin review.",
      tone: "teal",
      cta: { label: "Go to payment", onClick: () => goTo("documents") },
    };
  }
  return {
    at: 3,
    eyebrow: "STEP 4 OF 5",
    title: "Ready to submit for review",
    body: "All required details and documents are uploaded. Submit when ready; an admin reviews them before your badge goes live.",
    tone: "teal",
    cta: { label: "Submit for review", onClick: () => goTo("documents") },
  };
}

export function VerificationBanner({ stage }: { stage: Stage }) {
  const tone = TONES[stage.tone];
  const ctaStyle = { display: "flex", alignItems: "center", minHeight: 48, padding: "12px 22px", borderRadius: 14, background: tone.ctaBg, color: tone.ctaFg, textDecoration: "none", fontWeight: 800, border: 0, fontSize: 15 } as const;
  return (
    <section aria-labelledby="kc-verification-title" style={{ padding: 28, borderRadius: 24, background: tone.bg, color: tone.fg, display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", maxWidth: 760, minWidth: 0 }}>
          <span style={{ width: 56, height: 56, borderRadius: "50%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            <Icon name="shieldCheck" size={28} color="#2a7b86" />
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <span style={{ alignSelf: "flex-start", background: "rgba(255,255,255,.85)", color: "#3f3e44", fontSize: 12, fontWeight: 800, letterSpacing: ".4px", padding: "5px 10px", borderRadius: 999 }}>{stage.eyebrow}</span>
            <h2 id="kc-verification-title" style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{stage.title}</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{stage.body}</p>
          </div>
        </div>
        {stage.cta?.href && <Link href={stage.cta.href} style={ctaStyle}>{stage.cta.label}</Link>}
        {stage.cta?.onClick && <button type="button" onClick={stage.cta.onClick} style={ctaStyle}>{stage.cta.label}</button>}
      </div>
      <ol aria-label="Verification steps" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100px, 100%), 1fr))", gap: 8 }}>
        {STEPS.map((label, i) => {
          const done = i < stage.at;
          const current = i === stage.at;
          const bar = done
            ? tone.dark ? "#ffffff" : "#3f3e44"
            : current
              ? tone.dark ? "#54b2bf" : "rgba(63,62,68,0.45)"
              : tone.dark ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.6)";
          return (
            <li key={label} aria-current={current ? "step" : undefined} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span aria-hidden="true" style={{ height: 8, borderRadius: 999, background: bar }} />
              <span style={{ fontSize: 14, fontWeight: current ? 800 : 600 }}>
                {label}
                <span className="kc-sr-only">{done ? " (done)" : current ? " (current)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
