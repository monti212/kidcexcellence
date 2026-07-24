export const VERIFICATION_FEE = {
  amount: 250,
  currency: "BWP",
};

export interface VerificationDocumentRequirement {
  key: string;
  label: string;
  hint: string;
  sensitive?: boolean;
}

const INDIVIDUAL_CATEGORIES = new Set(["nannies", "babysitters", "tutors"]);

export function getVerificationProviderType(category: string) {
  return INDIVIDUAL_CATEGORIES.has(category) ? "individual" : "organisation";
}

export function getVerificationDocuments(category: string): VerificationDocumentRequirement[] {
  if (getVerificationProviderType(category) === "individual") {
    return [
      {
        key: "national-id",
        label: "National ID / Passport",
        hint: "High-res scan of a valid identity document",
        sensitive: true,
      },
      {
        key: "cv",
        label: "CV / Resume",
        hint: "PDF or Word document showing care experience",
      },
      {
        key: "affidavit",
        label: "Affidavit",
        hint: "Signed affidavit or declaration supporting your application",
      },
      {
        key: "police-clearance",
        label: "Police clearance / fingerprints",
        hint: "Police clearance or fingerprint receipt where applicable",
        sensitive: true,
      },
    ];
  }

  return [
    {
      key: "registration-certificate",
      label: "Registration certificate",
      hint: "Business, school, clinic, or organisation registration certificate",
    },
    {
      key: "operating-documentation",
      label: "Relevant operating documentation",
      hint: "Licence, accreditation, permit, prospectus, or supporting operating document",
    },
    {
      key: "representative-id",
      label: "Representative ID",
      hint: "Valid ID for the owner, principal, director, or authorised representative",
      sensitive: true,
    },
  ];
}

export function missingVerificationDocuments(category: string, uploadedKeys: string[]) {
  const uploaded = new Set(uploadedKeys);
  return getVerificationDocuments(category).filter((document) => !uploaded.has(document.key));
}
