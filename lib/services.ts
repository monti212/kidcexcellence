import type { LucideIcon } from "lucide-react";
import {
  Baby,
  BookOpen,
  Brain,
  Car,
  Drama,
  Handshake,
  HeartPulse,
  Hospital,
  HouseHeart,
  PartyPopper,
  School,
  Sprout,
  Stethoscope,
  Target,
  UserRound,
} from "lucide-react";

/**
 * The service catalogue: every kind of provider Kidcellence lists.
 *
 * This file is the single source of truth for a service. The home page tiles,
 * search filters, signup and profile category pickers, listing badges,
 * verification documents, required profile details, pricing copy, and the
 * profile form's service-specific fields all read from SERVICES. Adding a
 * service means adding one entry here; see "Adding a service" in AGENTS.md.
 *
 * `id` is stored on every provider profile. Never rename or delete one that
 * has shipped; existing listings would lose their service.
 */

export type PriceUnit = "monthly" | "per day" | "per hour" | "termly" | "per visit" | "per night";

export const PRICE_UNITS: Array<{ value: PriceUnit; label: string }> = [
  { value: "per hour", label: "Per hour" },
  { value: "per day", label: "Per day" },
  { value: "per visit", label: "Per visit" },
  { value: "per night", label: "Per night" },
  { value: "monthly", label: "Monthly" },
  { value: "termly", label: "Termly" },
];

export function isPriceUnit(value: unknown): value is PriceUnit {
  return PRICE_UNITS.some((unit) => unit.value === value);
}

export interface VerificationDocumentRequirement {
  key: string;
  label: string;
  hint: string;
  /** Sensitive documents are shown to admins only. */
  sensitive?: boolean;
}

/**
 * A service-specific profile field. Values are stored in the profile's
 * `serviceDetails` map under `key` and shown on the public listing, so never
 * use one for private information; ask for a document instead.
 */
export interface ServiceDetailField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  placeholder?: string;
  hint?: string;
  numeric?: boolean;
  /** Required before the provider can submit for verification. */
  required?: boolean;
}

/**
 * Which hand-built profile form section a service uses. These predate the
 * catalogue and store their fields as top-level profile columns. New services
 * should use "standard" and describe their fields with `detailFields`.
 */
export type ProfileTemplate =
  | "care-worker"
  | "school"
  | "pediatric"
  | "transport"
  | "party"
  | "standard";

export interface ServiceSubcategory {
  id: string;
  name: string;
  children?: Array<{ id: string; name: string }>;
}

export interface ServiceDefinition {
  id: string;
  /** Directory name used on the home page tiles and search filters. */
  name: string;
  /** Singular name used on listing badges and category pickers. */
  label: string;
  icon: string;
  Icon: LucideIcon;
  tone?: "sky" | "gold" | "coral";
  /**
   * core: its own home page tile and search filter.
   * additional: listed under "Additional options".
   * nested: selectable by providers, discovered through `parentId`'s tile.
   */
  placement: "core" | "additional" | "nested";
  parentId?: string;
  providerType: "individual" | "organisation";
  profileTemplate: ProfileTemplate;
  /** Completes "Required documents for ..." on the provider Documents tab. */
  verificationAudience: string;
  documents: VerificationDocumentRequirement[];
  detailFields?: ServiceDetailField[];
  pricing?: {
    heading: string;
    inputLabel: string;
    defaultUnit?: PriceUnit;
    /** Add "price above zero" to the verification checklist. */
    requiredForVerification?: boolean;
  };
  servicesPlaceholder?: string;
  /** Hide the price from signed-out visitors and other providers. */
  priceVisibleToParentsOnly?: boolean;
  /** Offer the Standard / VIP vetting packages instead of the flat fee. */
  vettingPackages?: boolean;
  subcategories?: ServiceSubcategory[];
}

const CERTIFIED_ID_DOCUMENT: VerificationDocumentRequirement = {
  key: "certified-id",
  label: "Certified copy of ID / passport",
  hint: "Certified copy of a valid Omang, passport, or national identity document",
  sensitive: true,
};

const POLICE_CLEARANCE_DOCUMENT: VerificationDocumentRequirement = {
  key: "police-clearance",
  label: "Police clearance / fingerprints",
  hint: "Police clearance or fingerprint receipt where applicable",
  sensitive: true,
};

const INDIVIDUAL_CARE_DOCUMENTS: VerificationDocumentRequirement[] = [
  CERTIFIED_ID_DOCUMENT,
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
  POLICE_CLEARANCE_DOCUMENT,
];

const SCHOOL_DOCUMENTS: VerificationDocumentRequirement[] = [
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

/** Used by organisations without a tailored list, and by unknown categories. */
export const DEFAULT_ORGANISATION_DOCUMENTS: VerificationDocumentRequirement[] = [
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

const PEDIATRIC_SPECIALIST_DOCUMENTS: VerificationDocumentRequirement[] = [
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

const PEDIATRIC_SPECIALIST_SERVICE = {
  Icon: Hospital,
  placement: "core",
  providerType: "organisation",
  profileTemplate: "pediatric",
  verificationAudience: "paediatric specialists",
  documents: PEDIATRIC_SPECIALIST_DOCUMENTS,
  pricing: { heading: "Consultation price", inputLabel: "Consultation price (BWP)" },
  priceVisibleToParentsOnly: true,
} satisfies Partial<ServiceDefinition>;

const ORGANISATION_SERVICE = {
  placement: "core",
  providerType: "organisation",
  profileTemplate: "standard",
  verificationAudience: "organisations",
  documents: DEFAULT_ORGANISATION_DOCUMENTS,
} satisfies Partial<ServiceDefinition>;

export const SERVICES: ServiceDefinition[] = [
  {
    id: "babysitters",
    name: "Find a Babysitter",
    label: "Babysitter",
    icon: "🍼",
    Icon: Baby,
    tone: "gold",
    placement: "core",
    providerType: "individual",
    profileTemplate: "care-worker",
    verificationAudience: "individual care providers",
    documents: INDIVIDUAL_CARE_DOCUMENTS,
    vettingPackages: true,
  },
  {
    id: "nannies",
    name: "Find a Nanny",
    label: "Nanny",
    icon: "👩‍👧",
    Icon: UserRound,
    tone: "coral",
    placement: "core",
    providerType: "individual",
    profileTemplate: "care-worker",
    verificationAudience: "individual care providers",
    documents: INDIVIDUAL_CARE_DOCUMENTS,
    vettingPackages: true,
  },
  {
    id: "helpers",
    name: "Find a Helper",
    label: "Helper",
    icon: "🧹",
    Icon: HouseHeart,
    tone: "sky",
    placement: "core",
    providerType: "individual",
    profileTemplate: "care-worker",
    verificationAudience: "individual care providers",
    documents: INDIVIDUAL_CARE_DOCUMENTS,
    vettingPackages: true,
  },
  {
    id: "schools",
    name: "Find A School",
    label: "School",
    icon: "🏫",
    Icon: School,
    tone: "sky",
    placement: "core",
    providerType: "organisation",
    profileTemplate: "school",
    verificationAudience: "schools and nurseries",
    documents: SCHOOL_DOCUMENTS,
    subcategories: [
      { id: "nurseries", name: "Preschools" },
      { id: "primary", name: "Primary Schools" },
      { id: "junior", name: "Junior Schools" },
      { id: "senior", name: "Senior Secondary/High Schools" },
      { id: "tertiary-schools", name: "Tertiary Schools" },
    ],
  },
  {
    id: "nurseries",
    name: "Find a Nursery",
    label: "Nursery",
    icon: "🌱",
    Icon: Sprout,
    tone: "gold",
    placement: "nested",
    parentId: "schools",
    providerType: "organisation",
    profileTemplate: "school",
    verificationAudience: "schools and nurseries",
    documents: SCHOOL_DOCUMENTS,
  },
  {
    id: "tutors",
    name: "Find a Tutor",
    label: "Tutor",
    icon: "📚",
    Icon: BookOpen,
    tone: "coral",
    placement: "core",
    providerType: "individual",
    profileTemplate: "standard",
    verificationAudience: "individual care providers",
    documents: INDIVIDUAL_CARE_DOCUMENTS,
    subcategories: [
      {
        id: "primary-school-level",
        name: "Primary School Level",
        children: [
          { id: "primary-maths", name: "Maths" },
          { id: "primary-science", name: "Science" },
          { id: "primary-english", name: "English" },
          { id: "primary-setswana", name: "Setswana" },
          { id: "primary-literature", name: "Literature" },
        ],
      },
      {
        id: "junior-school-level",
        name: "Junior School Level",
        children: [
          { id: "junior-maths", name: "Maths" },
          { id: "junior-science", name: "Science" },
          { id: "junior-english", name: "English" },
          { id: "junior-setswana", name: "Setswana" },
          { id: "junior-business-studies", name: "Business Studies" },
          { id: "junior-literature", name: "Literature" },
        ],
      },
      {
        id: "senior-high-school-level",
        name: "Senior/High School Level",
        children: [
          { id: "senior-maths", name: "Maths" },
          { id: "senior-science", name: "Science" },
          { id: "senior-biology", name: "Biology" },
          { id: "senior-chemistry", name: "Chemistry" },
          { id: "senior-physics", name: "Physics" },
          { id: "senior-accounting", name: "Accounting" },
          { id: "senior-economics", name: "Economics" },
          { id: "senior-business-studies", name: "Business Studies" },
          { id: "senior-english", name: "English" },
          { id: "senior-setswana", name: "Setswana" },
          { id: "senior-statistics", name: "Statistics" },
          { id: "senior-literature", name: "Literature" },
        ],
      },
      {
        id: "tertiary-school-level",
        name: "Tertiary School Level",
        children: [
          { id: "tertiary-maths", name: "Maths" },
          { id: "tertiary-science", name: "Science" },
          { id: "tertiary-biology", name: "Biology" },
          { id: "tertiary-chemistry", name: "Chemistry" },
          { id: "tertiary-physics", name: "Physics" },
          { id: "tertiary-accounting", name: "Accounting" },
          { id: "tertiary-economics", name: "Economics" },
          { id: "tertiary-business-studies", name: "Business Studies" },
          { id: "tertiary-english", name: "English" },
          { id: "tertiary-setswana", name: "Setswana" },
          { id: "tertiary-statistics", name: "Statistics" },
          { id: "tertiary-research-project-support", name: "Research Assistance and Project Support" },
          { id: "tertiary-literature", name: "Literature" },
        ],
      },
    ],
  },
  {
    ...PEDIATRIC_SPECIALIST_SERVICE,
    id: "pediatric-clinics",
    name: "Find a Pediatrician",
    label: "Pediatrician",
    icon: "🏥",
    tone: "sky",
  },
  {
    ...PEDIATRIC_SPECIALIST_SERVICE,
    id: "pediatric-therapy",
    name: "Pediatric Occupational/ speech therapy",
    label: "Pediatric Occupational / Speech Therapy",
    icon: "🩺",
    Icon: Stethoscope,
  },
  {
    ...PEDIATRIC_SPECIALIST_SERVICE,
    id: "child-psychologists",
    name: "Child Psychologists/ Therapists",
    label: "Child Psychologist / Therapist",
    icon: "🧠",
    Icon: Brain,
  },
  {
    id: "postpartum-nurses",
    name: "Postpartum Nurse Care",
    label: "Postpartum Nurse Care",
    icon: "🤱",
    Icon: HeartPulse,
    tone: "coral",
    placement: "core",
    providerType: "individual",
    profileTemplate: "standard",
    verificationAudience: "postpartum nurses",
    documents: [
      CERTIFIED_ID_DOCUMENT,
      {
        key: "nursing-registration-certificate",
        label: "NMCB registration certificate",
        hint: "Certificate of registration with the Nursing and Midwifery Council of Botswana as a nurse or midwife",
        sensitive: true,
      },
      {
        key: "nursing-practising-certificate",
        label: "Current practising certificate",
        hint: "This year's NMCB practising certificate (licence to practise)",
        sensitive: true,
      },
      {
        key: "nursing-qualifications",
        label: "Nursing / midwifery qualifications",
        hint: "Certified copies of your nursing or midwifery diploma or degree, plus any postnatal, neonatal, or lactation certificates",
        sensitive: true,
      },
      {
        key: "cv",
        label: "CV / Resume",
        hint: "PDF or Word document showing your nursing and postnatal care experience",
      },
      POLICE_CLEARANCE_DOCUMENT,
      {
        key: "professional-indemnity",
        label: "Professional indemnity insurance",
        hint: "Proof of current professional indemnity or malpractice cover",
      },
    ],
    detailFields: [
      {
        key: "nurseRegistrationNumber",
        label: "NMCB registration number",
        type: "text",
        placeholder: "As shown on your NMCB certificate",
        hint: "Families and Kidcellence use this to confirm your registration with the Nursing and Midwifery Council of Botswana.",
        required: true,
      },
      {
        key: "nursingQualification",
        label: "Registered as",
        type: "select",
        options: ["Registered Nurse", "Registered Midwife", "Registered Nurse and Midwife"],
        required: true,
      },
      {
        key: "postnatalExperienceYears",
        label: "Years of postnatal care experience",
        type: "text",
        numeric: true,
        placeholder: "e.g. 6",
        required: true,
      },
      {
        key: "careArrangement",
        label: "Care offered",
        type: "select",
        options: [
          "Day visits",
          "Night shifts",
          "Day visits and night shifts",
          "Live-in (day and night care)",
        ],
        required: true,
      },
      {
        key: "areasCovered",
        label: "Areas covered for home visits",
        type: "text",
        placeholder: "Gaborone, Phakalane, Mogoditshane, Tlokweng",
      },
      {
        key: "additionalTraining",
        label: "Additional training",
        type: "textarea",
        placeholder: "Lactation support, neonatal care, CPR / BLS, post-caesarean wound care",
      },
    ],
    pricing: {
      heading: "Rate",
      inputLabel: "Rate (BWP)",
      defaultUnit: "per visit",
      requiredForVerification: true,
    },
    servicesPlaceholder:
      "Postnatal check-ups, newborn care, breastfeeding support, night care, post-caesarean recovery",
  },
  {
    ...ORGANISATION_SERVICE,
    id: "after-school",
    name: "After School and Weekend Programs",
    label: "After School / Weekend Program",
    icon: "🎯",
    Icon: Target,
    subcategories: [
      { id: "swimming", name: "Swimming" },
      { id: "football", name: "Football" },
      { id: "chess", name: "Chess" },
      { id: "robotics", name: "Robotics" },
      { id: "visual-arts", name: "Visual Arts" },
      { id: "hand-crafts", name: "Hand Crafts" },
      { id: "ballet", name: "Ballet" },
      { id: "music", name: "Music" },
      { id: "tennis", name: "Tennis" },
      { id: "badmatin", name: "Badmatin" },
      { id: "karate", name: "Karate" },
      { id: "foreign-language", name: "Foreign Language" },
      { id: "basketball", name: "Basketball" },
      { id: "gymnastics", name: "Gymnastics" },
      { id: "netball", name: "Netball" },
      { id: "drama-theater-acting", name: "Drama, Theater and Acting" },
      { id: "cooking-baking", name: "Cooking and Baking" },
      { id: "fashion-design", name: "Fashion Design" },
      { id: "poetry-creative-writing-storytelling", name: "Poetry, Creative Writting and Story Telling" },
      { id: "public-speaking", name: "Public Speaking" },
      { id: "dance-choreography", name: "Dance and Choreography" },
      { id: "athletics", name: "Athletics" },
      { id: "rugby", name: "Rugby" },
      { id: "hockey", name: "Hockey" },
      { id: "cycling", name: "Cycling" },
      { id: "boxing", name: "Boxing" },
      { id: "choir", name: "Choir" },
      { id: "it-computing", name: "IT and Computing" },
      { id: "animation", name: "Animation" },
      { id: "media-television", name: "Media and Television" },
      { id: "sewing", name: "Sewing" },
      { id: "comedy", name: "Comedy" },
      { id: "book-clubs", name: "Book Clubs" },
      { id: "coding", name: "Coding" },
      { id: "debate", name: "Debate" },
      { id: "farming-gardening", name: "Farming and Gardening" },
      { id: "diy-experiments", name: "DIY and Experiments" },
      { id: "mentorship-leadership", name: "Mentorship and Leadership Programs" },
      { id: "volunteering-community-service", name: "Volunteering and Community Service" },
    ],
  },
  {
    id: "kiddies-transport",
    name: "Kiddies Transport",
    label: "Kiddies Transport",
    icon: "🚗",
    Icon: Car,
    tone: "sky",
    placement: "core",
    providerType: "organisation",
    profileTemplate: "transport",
    verificationAudience: "organisations",
    documents: [
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
    ],
    pricing: { heading: "Price per month", inputLabel: "Monthly transport price (BWP)" },
    subcategories: [
      { id: "taxi", name: "Taxi" },
      { id: "combi", name: "Combi" },
    ],
  },
  {
    id: "kiddies-parties",
    name: "Kiddies Parties",
    label: "Kiddies Parties",
    icon: "🎉",
    Icon: PartyPopper,
    placement: "core",
    providerType: "organisation",
    profileTemplate: "party",
    verificationAudience: "organisations",
    documents: [
      {
        key: "certificate-of-incorporation",
        label: "Certificate of incorporation",
        hint: "Company registration or certificate of incorporation",
        sensitive: true,
      },
    ],
    pricing: { heading: "Services and prices", inputLabel: "Starting package price (BWP)" },
  },
  {
    ...ORGANISATION_SERVICE,
    id: "agencies",
    name: "Independent Agencies",
    label: "Independent Agency",
    icon: "🤝",
    Icon: Handshake,
    placement: "additional",
  },
  {
    ...ORGANISATION_SERVICE,
    id: "kiddies-entertainment",
    name: "Kids Entertainment & Events",
    label: "Kids Entertainment & Events",
    icon: "🤹",
    Icon: Drama,
    subcategories: [
      { id: "theme-parks", name: "Theme Parks" },
      { id: "venues", name: "Entertainment Venues" },
    ],
  },
];

export const CORE_SERVICES = SERVICES.filter((service) => service.placement === "core");
export const ADDITIONAL_SERVICES = SERVICES.filter(
  (service) => service.placement === "additional"
);

export const PROVIDER_CATEGORY_OPTIONS = SERVICES.map((service) => ({
  id: service.id,
  name: service.label,
}));

/** Value-to-label maps for Base UI `Select items`, so triggers show labels, not ids. */
export const PROVIDER_CATEGORY_ITEMS = Object.fromEntries(
  SERVICES.map((service) => [service.id, service.label])
);
export const PRICE_UNIT_ITEMS = Object.fromEntries(
  PRICE_UNITS.map((unit) => [unit.value, unit.label])
);

export function getService(id: string | undefined) {
  return SERVICES.find((service) => service.id === id);
}

export function isServiceId(id: unknown): id is string {
  return typeof id === "string" && SERVICES.some((service) => service.id === id);
}

/** Services discovered through this service's tile, e.g. nurseries under schools. */
export function getNestedServiceIds(id: string) {
  return SERVICES.filter((service) => service.parentId === id).map((service) => service.id);
}

/** The service fields that are safe to send over the public provider APIs. */
export function publicServiceSummary(service: ServiceDefinition) {
  return {
    id: service.id,
    name: service.name,
    label: service.label,
    icon: service.icon,
    placement: service.placement,
    subcategories: service.subcategories,
  };
}

/**
 * Keeps only the detail fields the service declares, trimmed and capped.
 * Anything else in the input (stale keys from another service, junk) is dropped.
 */
export function sanitizeServiceDetails(categoryId: string, input: unknown) {
  const fields = getService(categoryId)?.detailFields ?? [];
  const source = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const details: Record<string, string> = {};
  for (const field of fields) {
    const raw = source[field.key];
    if (typeof raw !== "string") continue;
    const value = raw.trim().slice(0, 2000);
    if (!value) continue;
    if (field.type === "select" && !field.options?.includes(value)) continue;
    details[field.key] = value;
  }
  return details;
}

/** Label/value pairs for the detail fields this service declares and the provider filled. */
export function serviceDetailEntries(
  categoryId: string,
  details: Record<string, string> | undefined
) {
  const valid = sanitizeServiceDetails(categoryId, details);
  return (getService(categoryId)?.detailFields ?? []).flatMap((field) => {
    const value = valid[field.key];
    return value ? [{ key: field.key, label: field.label, value }] : [];
  });
}
