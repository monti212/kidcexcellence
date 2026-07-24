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

const INDIVIDUAL_CATEGORIES = new Set(["nannies", "helpers", "babysitters", "tutors"]);

export function getVerificationProviderType(category: string) {
  return INDIVIDUAL_CATEGORIES.has(category) ? "individual" : "organisation";
}

export function getVerificationDocuments(category: string): VerificationDocumentRequirement[] {
  if (getVerificationProviderType(category) === "individual") {
    return [
      {
        key: "certified-id",
        label: "Certified copy of ID",
        hint: "Certified copy of a valid Omang, passport, or national identity document",
        sensitive: true,
      },
      {
        key: "cv",
        label: "CV / Resume",
        hint: "PDF or Word document showing care experience",
      },
      {
        key: "proof-of-residence-affidavit",
        label: "Proof of residence affidavit",
        hint: "Proof of residence or residence affidavit",
      },
      {
        key: "police-clearance",
        label: "Police clearance / fingerprints",
        hint: "Police clearance or fingerprint receipt where applicable",
        sensitive: true,
      },
    ];
  }

  if (category === "kiddies-transport") {
    return [
      {
        key: "registration-certificate",
        label: "Registration certificate",
        hint: "Business or operator registration certificate",
      },
      {
        key: "operating-documentation",
        label: "Relevant operating documentation",
        hint: "Transport permit, operating licence, or supporting operating document",
      },
      {
        key: "drivers-license",
        label: "Valid driver's license",
        hint: "Valid copy of the driver's license for kiddies transport",
        sensitive: true,
      },
      {
        key: "representative-id",
        label: "Representative ID",
        hint: "Valid ID for the owner, director, or authorised representative",
        sensitive: true,
      },
    ];
  }

  if (category === "pediatric-clinics") {
    return [
      {
        key: "trading-license",
        label: "Trading license",
        hint: "Current trading license for the practice or clinic",
      },
      {
        key: "professional-certificate",
        label: "Professional certificate / qualifications",
        hint: "Professional certificate or qualification documents",
      },
      {
        key: "doctor-certified-id",
        label: "Certified copy of doctor ID",
        hint: "Certified ID copy for the doctor in charge",
        sensitive: true,
      },
      {
        key: "practice-license",
        label: "Practice license",
        hint: "Practice and private practice licence for the doctor in charge",
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
      key: "prospectus",
      label: "Prospectus",
      hint: "School prospectus, curriculum overview, or parent information pack",
    },
    {
      key: "operating-documentation",
      label: "Relevant documentation",
      hint: "Licence, accreditation, permit, or supporting operating document",
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
