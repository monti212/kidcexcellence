import { mkdir, readFile, writeFile } from "node:fs/promises";
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

export type UserRole = "parent" | "provider";

export interface PlatformUser {
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
  parentProfiles: Record<string, ParentProfileRecord>;
  providerProfiles: Record<string, ProviderProfileRecord>;
  conversations: Conversation[];
  verifications: {
    pendingProviders: PendingVerification[];
    approvedProviders: ApprovedVerification[];
    rejectedCount: number;
  };
}

const storePath = path.join(process.cwd(), "data", "platform-store.json");

function createInitialStore(): PlatformStore {
  return {
    users: [],
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

export async function createOrLoginUser(input: {
  mode: "signup" | "login";
  role: UserRole;
  name?: string;
  email: string;
  phone?: string;
  location?: string;
  category?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();

  return updateStore((store) => {
    let user = store.users.find((item) => item.email === email);
    if (user) {
      user.lastLoginAt = now;
      user.role = input.mode === "signup" ? input.role : user.role;
      return user;
    }

    user = {
      id: `user-${Date.now()}`,
      role: input.role,
      name: input.name?.trim() || (input.role === "provider" ? "New Provider" : "New Parent"),
      email,
      phone: input.phone?.trim(),
      location: input.location,
      category: input.category,
      createdAt: now,
      lastLoginAt: now,
    };
    store.users.unshift(user);
    return user;
  });
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
