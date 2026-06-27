import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { TrustPage } from "@/components/TrustPage";

export const metadata: Metadata = {
  title: "Terms | Kidcexcellence",
  description: "Terms for using the Kidcexcellence childcare marketplace.",
};

export default function TermsPage() {
  return (
    <TrustPage
      eyebrow="Terms of service"
      title="Clear responsibilities build a trusted marketplace."
      introduction="These terms govern access to Kidcexcellence. By creating an account or using the marketplace, you agree to use it lawfully, honestly, and with the safety of children and families in mind."
      updated="27 June 2026"
      icon={<ScrollText className="h-5 w-5" />}
      sections={[
        {
          title: "Marketplace role",
          body: "Kidcexcellence provides discovery, comparison, profile, messaging, and verification workflow tools. Kidcexcellence is not the childcare provider, employer, booking agent, insurer, regulator, or party to arrangements made between families and providers.",
        },
        {
          title: "Accounts",
          body: "Users must provide accurate information, keep credentials secure, and use the correct account role. You are responsible for activity under your account and should report suspected unauthorised access promptly.",
        },
        {
          title: "Provider listings",
          body: "Providers are responsible for the accuracy, legality, and currency of their listings, prices, qualifications, availability, documents, and contact information. Publishing a listing does not create an endorsement by Kidcexcellence.",
        },
        {
          title: "Acceptable use",
          items: [
            "Do not impersonate another person or publish false, misleading, discriminatory, or unlawful content.",
            "Do not misuse family, child, provider, document, or messaging information.",
            "Do not attempt to bypass access controls, probe the service, distribute malware, or disrupt other users.",
            "Do not use the platform for exploitation, harassment, unsafe care, or any activity that may harm a child.",
          ],
        },
        {
          title: "Verification",
          body: "Verification is based on information available during review and may be suspended or removed. Users must continue their own due diligence and notify Kidcexcellence when material listing or document information changes.",
        },
        {
          title: "Availability and liability",
          body: "The platform is provided on an as-available basis. To the extent permitted by applicable law, Kidcexcellence is not responsible for independent provider conduct, family decisions, offline arrangements, or losses caused by inaccurate user-supplied information.",
        },
        {
          title: "Enforcement and changes",
          body: "Kidcexcellence may restrict or remove accounts, listings, messages, or content that create safety, legal, integrity, or operational risk. Terms may be updated as the service evolves; material revisions will carry a new update date.",
        },
      ]}
    />
  );
}
