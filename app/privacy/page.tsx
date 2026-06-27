import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { TrustPage } from "@/components/TrustPage";

export const metadata: Metadata = {
  title: "Privacy | Kidcexcellence",
  description: "Kidcexcellence privacy information for families and childcare providers.",
};

export default function PrivacyPage() {
  return (
    <TrustPage
      eyebrow="Privacy"
      title="Your information should serve a clear purpose."
      introduction="This notice explains the information Kidcexcellence handles, why it is used, and the choices available to families, providers, and administrators."
      updated="27 June 2026"
      icon={<LockKeyhole className="h-5 w-5" />}
      sections={[
        {
          title: "Information collected",
          items: [
            "Account details such as name, email, phone number, role, and location.",
            "Parent profile details that a parent chooses to add, including child names, dates of birth, and support notes.",
            "Provider listing details, pricing, availability, verification documents, and gallery uploads.",
            "Messages, session records, and technical request information needed to operate and protect the service.",
          ],
        },
        {
          title: "How information is used",
          body: "Information is used to authenticate accounts, save profiles, publish provider listings, support comparison and messaging, review provider submissions, prevent abuse, and maintain the service.",
        },
        {
          title: "Visibility and sharing",
          body: "Published provider listing information is visible to marketplace visitors. Sensitive provider documents remain restricted to the provider and authorised administrative review. Parent profiles are not public. Kidcexcellence does not sell personal information.",
        },
        {
          title: "Cookies and sessions",
          body: "Kidcexcellence uses an HTTP-only session cookie to keep signed-in accounts authenticated. The current platform does not use advertising cookies.",
        },
        {
          title: "Retention and choices",
          body: "Information is retained while needed to provide the platform, meet safety or legal obligations, and resolve disputes. Users can update profile information, unpublish provider listings, remove uploads, sign out active sessions, and request account support through the help centre.",
        },
        {
          title: "Security",
          body: "Kidcexcellence applies password hashing, restricted sessions, access checks, rate limits, same-origin write protection, and role-based administrative controls. No online service can promise absolute security, so users should use a unique password and protect access to their email account.",
        },
      ]}
    />
  );
}
