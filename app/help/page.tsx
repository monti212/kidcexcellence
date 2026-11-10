import type { Metadata } from "next";
import Link from "next/link";
import { CircleHelp, KeyRound, MessagesSquare, Store, UserRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Help Centre | Kidcellence",
  description: "Account, provider listing, messaging, and safety help for Kidcellence.",
};

const helpTopics = [
  {
    title: "Account access",
    body: "Create a parent or provider account, sign in, verify your email, or reset your password.",
    href: "/auth",
    label: "Open account access",
    icon: KeyRound,
  },
  {
    title: "Parent profile",
    body: "Keep child information in your private family workspace and update it when your needs change.",
    href: "/profile/parent",
    label: "Open parent profile",
    icon: UserRound,
  },
  {
    title: "Provider listing",
    body: "Complete public details, pricing, documents, and gallery content before publishing your listing.",
    href: "/profile/provider",
    label: "Open provider workspace",
    icon: Store,
  },
  {
    title: "Messages",
    body: "Continue provider enquiries and review existing conversations from your signed-in workspace.",
    href: "/messages",
    label: "Open messages",
    icon: MessagesSquare,
  },
];

export default function HelpPage() {
  return (
    <div style={{ background: "#ffffff", color: "#3f3e44" }}>
      <section style={{ background: "#f4fbfc" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 16px 56px", display: "flex", flexDirection: "column", gap: 14 }}>
          <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: "50%", background: "#54b2bf", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircleHelp className="h-6 w-6" />
          </span>
          <span style={{ alignSelf: "flex-start", background: "#fff5d3", fontWeight: 800, fontSize: 13, padding: "6px 12px", borderRadius: 999, letterSpacing: ".4px", textTransform: "uppercase" }}>
            Help centre
          </span>
          <h1 style={{ margin: 0, fontSize: "clamp(34px, 6vw, 52px)", lineHeight: 1.08, fontWeight: 800, letterSpacing: "-1.5px" }}>
            Find the right next step.
          </h1>
          <p style={{ margin: 0, maxWidth: 640, fontSize: 18, lineHeight: 1.6, color: "#686973" }}>
            Access account, profile, listing, messaging, and safety support from one place.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 16px 80px", display: "flex", flexDirection: "column", gap: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 20 }}>
          {helpTopics.map(({ title, body, href, label, icon: Icon }, index) => (
            <section key={title} className="kc-panel" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: "50%", background: index % 2 ? "#fff5d3" : "#f4fbfc", color: "#2a7b86", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon className="h-5 w-5" />
              </span>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{title}</h2>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#686973" }}>{body}</p>
              <Link href={href} style={{ marginTop: "auto", fontSize: 15, fontWeight: 800, color: "#2a7b86" }}>
                {label}
              </Link>
            </section>
          ))}
        </div>

        <section style={{ background: "#fff5d3", borderRadius: 24, padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ alignSelf: "flex-start", background: "#ffffff", color: "#c2412a", fontWeight: 800, fontSize: 12, padding: "5px 10px", borderRadius: 999, letterSpacing: ".4px" }}>SAFETY</span>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Safety concern</h2>
          <p style={{ margin: 0, maxWidth: 760, fontSize: 16, lineHeight: 1.7, color: "#686973" }}>
            For immediate danger or suspected harm, contact Botswana emergency services or the
            appropriate local authority first. For marketplace guidance, review the safety standard
            before continuing with a provider.
          </p>
          <Link href="/safety" className="kc-btn" style={{ alignSelf: "flex-start" }}>
            Review safety guidance
          </Link>
        </section>
      </div>
    </div>
  );
}
