import {
  DEFAULT_ORGANISATION_DOCUMENTS,
  getService,
  sanitizeServiceDetails,
  type ServiceDefinition,
  type VerificationDocumentRequirement,
} from "@/lib/services";

export type { VerificationDocumentRequirement };

export const VERIFICATION_FEE = {
  amount: 250,
  currency: "BWP",
};

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
  serviceDetails?: Record<string, string>;
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

export function getVerificationProviderType(category: string) {
  return getService(category)?.providerType ?? "organisation";
}

export function getVerificationDocuments(category: string): VerificationDocumentRequirement[] {
  return getService(category)?.documents ?? DEFAULT_ORGANISATION_DOCUMENTS;
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

function missingTemplateFields(
  template: ServiceDefinition["profileTemplate"],
  profile: VerificationProfileDraft,
  uploads: VerificationUploadSummary
) {
  const missing: string[] = [];

  if (template === "care-worker") {
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

  if (template === "transport") {
    if (!hasValue(profile.ownerFullName)) missing.push("Company name or driver full names");
    if (!hasValue(profile.location)) missing.push("Location");
    if (!hasValue(profile.numberPlate)) missing.push("Number plate");
    if (!hasValue(profile.prdp)) missing.push("PRDP");
    if (Number(profile.price) <= 0) missing.push("Price per month");
    if (uploads.galleryCount < 1) missing.push("Vehicle picture");
    return missing;
  }

  if (template === "party") {
    if (!hasValue(profile.ownerFullName)) missing.push("Owner full names");
    if (!hasValue(profile.location)) missing.push("Location");
    if (!hasValue(profile.tradingHours)) missing.push("Trading hours");
    if (!hasValue(profile.price)) missing.push("Services and prices");
    return missing;
  }

  if (template === "school") {
    if (uploads.galleryCount < 1) missing.push("At least one school gallery picture");
    if (!hasSchoolFees(profile)) missing.push("School fee prices by grade");
    if (!hasValue(profile.bio)) missing.push("School description");
    if (!hasValue(profile.mission)) missing.push("Mission");
    if (!hasValue(profile.vision)) missing.push("Vision");
    if (!hasValue(profile.values)) missing.push("Values");
    return missing;
  }

  if (template === "pediatric") {
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

export function missingVerificationProfileFields(
  profile: VerificationProfileDraft,
  uploads: VerificationUploadSummary
) {
  const service = getService(profile.category);
  const missing: string[] = [];

  if (!uploads.profileImageUploaded) missing.push("Display picture");
  if (!uploads.coverImageUploaded) missing.push("Cover photo");

  missing.push(...missingTemplateFields(service?.profileTemplate ?? "standard", profile, uploads));

  if (service?.pricing?.requiredForVerification && Number(profile.price) <= 0) {
    missing.push(service.pricing.heading);
  }
  const details = sanitizeServiceDetails(profile.category ?? "", profile.serviceDetails);
  for (const field of service?.detailFields ?? []) {
    if (field.required && !details[field.key]) missing.push(field.label);
  }
  return missing;
}

export function missingVerificationDocuments(category: string, uploadedKeys: string[]) {
  const uploaded = new Set(uploadedKeys);
  return getVerificationDocuments(category).filter((document) => !uploaded.has(document.key));
}
