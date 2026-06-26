import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
import { CONVERSATIONS, type Conversation, type Message } from "@/lib/mock-data";
import {
  APPROVED_VERIFICATIONS,
  PENDING_VERIFICATIONS,
  buildProviderConversation,
  getProviderById,
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

export interface ChildProfile {
  id: string;
  name: string;
  dob: string;
  specialNeeds: string;
}

export interface ParentProfileRecord {
  userId: string;
  children: ChildProfile[];
  savedAt: string;
}

export interface ProviderProfileRecord {
  userId: string;
  category: string;
  liveIn: boolean;
  feeRows: Array<{
    grade: string;
    termly: string;
    annually: string;
  }>;
  savedAt: string;
}

export interface PlatformStore {
  users: PlatformUser[];
  sessions: PlatformSession[];
  parentProfiles: Record<string, ParentProfileRecord>;
  providerProfiles: Record<string, ProviderProfileRecord>;
  conversations: Conversation[];
  verifications: {
    pendingProviders: PendingVerification[];
    approvedProviders: ApprovedVerification[];
    rejectedCount: number;
  };
}

const storePath =
  process.env.PLATFORM_STORE_PATH ??
  path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "platform-store.json");
const scrypt = promisify(scryptCallback);

function createInitialStore(): PlatformStore {
  return {
    users: [],
    sessions: [],
    parentProfiles: {},
    providerProfiles: {},
    conversations: CONVERSATIONS,
    verifications: {
      pendingProviders: PENDING_VERIFICATIONS,
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
  return {
    users: store.users ?? initial.users,
    sessions: store.sessions ?? initial.sessions,
    parentProfiles: store.parentProfiles ?? initial.parentProfiles,
    providerProfiles: store.providerProfiles ?? initial.providerProfiles,
    conversations: store.conversations ?? initial.conversations,
    verifications: {
      pendingProviders:
        store.verifications?.pendingProviders ?? initial.verifications.pendingProviders,
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

export async function saveParentProfile(userId: string, children: ChildProfile[]) {
  return updateStore((store) => {
    const profile = {
      userId,
      children,
      savedAt: new Date().toISOString(),
    };
    store.parentProfiles[userId] = profile;
    return profile;
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

export async function getStoredConversations(providerId?: string | null) {
  const store = await readStore();
  if (!providerId) return store.conversations;

  const provider = getProviderById(providerId);
  if (!provider) return store.conversations;
  if (store.conversations.some((conversation) => conversation.participant === provider.name)) {
    return store.conversations;
  }

  return [buildProviderConversation(provider), ...store.conversations];
}

export async function appendConversationMessage(input: {
  conversationId: string;
  text: string;
  providerId?: string | null;
}) {
  return updateStore((store) => {
    if (
      input.providerId &&
      !store.conversations.some((conversation) => conversation.id === input.conversationId)
    ) {
      const provider = getProviderById(input.providerId);
      if (provider) store.conversations.unshift(buildProviderConversation(provider));
    }

    const message: Message = {
      id: `msg-${Date.now()}`,
      senderId: "parent",
      text: input.text,
      timestamp: new Date().toISOString(),
      isOwn: true,
    };

    const conversation = store.conversations.find(
      (item) => item.id === input.conversationId
    );
    if (!conversation) return { message, conversation: null };

    conversation.messages.push(message);
    conversation.lastMessage = input.text;
    conversation.timestamp = "now";
    conversation.unread = 0;
    return { message, conversation };
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
        name: pending.name,
        category: pending.category,
        verified: true,
        date: new Date().toISOString().slice(0, 10),
      });
    } else {
      store.verifications.rejectedCount += 1;
    }

    return store.verifications;
  });
}
