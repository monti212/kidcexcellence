import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import { type Conversation, type Message, type Provider } from "@/lib/mock-data";
import {
  allProvidersFromStore,
  getCategoryLabel,
  type ApprovedVerification,
  type PendingVerification,
} from "@/lib/platform-service";
import {
  VERIFICATION_FEE,
  missingVerificationDocuments,
  missingVerificationProfileFields,
} from "@/lib/verification-requirements";
import {
  categorySupportsVettingPackages,
  getVettingPackage,
} from "@/lib/vetting-packages";

export type UserRole = "parent" | "provider" | "admin";
export const SESSION_COOKIE_NAME = "kidcellence_session";
const SESSION_TOKEN_VERSION = "v2";
const BUILT_IN_ADMIN_EMAILS = [
  "monti@uhuruai.co",
  "gaone@uhuruai.co",
  "katlotarniah@gmail.com",
];
const LEGACY_DEMO_APPROVED_VERIFICATION_IDS = new Set(["a1", "a2", "a3", "a4", "a5"]);

export interface PlatformUser {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  category?: string;
  passwordHash: string;
  emailVerifiedAt?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface PublicPlatformUser {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  category?: string;
  emailVerifiedAt?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface PlatformSession {
  token: string;
  userId: string;
  role: UserRole;
  createdAt: string;
  expiresAt: string;
}

interface SignedSessionPayload {
  user: PublicPlatformUser;
  passwordHash?: string;
  session: Omit<PlatformSession, "token">;
}

export interface AccountTokenRecord {
  token: string;
  userId: string;
  type: "email-verification" | "password-reset";
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

export interface ChildProfile {
  id: string;
  name: string;
  dob: string;
  specialNeeds: string;
}

export interface ParentProfileRecord {
  userId: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  location: string;
  phone: string;
  bio: string;
  children: ChildProfile[];
  savedAt: string;
}

export interface ProviderProfileRecord {
  userId: string;
  displayName: string;
  category: string;
  location: string;
  bio: string;
  phone: string;
  whatsapp: string;
  services: string[];
  experience: string;
  availability: string;
  price: string;
  priceUnit: "monthly" | "per day" | "per hour" | "termly";
  age?: string;
  stayArrangement?: "stay-in" | "stay-out";
  hasChildren?: "yes" | "no";
  workStartDate?: string;
  willingToRelocate?: boolean;
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
  liveIn: boolean;
  published: boolean;
  verificationStatus: "not_submitted" | "pending" | "approved" | "rejected";
  verificationPaymentStatus: "unpaid" | "paid";
  verificationFeeAmount?: number;
  verificationFeeCurrency?: string;
  verificationFeePaidAt?: string;
  verificationPaymentReference?: string;
  verificationPackageId?: string;
  verificationPackageName?: string;
  feeRows: Array<{
    grade: string;
    termly: string;
    annually: string;
  }>;
  savedAt: string;
}

export interface PlatformUploadRecord {
  id: string;
  userId: string;
  type: "document" | "gallery" | "profile-image" | "cover-image";
  documentKey?: string;
  label: string;
  fileName: string;
  contentType: string;
  size: number;
  path: string;
  createdAt: string;
}

export interface StoredConversation extends Conversation {
  parentUserId: string;
  parentName: string;
  providerId: string;
  providerUserId?: string;
  providerName: string;
  unreadForParent?: number;
  unreadForProvider?: number;
}

export interface PlatformStore {
  users: PlatformUser[];
  sessions: PlatformSession[];
  revokedSessionTokens: string[];
  accountTokens: AccountTokenRecord[];
  parentProfiles: Record<string, ParentProfileRecord>;
  providerProfiles: Record<string, ProviderProfileRecord>;
  uploads: PlatformUploadRecord[];
  conversations: StoredConversation[];
  verifications: {
    pendingProviders: PendingVerification[];
    approvedProviders: ApprovedVerification[];
    rejectedCount: number;
  };
}

const runtimeDataRoot =
  process.env.PLATFORM_DATA_DIR ??
  (process.env.NODE_ENV === "production"
    ? path.join(tmpdir(), "kidcexcellence")
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "data"));
const storePath =
  process.env.PLATFORM_STORE_PATH ?? path.join(runtimeDataRoot, "platform-store.json");
export const uploadRootPath =
  process.env.PLATFORM_UPLOADS_DIR ?? path.join(runtimeDataRoot, "uploads");
const scrypt = promisify(scryptCallback);
const PLATFORM_STORE_BLOB_KEY = "platform-store.json";
const UPLOAD_BLOB_PREFIX = "uploads/";
const BLOB_PATH_PREFIX = "blob:";

function shouldUseNetlifyBlobs() {
  return (
    process.env.PLATFORM_STORAGE_DRIVER === "netlify-blobs" ||
    (process.env.NETLIFY === "true" &&
      !process.env.PLATFORM_STORE_PATH &&
      !process.env.PLATFORM_DATA_DIR &&
      !process.env.PLATFORM_UPLOADS_DIR)
  );
}

function platformBlobStore() {
  return getStore("kidcellence-platform");
}

function uploadBlobStore() {
  return getStore("kidcellence-uploads");
}

function createInitialStore(): PlatformStore {
  return {
    users: [],
    sessions: [],
    revokedSessionTokens: [],
    accountTokens: [],
    parentProfiles: {},
    providerProfiles: {},
    uploads: [],
    conversations: [],
    verifications: {
      pendingProviders: [],
      approvedProviders: [],
      rejectedCount: 0,
    },
  };
}

async function persistStore(store: PlatformStore) {
  if (shouldUseNetlifyBlobs()) {
    await platformBlobStore().setJSON(PLATFORM_STORE_BLOB_KEY, store);
    return;
  }

  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function normalizeStore(store: Partial<PlatformStore>): PlatformStore {
  const initial = createInitialStore();
  const providerProfiles = Object.fromEntries(
    Object.entries(store.providerProfiles ?? {}).map(([userId, profile]) => [
      userId,
      {
        ...profile,
        userId,
        displayName: profile.displayName ?? "",
        location: profile.location ?? "",
        bio: profile.bio ?? "",
        phone: profile.phone ?? "",
        whatsapp: profile.whatsapp ?? "",
        services: profile.services ?? [],
        experience: profile.experience ?? "",
        availability: profile.availability ?? "",
        price: profile.price ?? "",
        priceUnit: profile.priceUnit ?? "termly",
        age: profile.age ?? "",
        stayArrangement: profile.stayArrangement ?? "stay-out",
        workStartDate: profile.workStartDate ?? "",
        willingToRelocate: profile.willingToRelocate ?? false,
        childrenCount: profile.childrenCount ?? "",
        workExperienceSummary: profile.workExperienceSummary ?? "",
        yearsExperience: profile.yearsExperience ?? "",
        references: profile.references ?? "",
        nextOfKinName: profile.nextOfKinName ?? "",
        nextOfKinPhone: profile.nextOfKinPhone ?? "",
        nextOfKinRelationship: profile.nextOfKinRelationship ?? "",
        mission: profile.mission ?? "",
        vision: profile.vision ?? "",
        values: profile.values ?? "",
        medicalAids: profile.medicalAids ?? "",
        published: profile.published ?? false,
        verificationStatus: profile.verificationStatus ?? "not_submitted",
        verificationPaymentStatus: profile.verificationPaymentStatus ?? "unpaid",
        verificationFeeAmount: profile.verificationFeeAmount,
        verificationFeeCurrency: profile.verificationFeeCurrency,
        verificationFeePaidAt: profile.verificationFeePaidAt,
        verificationPaymentReference: profile.verificationPaymentReference,
        verificationPackageId: profile.verificationPackageId,
        verificationPackageName: profile.verificationPackageName,
      },
    ])
  );
  return {
    users: store.users ?? initial.users,
    sessions: store.sessions ?? initial.sessions,
    revokedSessionTokens: store.revokedSessionTokens ?? initial.revokedSessionTokens,
    accountTokens: store.accountTokens ?? initial.accountTokens,
    parentProfiles: Object.fromEntries(
      Object.entries(store.parentProfiles ?? {}).map(([userId, profile]) => [
        userId,
        {
          ...profile,
          userId,
          fullName: profile.fullName ?? "",
          dateOfBirth: profile.dateOfBirth ?? "",
          nationality: profile.nationality ?? "",
          location: profile.location ?? "",
          phone: profile.phone ?? "",
          bio: profile.bio ?? "",
          children: profile.children ?? [],
        },
      ])
    ),
    providerProfiles,
    uploads: store.uploads ?? initial.uploads,
    conversations: (store.conversations ?? []).filter(
      (conversation): conversation is StoredConversation =>
        typeof (conversation as StoredConversation).parentUserId === "string" &&
        typeof (conversation as StoredConversation).providerId === "string"
    ),
    verifications: {
      pendingProviders:
        (store.verifications?.pendingProviders ?? initial.verifications.pendingProviders).filter(
          (pending) => Boolean(pending.userId)
        ),
      approvedProviders:
        (store.verifications?.approvedProviders ?? initial.verifications.approvedProviders).filter(
          (approved) => approved.userId || !LEGACY_DEMO_APPROVED_VERIFICATION_IDS.has(approved.id)
        ),
      rejectedCount: store.verifications?.rejectedCount ?? initial.verifications.rejectedCount,
    },
  };
}

export async function readStore(): Promise<PlatformStore> {
  if (shouldUseNetlifyBlobs()) {
    const stored = await platformBlobStore().get(PLATFORM_STORE_BLOB_KEY, {
      type: "json",
    });
    const store = stored ? normalizeStore(stored as Partial<PlatformStore>) : createInitialStore();
    if (!stored) {
      await persistStore(store);
    }
    return store;
  }

  try {
    const contents = await readFile(storePath, "utf8");
    const store = normalizeStore(JSON.parse(contents));
    await persistStore(store);
    return store;
  } catch {
    const store = createInitialStore();
    await persistStore(store);
    return store;
  }
}

export async function updateStore<T>(updater: (store: PlatformStore) => T | Promise<T>) {
  const store = await readStore();
  const result = await updater(store);
  await persistStore(store);
  return result;
}

function publicUser(user: PlatformUser): PublicPlatformUser {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    location: user.location,
    category: user.category,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function findUserByEmail(store: PlatformStore, email: string) {
  const normalizedEmail = normalizeEmail(email);
  return store.users.find((item) => normalizeEmail(item.email) === normalizedEmail);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

function uniquePasswordAttempts(password: string) {
  return [...new Set([password, password.trim()])];
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) {
    return uniquePasswordAttempts(password).some((attempt) => {
      const expected = Buffer.from(storedHash);
      const actual = Buffer.from(attempt);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    });
  }

  for (const attempt of uniquePasswordAttempts(password)) {
    const expected = Buffer.from(key, "hex");
    const actual = (await scrypt(attempt, salt, 64)) as Buffer;
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
      return true;
    }
  }
  return false;
}

function hasRecoverablePasswordPlaceholder(storedHash: string) {
  return !storedHash || storedHash === "restored-from-signed-session";
}

function sessionSecret() {
  return (
    process.env.SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "kidcellence-development-session-secret"
  );
}

function signSessionBody(body: string) {
  return createHmac("sha256", sessionSecret()).update(body).digest("base64url");
}

function sessionEncryptionKey() {
  return createHash("sha256").update(sessionSecret()).digest();
}

function sealSessionPayload(payload: SignedSessionPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    SESSION_TOKEN_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

function openSealedSessionToken(token: string) {
  const [version, iv, ciphertext, tag] = token.split(".");
  if (version !== SESSION_TOKEN_VERSION || !iv || !ciphertext || !tag) return null;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      sessionEncryptionKey(),
      Buffer.from(iv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8")) as SignedSessionPayload;
  } catch {
    return null;
  }
}

function createSignedSessionToken(user: PlatformUser, session: Omit<PlatformSession, "token">) {
  return sealSessionPayload({
    user: publicUser(user),
    passwordHash: user.passwordHash,
    session,
  });
}

function readSignedSessionToken(token: string) {
  const sealedPayload = openSealedSessionToken(token);
  if (sealedPayload) {
    if (
      !sealedPayload.user?.id ||
      !sealedPayload.session?.userId ||
      sealedPayload.user.id !== sealedPayload.session.userId
    ) {
      return null;
    }
    if (new Date(sealedPayload.session.expiresAt).getTime() <= Date.now()) return null;
    return sealedPayload;
  }

  const [version, body, signature] = token.split(".");
  if (version !== "v1" || !body || !signature) return null;

  const expected = Buffer.from(signSessionBody(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedSessionPayload;
    if (!payload.user?.id || !payload.session?.userId || payload.user.id !== payload.session.userId) {
      return null;
    }
    if (new Date(payload.session.expiresAt).getTime() <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function createSession(user: PlatformUser): PlatformSession {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + 30);
  const session = {
    userId: user.id,
    role: user.role,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  return {
    token: createSignedSessionToken(user, session),
    ...session,
  };
}

function createStarterProviderProfile(user: PlatformUser, now: string): ProviderProfileRecord {
  const category = user.category || "schools";
  const categoryLabel = getCategoryLabel(category);

  return {
    userId: user.id,
    displayName: user.name,
    category,
    location: user.location ?? "",
    bio: `${user.name} has joined Kidcellence as a ${categoryLabel.toLowerCase()} provider and is completing their profile.`,
    phone: user.phone ?? "",
    whatsapp: user.phone ?? "",
    services: [categoryLabel],
    experience: "Profile started",
    availability: "Contact provider",
    price: "",
    priceUnit: "termly",
    age: "",
    stayArrangement: "stay-out",
    workStartDate: "",
    willingToRelocate: false,
    childrenCount: "",
    workExperienceSummary: "",
    yearsExperience: "",
    references: "",
    nextOfKinName: "",
    nextOfKinPhone: "",
    nextOfKinRelationship: "",
    mission: "",
    vision: "",
    values: "",
    medicalAids: "",
    liveIn: false,
    published: true,
    verificationStatus: "not_submitted",
    verificationPaymentStatus: "unpaid",
    feeRows: [],
    savedAt: now,
  };
}

export async function createOrLoginUser(input: {
  mode: "signup" | "login";
  role: UserRole;
  name?: string;
  email: string;
  password: string;
  phone?: string;
  location?: string;
  category?: string;
}) {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const normalizedPassword = input.password.trim();

  return updateStore(async (store) => {
    let user = findUserByEmail(store, email);
    if (user) {
      const passwordMatches = await verifyPassword(input.password, user.passwordHash);
      if (!passwordMatches) {
        if (input.mode === "signup" && hasRecoverablePasswordPlaceholder(user.passwordHash)) {
          user.passwordHash = await hashPassword(normalizedPassword);
          user.email = email;
          if (isAdminEmail(email) && user.role !== "admin") {
            user.role = "admin";
          }
          user.lastLoginAt = now;
          const session = createSession(user);
          store.sessions = store.sessions
            .filter((item) => new Date(item.expiresAt).getTime() > Date.now())
            .concat(session);
          return { user: publicUser(user), session };
        }
        throw new Error(
          input.mode === "signup"
            ? "An account already exists for this email. Log in instead or reset your password."
            : "Incorrect email or password. Use Forgot password if this account already exists."
        );
      }
      if (!user.passwordHash.includes(":")) {
        user.passwordHash = await hashPassword(normalizedPassword);
      }
      user.email = email;
      if (isAdminEmail(email) && user.role !== "admin") {
        user.role = "admin";
      }
      user.lastLoginAt = now;
      const session = createSession(user);
      store.sessions = store.sessions
        .filter((item) => new Date(item.expiresAt).getTime() > Date.now())
        .concat(session);
      return { user: publicUser(user), session };
    }

    if (input.mode === "login" && input.role !== "admin") {
      throw new Error("Incorrect email or password.");
    }

    user = {
      id: `user-${Date.now()}`,
      role: input.role,
      name: input.name?.trim() || (input.role === "provider" ? "New Provider" : input.role === "admin" ? "Admin" : "New Parent"),
      email,
      phone: input.phone?.trim(),
      location: input.location,
      category: input.category,
      passwordHash: await hashPassword(normalizedPassword),
      createdAt: now,
      lastLoginAt: now,
    };
    store.users.unshift(user);
    if (user.role === "provider") {
      store.providerProfiles[user.id] = createStarterProviderProfile(user, now);
    }
    const session = createSession(user);
    store.sessions.push(session);
    return { user: publicUser(user), session };
  });
}

function createAccountToken(userId: string, type: AccountTokenRecord["type"]) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt);
  expiresAt.setHours(expiresAt.getHours() + (type === "password-reset" ? 1 : 24));

  return {
    token: randomBytes(32).toString("hex"),
    userId,
    type,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function requestEmailVerification(email: string) {
  return updateStore((store) => {
    const user = findUserByEmail(store, email);
    if (!user) return null;
    if (user.emailVerifiedAt) return { token: null, alreadyVerified: true };

    const token = createAccountToken(user.id, "email-verification");
    store.accountTokens = store.accountTokens
      .filter((item) => !(item.userId === user.id && item.type === "email-verification" && !item.usedAt))
      .concat(token);
    return { token: token.token, alreadyVerified: false };
  });
}

export async function verifyEmailToken(token: string) {
  return updateStore((store) => {
    const accountToken = store.accountTokens.find(
      (item) => item.token === token && item.type === "email-verification"
    );
    if (!accountToken || accountToken.usedAt || new Date(accountToken.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    const user = store.users.find((item) => item.id === accountToken.userId);
    if (!user) return null;

    const now = new Date().toISOString();
    user.emailVerifiedAt = now;
    accountToken.usedAt = now;
    return publicUser(user);
  });
}

export async function requestPasswordReset(email: string) {
  return updateStore((store) => {
    const user = findUserByEmail(store, email);
    if (!user) return null;

    const token = createAccountToken(user.id, "password-reset");
    store.accountTokens = store.accountTokens
      .filter((item) => !(item.userId === user.id && item.type === "password-reset" && !item.usedAt))
      .concat(token);
    return { token: token.token };
  });
}

export async function resetPasswordWithToken(token: string, password: string) {
  const passwordHash = await hashPassword(password);
  return updateStore((store) => {
    const accountToken = store.accountTokens.find(
      (item) => item.token === token && item.type === "password-reset"
    );
    if (!accountToken || accountToken.usedAt || new Date(accountToken.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    const user = store.users.find((item) => item.id === accountToken.userId);
    if (!user) return null;

    const now = new Date().toISOString();
    user.passwordHash = passwordHash;
    accountToken.usedAt = now;
    store.revokedSessionTokens = [
      ...new Set([
        ...(store.revokedSessionTokens ?? []),
        ...store.sessions
          .filter((session) => session.userId === user.id)
          .map((session) => session.token),
      ]),
    ];
    store.sessions = store.sessions.filter((session) => session.userId !== user.id);
    return publicUser(user);
  });
}

export async function getSessionByToken(token?: string | null) {
  if (!token) return null;
  const store = await readStore();
  if (store.revokedSessionTokens.includes(token)) return null;
  const signedSession = readSignedSessionToken(token);
  const session = store.sessions.find((item) => item.token === token);
  if (session && new Date(session.expiresAt).getTime() > Date.now()) {
    const user = store.users.find((item) => item.id === session.userId);
    if (user) {
      if (signedSession?.passwordHash && !user.passwordHash.includes(":")) {
        await updateStore((nextStore) => {
          const nextUser = nextStore.users.find((item) => item.id === user.id);
          if (nextUser) nextUser.passwordHash = signedSession.passwordHash ?? nextUser.passwordHash;
        });
        user.passwordHash = signedSession.passwordHash;
      }
      return { session, user: publicUser(user) };
    }
  }

  if (!signedSession) return null;

  await updateStore((nextStore) => {
    if (!nextStore.users.some((item) => item.id === signedSession.user.id)) {
      nextStore.users.unshift({
        ...signedSession.user,
        passwordHash: signedSession.passwordHash ?? "restored-from-signed-session",
      });
    }
    nextStore.sessions = nextStore.sessions
      .filter((item) => new Date(item.expiresAt).getTime() > Date.now())
      .filter((item) => item.token !== token)
      .concat({ token, ...signedSession.session });
    nextStore.revokedSessionTokens = nextStore.revokedSessionTokens.filter(
      (item) => item !== token
    );
  });

  return {
    session: { token, ...signedSession.session },
    user: signedSession.user,
  };
}

export function sessionTokenFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.split("=")[1];
}

export async function getSessionFromRequest(request: Request) {
  const token = sessionTokenFromRequest(request);
  return getSessionByToken(token ? decodeURIComponent(token) : null);
}

export async function revokeSessionToken(token?: string | null) {
  if (!token) return false;
  return updateStore((store) => {
    const decodedToken = decodeURIComponent(token);
    const before = store.sessions.length;
    store.sessions = store.sessions.filter((session) => session.token !== decodedToken);
    store.revokedSessionTokens = [
      ...new Set([...(store.revokedSessionTokens ?? []), decodedToken]),
    ];
    return store.sessions.length !== before;
  });
}

export function isAdminEmail(email: string) {
  const configuredEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return [...BUILT_IN_ADMIN_EMAILS, ...configuredEmails].includes(
    email.trim().toLowerCase()
  );
}

export async function saveParentProfile(
  userId: string,
  input: Omit<ParentProfileRecord, "userId" | "savedAt">
) {
  return updateStore((store) => {
    const user = store.users.find((item) => item.id === userId && item.role === "parent");
    if (!user) throw new Error("Parent account not found.");

    const profile = {
      userId,
      ...input,
      savedAt: new Date().toISOString(),
    };
    user.name = input.fullName;
    user.phone = input.phone;
    user.location = input.location;
    store.parentProfiles[userId] = profile;
    return { profile, user: publicUser(user) };
  });
}

export async function saveProviderProfile(
  userId: string,
  profile: Omit<ProviderProfileRecord, "userId" | "savedAt">
) {
  return updateStore((store) => {
    const existing = store.providerProfiles[userId];
    const record = {
      ...(existing ?? {}),
      ...profile,
      userId,
      verificationPaymentStatus:
        existing?.verificationPaymentStatus ?? profile.verificationPaymentStatus ?? "unpaid",
      verificationFeeAmount: existing?.verificationFeeAmount ?? profile.verificationFeeAmount,
      verificationFeeCurrency:
        existing?.verificationFeeCurrency ?? profile.verificationFeeCurrency,
      verificationFeePaidAt: existing?.verificationFeePaidAt ?? profile.verificationFeePaidAt,
      verificationPaymentReference:
        existing?.verificationPaymentReference ?? profile.verificationPaymentReference,
      verificationPackageId: existing?.verificationPackageId ?? profile.verificationPackageId,
      verificationPackageName:
        existing?.verificationPackageName ?? profile.verificationPackageName,
      savedAt: new Date().toISOString(),
    };
    store.providerProfiles[userId] = record;
    return record;
  });
}

export async function recordVerificationPayment(userId: string, packageId?: string) {
  return updateStore((store) => {
    const user = store.users.find((item) => item.id === userId && item.role === "provider");
    const profile = store.providerProfiles[userId];
    if (!user || !profile) {
      throw new Error("Complete and save your provider profile before paying for verification.");
    }
    if (profile.verificationStatus === "approved") {
      throw new Error("This provider profile is already verified.");
    }
    const selectedPackage = categorySupportsVettingPackages(profile.category)
      ? getVettingPackage(packageId)
      : null;
    if (categorySupportsVettingPackages(profile.category) && !selectedPackage) {
      throw new Error("Choose a Standard or VIP vetting package before paying.");
    }

    profile.verificationPaymentStatus = "paid";
    profile.verificationFeeAmount = selectedPackage?.price ?? VERIFICATION_FEE.amount;
    profile.verificationFeeCurrency = selectedPackage?.currency ?? VERIFICATION_FEE.currency;
    profile.verificationFeePaidAt = new Date().toISOString();
    profile.verificationPaymentReference = `${selectedPackage ? "vetting" : "verify"}-${userId}-${Date.now()}`;
    profile.verificationPackageId = selectedPackage?.id;
    profile.verificationPackageName = selectedPackage?.name;

    return {
      status: profile.verificationPaymentStatus,
      amount: profile.verificationFeeAmount,
      currency: profile.verificationFeeCurrency,
      paidAt: profile.verificationFeePaidAt,
      reference: profile.verificationPaymentReference,
      packageId: profile.verificationPackageId,
      packageName: profile.verificationPackageName,
    };
  });
}

export async function listUploads(userId: string, type?: PlatformUploadRecord["type"]) {
  const store = await readStore();
  return store.uploads
    .filter((upload) => upload.userId === userId && (!type || upload.type === type))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getUploadForUser(id: string, userId: string) {
  const store = await readStore();
  return store.uploads.find((upload) => upload.id === id && upload.userId === userId) ?? null;
}

export async function getPublishedProviderMediaUpload(id: string) {
  const store = await readStore();
  const upload = store.uploads.find(
    (item) =>
      item.id === id &&
      (item.type === "gallery" ||
        item.type === "profile-image" ||
        item.type === "cover-image" ||
        (item.type === "document" && item.documentKey === "company-profile")) &&
      store.providerProfiles[item.userId]?.published
  );
  return upload ?? null;
}

export async function getVerificationUploadForAdmin(id: string) {
  const store = await readStore();
  const upload = store.uploads.find(
    (item) =>
      item.id === id &&
      item.type === "document" &&
      store.verifications.pendingProviders.some(
        (pending) => pending.userId === item.userId
      )
  );
  return upload ?? null;
}

function uploadBlobKey(storagePath: string) {
  return storagePath.startsWith(BLOB_PATH_PREFIX)
    ? storagePath.slice(BLOB_PATH_PREFIX.length)
    : storagePath;
}

export function uploadStoragePath(userId: string, id: string, fileName: string) {
  if (shouldUseNetlifyBlobs()) {
    return `${BLOB_PATH_PREFIX}${UPLOAD_BLOB_PREFIX}${userId}/${id}-${fileName}`;
  }

  return path.join(uploadRootPath, userId, `${id}-${fileName}`);
}

export async function saveUploadFile(storagePath: string, contents: Buffer) {
  if (storagePath.startsWith(BLOB_PATH_PREFIX)) {
    const arrayBuffer = new Uint8Array(contents).buffer;
    await uploadBlobStore().set(uploadBlobKey(storagePath), arrayBuffer);
    return;
  }

  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, contents);
}

export async function readUploadFile(storagePath: string) {
  if (storagePath.startsWith(BLOB_PATH_PREFIX)) {
    const file = await uploadBlobStore().get(uploadBlobKey(storagePath), {
      type: "arrayBuffer",
    });
    return file ? Buffer.from(file as ArrayBuffer) : null;
  }

  return readFile(storagePath).catch(() => null);
}

export async function deleteUploadFile(storagePath: string) {
  if (storagePath.startsWith(BLOB_PATH_PREFIX)) {
    await uploadBlobStore().delete(uploadBlobKey(storagePath));
    return;
  }

  await rm(storagePath, { force: true });
}

export async function recordUpload(upload: PlatformUploadRecord) {
  return updateStore((store) => {
    store.uploads = [
      upload,
      ...store.uploads.filter(
        (item) =>
          !(
            (upload.type === "document" || upload.type === "profile-image" || upload.type === "cover-image") &&
            item.type === upload.type &&
            item.userId === upload.userId &&
            (upload.type === "profile-image" || upload.type === "cover-image" || item.documentKey === upload.documentKey)
          )
      ),
    ];
    return upload;
  });
}

export async function removeUpload(id: string, userId: string) {
  return updateStore((store) => {
    const upload = store.uploads.find((item) => item.id === id && item.userId === userId);
    if (!upload) return null;
    store.uploads = store.uploads.filter((item) => item.id !== id);
    return upload;
  });
}

function providerAccountUserId(provider: Provider) {
  return provider.id.startsWith("account-") ? provider.id.slice("account-".length) : undefined;
}

function userAvatar(name: string) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
}

function buildStoredConversation(
  provider: Provider,
  parentUserId: string,
  parentName: string
): StoredConversation {
  return {
    id: `conversation-${parentUserId}-${provider.id}`,
    parentUserId,
    parentName,
    providerId: provider.id,
    providerUserId: providerAccountUserId(provider),
    providerName: provider.name,
    participant: provider.name,
    participantImage: provider.image,
    lastMessage: "Conversation started",
    timestamp: "now",
    unread: 0,
    unreadForParent: 0,
    unreadForProvider: 0,
    messages: [],
  };
}

function conversationForViewer(conversation: StoredConversation, viewerUserId: string) {
  const viewerIsParent = conversation.parentUserId === viewerUserId;
  return {
    ...conversation,
    participant: viewerIsParent ? conversation.providerName : conversation.parentName,
    participantImage: viewerIsParent
      ? conversation.participantImage
      : userAvatar(conversation.parentName),
    unread: viewerIsParent
      ? conversation.unreadForParent ?? 0
      : conversation.unreadForProvider ?? conversation.unread ?? 0,
    messages: conversation.messages.map((message) => ({
      ...message,
      isOwn: message.senderId === viewerUserId,
    })),
  };
}

export async function getStoredConversations(
  viewerUserId: string,
  viewerRole: UserRole,
  providerId?: string | null
) {
  const store = await readStore();
  const ownedConversations = store.conversations.filter((conversation) =>
    viewerRole === "parent"
      ? conversation.parentUserId === viewerUserId
      : viewerRole === "provider" && conversation.providerUserId === viewerUserId
  );

  if (viewerRole !== "parent" || !providerId) {
    return ownedConversations.map((conversation) =>
      conversationForViewer(conversation, viewerUserId)
    );
  }

  const existing = ownedConversations.find(
    (conversation) => conversation.providerId === providerId
  );
  if (existing) {
    return ownedConversations.map((conversation) =>
      conversationForViewer(conversation, viewerUserId)
    );
  }

  const provider = allProvidersFromStore(store).find((item) => item.id === providerId);
  if (!provider) {
    return ownedConversations.map((conversation) =>
      conversationForViewer(conversation, viewerUserId)
    );
  }

  const parent = store.users.find((user) => user.id === viewerUserId);
  const draft = buildStoredConversation(provider, viewerUserId, parent?.name ?? "Parent");
  return [
    conversationForViewer(draft, viewerUserId),
    ...ownedConversations.map((conversation) =>
      conversationForViewer(conversation, viewerUserId)
    ),
  ];
}

export async function appendConversationMessage(input: {
  viewerUserId: string;
  viewerRole: UserRole;
  conversationId?: string | null;
  text: string;
  providerId?: string | null;
}) {
  return updateStore((store) => {
    if (input.viewerRole === "parent" && input.providerId) {
      const existing = store.conversations.find(
        (conversation) =>
          conversation.parentUserId === input.viewerUserId &&
          conversation.providerId === input.providerId
      );
      const provider = allProvidersFromStore(store).find(
        (item) => item.id === input.providerId
      );
      const parent = store.users.find((user) => user.id === input.viewerUserId);
      if (!existing && provider && parent) {
        store.conversations.unshift(
          buildStoredConversation(provider, input.viewerUserId, parent.name)
        );
      }
    }

    const message: Message = {
      id: randomUUID(),
      senderId: input.viewerUserId,
      text: input.text,
      timestamp: new Date().toISOString(),
      isOwn: true,
    };

    const conversation = store.conversations.find((item) => {
      const ownsConversation =
        input.viewerRole === "parent"
          ? item.parentUserId === input.viewerUserId
          : input.viewerRole === "provider" && item.providerUserId === input.viewerUserId;
      if (!ownsConversation) return false;
      if (input.conversationId && item.id === input.conversationId) return true;
      return (
        input.viewerRole === "parent" &&
        Boolean(input.providerId) &&
        item.providerId === input.providerId
      );
    });
    if (!conversation) return { message, conversation: null };

    conversation.messages.push(message);
    conversation.lastMessage = input.text;
    conversation.timestamp = "now";
    if (input.viewerRole === "parent") {
      conversation.unreadForParent = 0;
      conversation.unreadForProvider = (conversation.unreadForProvider ?? 0) + 1;
      conversation.unread = conversation.unreadForProvider;
    } else {
      conversation.unreadForProvider = 0;
      conversation.unreadForParent = (conversation.unreadForParent ?? 0) + 1;
      conversation.unread = conversation.unreadForParent;
    }
    return {
      message,
      conversation: conversationForViewer(conversation, input.viewerUserId),
    };
  });
}

export async function decideVerification(id: string, action: "approve" | "reject") {
  return updateStore((store) => {
    const pending = store.verifications.pendingProviders.find((item) => item.id === id);
    if (!pending) return store.verifications;

    store.verifications.pendingProviders = store.verifications.pendingProviders.filter(
      (item) => item.id !== id
    );

    if (action === "approve") {
      store.verifications.approvedProviders.unshift({
        id: `approved-${pending.id}`,
        userId: pending.userId,
        name: pending.name,
        category: pending.category,
        verified: true,
        date: new Date().toISOString().slice(0, 10),
      });
    } else {
      store.verifications.rejectedCount += 1;
    }
    if (pending.userId && store.providerProfiles[pending.userId]) {
      store.providerProfiles[pending.userId].verificationStatus =
        action === "approve" ? "approved" : "rejected";
    }

    return store.verifications;
  });
}

export async function submitProviderVerification(userId: string) {
  return updateStore((store) => {
    const user = store.users.find((item) => item.id === userId && item.role === "provider");
    const profile = store.providerProfiles[userId];
    if (!user || !profile) {
      throw new Error("Complete and save your provider profile before submitting verification.");
    }
    if (profile.verificationStatus === "approved") {
      throw new Error("This provider profile is already verified.");
    }
    if (profile.verificationPaymentStatus !== "paid") {
      throw new Error("Pay the verification fee before submitting documents for review.");
    }

    const documents = store.uploads.filter(
      (upload) => upload.userId === userId && upload.type === "document"
    );
    const profileImages = store.uploads.filter(
      (upload) => upload.userId === userId && upload.type === "profile-image"
    );
    const coverImages = store.uploads.filter(
      (upload) => upload.userId === userId && upload.type === "cover-image"
    );
    const galleryImages = store.uploads.filter(
      (upload) => upload.userId === userId && upload.type === "gallery"
    );
    const missingProfileFields = missingVerificationProfileFields(profile, {
      profileImageUploaded: profileImages.length > 0,
      coverImageUploaded: coverImages.length > 0,
      galleryCount: galleryImages.length,
    });
    if (missingProfileFields.length > 0) {
      throw new Error(
        `Complete required verification details before submitting: ${missingProfileFields.join(
          ", "
        )}.`
      );
    }
    const missingDocuments = missingVerificationDocuments(
      profile.category,
      documents.map((document) => document.documentKey ?? "")
    );
    if (missingDocuments.length > 0) {
      throw new Error(
        `Upload required verification documents before submitting: ${missingDocuments
          .map((document) => document.label)
          .join(", ")}.`
      );
    }

    const existing = store.verifications.pendingProviders.find(
      (item) => item.userId === userId
    );
    const submission: PendingVerification = {
      id: existing?.id ?? `provider-${userId}`,
      userId,
      name: profile.displayName || user.name,
      category: getCategoryLabel(profile.category),
      location: profile.location || user.location || "Botswana",
      submittedDate: new Date().toISOString().slice(0, 10),
      documents: documents.map((document) => document.label),
      image: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        profile.displayName || user.name
      )}`,
      status: "pending",
    };
    store.verifications.pendingProviders = [
      submission,
      ...store.verifications.pendingProviders.filter((item) => item.userId !== userId),
    ];
    profile.verificationStatus = "pending";
    return submission;
  });
}
