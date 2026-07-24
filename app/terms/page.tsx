import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { TrustPage } from "@/components/TrustPage";

export const metadata: Metadata = {
  title: "Terms | Kidcellence",
  description: "Terms for using the Kidcellence childcare marketplace.",
};

export default function TermsPage() {
  return (
    <TrustPage
      eyebrow="Terms of service"
      title="Clear responsibilities build a trusted marketplace."
      introduction="These terms govern access to Kidcellence. By creating an account or using the marketplace, you agree to use it lawfully, honestly, and with the safety of children and families in mind."
      updated="27 June 2026"
      icon={<ScrollText className="h-5 w-5" />}
      sections={[
        {
          title: "Using Kidcellence",
          body: "Kidcellence provides tools for discovering, comparing, contacting, and reviewing childcare-related providers. Account creation, listing publication, enquiries, messages, promotions, and payments must be used only for lawful childcare, education, health, family support, or child-focused service purposes.",
        },
        {
          title: "Accounts",
          body: "Users must provide accurate information, keep credentials secure, and use the correct account role. You are responsible for activity under your account and should report suspected unauthorised access promptly.",
        },
        {
          title: "Provider listings",
          body: "Providers are responsible for the accuracy, legality, and currency of their listings, prices, qualifications, availability, documents, and contact information. Publishing a listing does not create an endorsement by Kidcellence.",
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
          body: "Verification is based on information available during review and may be suspended or removed. Users must continue their own due diligence and notify Kidcellence when material listing or document information changes.",
        },
        {
          title: "Signup and payment terms",
          body: "By creating an account, publishing a listing, submitting an enquiry, buying a paid promotion, or making a payment through Kidcellence, you agree to the terms shown in the relevant signup, listing, promotion, or checkout flow. Fees, billing periods, cancellation rules, refunds, renewal dates, and promotion placement are confirmed before payment where payment is supported. Any childcare arrangement should be confirmed directly between the family and provider before services begin.",
        },
        {
          title: "Enforcement and changes",
          body: "Kidcellence may restrict or remove accounts, listings, messages, or content that create safety, legal, integrity, or operational risk. Terms may be updated as the service evolves; material revisions will carry a new update date.",
        },
      ]}
    />
  );
}
