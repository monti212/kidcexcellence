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

export interface VerificationProfileDraft {
  category?: string;
  location?: string;
  bio?: string;
  price?: string;
  age?: string;
  stayArrangement?: string;
  workStartDate?: string;
  childrenCount?: string;
  workExperienceSummary?: string;
  yearsExperience?: string;
  references?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelationship?: string;
  mission?: string;
  vision?: string;
  values?: string;
  medicalAids?: string;
  feeRows?: Array<{
    grade?: string;
    termly?: string;
    annually?: string;
  }>;
}

export interface VerificationUploadSummary {
  profileImageUploaded: boolean;
  galleryCount: number;
}

const INDIVIDUAL_CATEGORIES = new Set(["nannies", "helpers", "babysitters", "tutors"]);
const CARE_WORKER_CATEGORIES = new Set(["nannies", "helpers", "babysitters"]);
const SCHOOL_CATEGORIES = new Set(["schools", "nurseries"]);
const PEDIATRIC_SPECIALIST_CATEGORIES = new Set([
  "pediatric-clinics",
  "pediatric-therapy",
  "child-psychologists",
]);

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

  if (PEDIATRIC_SPECIALIST_CATEGORIES.has(category)) {
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

  if (SCHOOL_CATEGORIES.has(category)) {
    return [
      {
        key: "registration-certificate",
        label: "Registration certificate",
        hint: "School, nursery, or organisation registration certificate",
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

function hasValue(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function hasSchoolFees(profile: VerificationProfileDraft) {
  return (
    profile.feeRows?.some(
      (row) => hasValue(row.grade) && (Number(row.termly) > 0 || Number(row.annually) > 0)
    ) ?? false
  );
}

export function missingVerificationProfileFields(
  profile: VerificationProfileDraft,
  uploads: VerificationUploadSummary
) {
  const category = profile.category ?? "";
  const missing: string[] = [];

  if (!uploads.profileImageUploaded) missing.push("Display picture");

  if (CARE_WORKER_CATEGORIES.has(category)) {
    if (!hasValue(profile.age)) missing.push("Age");
    if (!hasValue(profile.location)) missing.push("Location");
    if (!hasValue(profile.stayArrangement)) missing.push("Stay in or stay out");
    if (!hasValue(profile.workStartDate)) missing.push("Availability / resume work date");
    if (!hasValue(profile.childrenCount)) missing.push("Number of kids");
    if (!hasValue(profile.workExperienceSummary)) missing.push("Brief work experience");
    if (!hasValue(profile.yearsExperience)) missing.push("Years of work experience");
    if (!hasValue(profile.references)) missing.push("References");
    if (
      !hasValue(profile.nextOfKinName) ||
      !hasValue(profile.nextOfKinPhone) ||
      !hasValue(profile.nextOfKinRelationship)
    ) {
      missing.push("Next of kin details");
    }
    return missing;
  }

  if (SCHOOL_CATEGORIES.has(category)) {
    if (uploads.galleryCount < 1) missing.push("At least one school gallery picture");
    if (!hasSchoolFees(profile)) missing.push("School fee prices by grade");
    if (!hasValue(profile.bio)) missing.push("School description");
    if (!hasValue(profile.mission)) missing.push("Mission");
    if (!hasValue(profile.vision)) missing.push("Vision");
    if (!hasValue(profile.values)) missing.push("Values");
    return missing;
  }

  if (PEDIATRIC_SPECIALIST_CATEGORIES.has(category)) {
    if (!hasValue(profile.location)) missing.push("Location");
    if (Number(profile.price) <= 0) missing.push("Consultation price");
    if (!hasValue(profile.medicalAids)) missing.push("Medical aids accepted");
    if (!hasValue(profile.bio)) missing.push("Background and about");
    return missing;
  }

  if (!hasValue(profile.location)) missing.push("Location");
  if (!hasValue(profile.bio)) missing.push("Description");
  return missing;
}

export function missingVerificationDocuments(category: string, uploadedKeys: string[]) {
  const uploaded = new Set(uploadedKeys);
  return getVerificationDocuments(category).filter((document) => !uploaded.has(document.key));
}
