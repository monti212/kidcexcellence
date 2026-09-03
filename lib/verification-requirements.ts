/**
 * Verification fees, as advertised on /pricing.
 *
 * Individual care workers pay the lower fee; every other provider type pays the
 * organisation fee. The split follows the same category set as the subscription
 * tiers in lib/billing-plans.ts, so a nanny on the P60 plan pays P20 and a
 * school on the P150 plan pays P50.
 *
 * Verification is optional. Paying it earns the verified badge; it is not
 * required to publish a profile.
 */
export const VERIFICATION_FEES = {
  careWorker: { amount: 20, currency: "BWP" as const },
  organisation: { amount: 50, currency: "BWP" as const },
};

export function getVerificationFee(category: string) {
  return CARE_WORKER_CATEGORIES.has(category)
    ? VERIFICATION_FEES.careWorker
    : VERIFICATION_FEES.organisation;
}

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
  hasChildren?: string;
  workStartDate?: string;
  childrenCount?: string;
  workExperienceSummary?: string;
  yearsExperience?: string;
  references?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelationship?: string;
  ownerFullName?: string;
  tradingHours?: string;
  numberPlate?: string;
  prdp?: string;
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
  coverImageUploaded?: boolean;
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
        label: "Certified copy of ID / passport",
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
        label: "Certified proof of residence",
        hint: "Certified proof of residence or residence affidavit",
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
        key: "vehicle-license-disk",
        label: "Picture of valid car license disk",
        hint: "Photo or scan of the current vehicle license disk",
      },
      {
        key: "drivers-license",
        label: "Valid driver's license",
        hint: "Valid copy of the driver's license for kiddies transport",
        sensitive: true,
      },
      {
        key: "prdp",
        label: "PRDP",
        hint: "Valid professional driving permit",
        sensitive: true,
      },
      {
        key: "vehicle-picture",
        label: "Picture of vehicle",
        hint: "Clear picture of the taxi or combi used for transport",
      },
    ];
  }

  if (PEDIATRIC_SPECIALIST_CATEGORIES.has(category)) {
    return [
      {
        key: "practising-license",
        label: "Practising license",
        hint: "Current practising license for the specialist in charge",
        sensitive: true,
      },
      {
        key: "private-practise-license",
        label: "Private practise license",
        hint: "Current private practise license where applicable",
        sensitive: true,
      },
      {
        key: "academic-qualifications",
        label: "Academic qualifications / certificates",
        hint: "Academic qualifications, certificates, and specialist credentials",
        sensitive: true,
      },
      {
        key: "trading-license",
        label: "Trading license",
        hint: "Current trading license for the practice or clinic",
      },
      {
        key: "certificate-of-incorporation",
        label: "Certificate of incorporation",
        hint: "Company registration or certificate of incorporation",
      },
      {
        key: "company-profile",
        label: "Downloadable company profile",
        hint: "PDF company profile for parents to download from your listing",
      },
    ];
  }

  if (category === "kiddies-parties") {
    return [
      {
        key: "certificate-of-incorporation",
        label: "Certificate of incorporation",
        hint: "Company registration or certificate of incorporation",
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
  if (!uploads.coverImageUploaded) missing.push("Cover photo");

  if (CARE_WORKER_CATEGORIES.has(category)) {
    if (!hasValue(profile.age)) missing.push("Age");
    if (!hasValue(profile.location)) missing.push("Location");
    if (!hasValue(profile.stayArrangement)) missing.push("Stay in or stay out");
    if (!hasValue(profile.workStartDate)) missing.push("Availability / resume work date");
    if (!hasValue(profile.hasChildren)) missing.push("Whether they have kids");
    if (profile.hasChildren === "yes" && !hasValue(profile.childrenCount)) missing.push("Number of kids");
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

  if (category === "kiddies-transport") {
    if (!hasValue(profile.ownerFullName)) missing.push("Company name or driver full names");
    if (!hasValue(profile.location)) missing.push("Location");
    if (!hasValue(profile.numberPlate)) missing.push("Number plate");
    if (!hasValue(profile.prdp)) missing.push("PRDP");
    if (Number(profile.price) <= 0) missing.push("Price per month");
    if (uploads.galleryCount < 1) missing.push("Vehicle picture");
    return missing;
  }

  if (category === "kiddies-parties") {
    if (!hasValue(profile.ownerFullName)) missing.push("Owner full names");
    if (!hasValue(profile.location)) missing.push("Location");
    if (!hasValue(profile.tradingHours)) missing.push("Trading hours");
    if (!hasValue(profile.price)) missing.push("Services and prices");
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
    if (!hasValue(profile.tradingHours)) missing.push("Trading hours");
    if (uploads.galleryCount < 1) missing.push("Facility picture");
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
