import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { TrustPage } from "@/components/TrustPage";

export const metadata: Metadata = {
  title: "Safety | Kidcexcellence",
  description: "How Kidcexcellence approaches provider verification and safer childcare decisions.",
};

export default function SafetyPage() {
  return (
    <TrustPage
      eyebrow="Trust and safety"
      title="Make every care decision carefully."
      introduction="Kidcexcellence helps families compare information and identify reviewed providers. Verification supports due diligence; it never replaces a family's own interviews, reference checks, visits, and judgement."
      icon={<ShieldCheck className="h-5 w-5" />}
      sections={[
        {
          title: "Verified badge",
          body: "A verified badge means the provider information or documents submitted through Kidcexcellence have been reviewed and approved in the platform workflow. It is not a guarantee of future conduct, service quality, availability, licensing status, or suitability for a particular child.",
        },
        {
          title: "Before choosing care",
          items: [
            "Meet the provider in person and visit the care setting before making a commitment.",
            "Confirm identity, qualifications, licences, references, fees, schedules, and cancellation terms directly.",
            "Ask about supervision ratios, safeguarding practices, emergency procedures, transport, medication, and incident reporting.",
            "Discuss allergies, accessibility requirements, routines, and any additional support your child needs.",
          ],
        },
        {
          title: "For providers",
          items: [
            "Keep listing details, pricing, availability, contact information, and documents current.",
            "Only publish claims and qualifications that can be supported with accurate evidence.",
            "Protect family and child information and use it only for the agreed care enquiry.",
            "Respond promptly to safety concerns and comply with applicable Botswana requirements.",
          ],
        },
        {
          title: "Urgent concerns",
          body: "For immediate danger or suspected harm, contact Botswana emergency services or the appropriate local authority first. Preserve relevant messages and records. Platform account or listing concerns can then be documented through the help centre.",
        },
      ]}
    />
  );
}
