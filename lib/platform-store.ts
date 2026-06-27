import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
import { type Conversation, type Message, type Provider } from "@/lib/mock-data";
import {
  APPROVED_VERIFICATIONS,
  allProvidersFromStore,
  getCategoryLabel,
  type ApprovedVerification,
  type PendingVerification,
} from "@/lib/platform-service";

export type UserRole = "parent" | "provider" | "admin";
export const SESSION_COOKIE_NAME = "kidcexcellence_session";

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
  liveIn: boolean;
  published: boolean;
  verificationStatus: "not_submitted" | "pending" | "approved" | "rejected";
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
  type: "document" | "gallery";
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
}

export interface PlatformStore {
  users: PlatformUser[];
  sessions: PlatformSession[];
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

const storePath =
  process.env.PLATFORM_STORE_PATH ??
  path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "platform-store.json");
export const uploadRootPath =
  process.env.PLATFORM_UPLOADS_DIR ??
  path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "uploads");
const scrypt = promisify(scryptCallback);

function createInitialStore(): PlatformStore {
  return {
    users: [],
    sessions: [],
    accountTokens: [],
    parentProfiles: {},
    providerProfiles: {},
    uploads: [],
    conversations: [],
    verifications: {
      pendingProviders: [],
      approvedProviders: APPROVED_VERIFICATIONS,
      rejectedCount: 0,
    },
  };
}

async function persistStore(store: PlatformStore) {
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
        published: profile.published ?? false,
        verificationStatus: profile.verificationStatus ?? "not_submitted",
      },
    ])
  );
  return {
    users: store.users ?? initial.users,
    sessions: store.sessions ?? initial.sessions,
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
        store.verifications?.approvedProviders ?? initial.verifications.approvedProviders,
      rejectedCount: store.verifications?.rejectedCount ?? initial.verifications.rejectedCount,
    },
  };
}

export async function readStore(): Promise<PlatformStore> {
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

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function createSession(user: PlatformUser): PlatformSession {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + 30);

  return {
    token: randomUUID(),
    userId: user.id,
    role: user.role,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
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
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);

  return updateStore(async (store) => {
    let user = store.users.find((item) => item.email === email);
    if (user) {
      if (input.mode === "signup") {
        throw new Error("An account already exists for this email.");
      }
      const passwordMatches = await verifyPassword(input.password, user.passwordHash);
      if (!passwordMatches) {
        throw new Error("Incorrect email or password.");
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
      passwordHash,
      createdAt: now,
      lastLoginAt: now,
    };
    store.users.unshift(user);
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
  const normalizedEmail = email.trim().toLowerCase();
  return updateStore((store) => {
    const user = store.users.find((item) => item.email === normalizedEmail);
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
  const normalizedEmail = email.trim().toLowerCase();
  return updateStore((store) => {
    const user = store.users.find((item) => item.email === normalizedEmail);
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
    store.sessions = store.sessions.filter((session) => session.userId !== user.id);
    return publicUser(user);
  });
}

export async function getSessionByToken(token?: string | null) {
  if (!token) return null;
  const store = await readStore();
  const session = store.sessions.find((item) => item.token === token);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  const user = store.users.find((item) => item.id === session.userId);
  if (!user) return null;
  return { session, user: publicUser(user) };
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
    return store.sessions.length !== before;
  });
}

export function isAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
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
    const record = {
      ...profile,
      userId,
      savedAt: new Date().toISOString(),
    };
    store.providerProfiles[userId] = record;
    return record;
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

export async function recordUpload(upload: PlatformUploadRecord) {
  return updateStore((store) => {
    store.uploads = [
      upload,
      ...store.uploads.filter(
        (item) =>
          !(
            upload.type === "document" &&
            item.userId === upload.userId &&
            item.documentKey === upload.documentKey
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
    messages: [],
  };
}

function conversationForViewer(conversation: StoredConversation, viewerUserId: string) {
  const viewerIsParent = conversation.parentUserId === viewerUserId;
  return {
    ...conversation,
    participant: viewerIsParent ? conversation.providerName : conversation.parentName,
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
  conversationId: string;
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

    const conversation = store.conversations.find(
      (item) =>
        item.id === input.conversationId &&
        (input.viewerRole === "parent"
          ? item.parentUserId === input.viewerUserId
          : input.viewerRole === "provider" && item.providerUserId === input.viewerUserId)
    );
    if (!conversation) return { message, conversation: null };

    conversation.messages.push(message);
    conversation.lastMessage = input.text;
    conversation.timestamp = "now";
    conversation.unread = 0;
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

    const documents = store.uploads.filter(
      (upload) => upload.userId === userId && upload.type === "document"
    );
    const hasIdentity = documents.some((document) =>
      ["national-id", "certified-id"].includes(document.documentKey ?? "")
    );
    if (!hasIdentity || documents.length < 2) {
      throw new Error(
        "Upload an identity document and at least one supporting document before submitting."
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
