"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Conversation, Provider } from "@/lib/mock-data";
import {
  getCategoryIcon,
  getProviderById,
  getProviderByName,
} from "@/lib/platform-service";
import { usePlatformSession } from "@/lib/use-platform-session";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";
import { clsx } from "clsx";

function ConversationAvatar({ name }: { name: string }) {
  const provider = getProviderByName(name);
  const icon = provider ? getCategoryIcon(provider.category) : "💬";

  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--brand-line)] bg-[var(--brand-ivory)] text-xl">
      {icon}
    </div>
  );
}

const subscribeToHydration = () => () => {};

function MessagesPageContent() {
  const searchParams = useSearchParams();
  const { session, loading } = usePlatformSession();
  const providerId = searchParams.get("provider");
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const [newMessage, setNewMessage] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [sendError, setSendError] = useState("");
  const [loadedProvider, setLoadedProvider] = useState<Provider | undefined>(() =>
    providerId ? getProviderById(providerId) : undefined
  );
  const provider = providerId ? loadedProvider : undefined;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId) return;

    const loadProvider = async () => {
      const response = await fetch(`/api/providers/${encodeURIComponent(providerId)}`, {
        cache: "no-store",
      }).catch(() => null);
      if (!response?.ok) return;
      const payload = await response.json();
      setLoadedProvider(payload.provider);
    };
    void loadProvider();
  }, [providerId]);

  const refreshConversations = useCallback(async () => {
    const params = provider?.id ? `?provider=${encodeURIComponent(provider.id)}` : "";
    const response = await fetch(`/api/messages${params}`, {
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return;

    const payload = await response.json();
    if (!Array.isArray(payload.conversations)) return;

    setConversations(payload.conversations);
    if (provider) {
      const providerConversation = payload.conversations.find(
        (conversation: Conversation) => conversation.providerId === provider.id
      );
      setActiveConversationId(providerConversation?.id ?? null);
    }
  }, [provider]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      refreshConversations();
    }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshConversations]);

  const activeConv = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversations]
  );
  const visibleConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    return query
      ? conversations.filter((conversation) =>
          conversation.participant.toLowerCase().includes(query)
        )
      : conversations;
  }, [conversationSearch, conversations]);
  const showSignInPrompt = mounted && !loading && !session && Boolean(providerId);

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversationId) return;
    if (!session) {
      setSendError("Sign in to send messages to providers.");
      return;
    }
    const messageText = newMessage;
    setNewMessage("");
    setSendError("");
    const response = await fetch("/api/messages", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: activeConversationId,
        providerId: provider?.id,
        text: messageText,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setNewMessage(messageText);
      setSendError(payload?.error ?? "Could not send message.");
      return;
    }

    const payload = await response.json();
    setConversations((current) => [
      payload.conversation,
      ...current.filter((conversation) => conversation.id !== payload.conversation.id),
    ]);
    setActiveConversationId(payload.conversation.id);
  };

  return (
    <div className="brand-page flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div
        className={clsx(
          "w-full sm:w-80 shrink-0 bg-white border-r border-[var(--brand-line)] flex flex-col",
          (activeConversationId || showSignInPrompt) && "hidden sm:flex"
        )}
      >
        <div className="border-b border-[var(--brand-line)] p-5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[var(--brand-leaf)]" />
            <h1 className="text-xl font-black text-[var(--brand-ink)]">Messages</h1>
          </div>
          <Input
            placeholder="Search conversations..."
            value={conversationSearch}
            onChange={(event) => setConversationSearch(event.target.value)}
            className="mt-3 rounded-lg border-[var(--brand-line)] bg-[var(--brand-ivory)] text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {visibleConversations.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {conversationSearch ? "No matching conversations" : "No conversations yet"}
              </p>
            </div>
          ) : (
            visibleConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={clsx(
                  "w-full flex items-start gap-3 p-4 hover:bg-[var(--brand-ivory)] transition-colors text-left border-b border-[var(--brand-line)]",
                  activeConversationId === conv.id && "bg-[var(--brand-ivory)]"
                )}
              >
                <ConversationAvatar name={conv.participant} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="truncate text-sm font-black text-[var(--brand-ink)]">{conv.participant}</span>
                    <span className="text-xs text-gray-400 shrink-0">{conv.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 truncate text-xs text-[var(--brand-muted)]">{conv.lastMessage}</p>
                    {conv.unread > 0 && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-coral)] text-xs font-black text-white"
                      >
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat */}
      <div
        className={clsx(
          "flex-1 flex flex-col min-w-0",
          !activeConversationId && !showSignInPrompt && "hidden sm:flex"
        )}
      >
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b border-[var(--brand-line)] bg-white px-5 py-4 shadow-sm">
              <button
                className="sm:hidden p-1 rounded-lg hover:bg-gray-100"
                onClick={() => setActiveConversationId(null)}
                aria-label="Back to conversations"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <ConversationAvatar name={activeConv.participant} />
              <div>
                <div className="text-sm font-black text-[var(--brand-ink)]">{activeConv.participant}</div>
                <div className="text-xs font-black text-[var(--brand-leaf)]">Secure conversation</div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {activeConv.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={clsx(
                    "flex gap-2",
                    msg.isOwn ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {!msg.isOwn && (
                    <ConversationAvatar name={activeConv.participant} />
                  )}
                  <div
                    className={clsx(
                      "max-w-xs sm:max-w-sm lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      msg.isOwn
                        ? "bg-[var(--brand-leaf)] text-white rounded-br-sm"
                        : "bg-white text-[var(--brand-ink)] border border-[var(--brand-line)] rounded-bl-sm shadow-sm"
                    )}
                  >
                    {msg.text}
                    <div
                      className={clsx(
                        "text-xs mt-1",
                        msg.isOwn ? "text-white/70 text-right" : "text-gray-400"
                      )}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-[var(--brand-line)] bg-white px-5 py-4">
              <div className="flex gap-3 items-center">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  className="rounded-lg border-[var(--brand-line)] bg-[var(--brand-ivory)] focus-visible:ring-[var(--brand-leaf)]"
                />
                <Button
                  onClick={sendMessage}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-leaf)] p-0 text-white hover:bg-[var(--brand-ink)]"
                  disabled={!newMessage.trim() || loading}
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {sendError && (
                <div className="mt-3 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-3 py-2 text-xs font-bold text-[var(--brand-coral)]">
                  {sendError}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-center px-6">
            <div
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-white shadow-sm"
            >
              <MessageSquare className="h-10 w-10 text-[var(--brand-leaf)]" />
            </div>
            <h2 className="mb-2 text-xl font-black text-[var(--brand-ink)]">
              {showSignInPrompt ? "Sign in to message providers" : "Your Messages"}
            </h2>
            <p className="max-w-xs text-sm text-[var(--brand-muted)]">
              {showSignInPrompt
                ? "Use a parent account to start a private provider enquiry."
                : "Select a conversation from the sidebar, or browse providers to start messaging."}
            </p>
            <Link href={showSignInPrompt ? "/auth" : "/search"}>
              <Button className="mt-6 rounded-lg bg-[var(--brand-leaf)] text-white hover:bg-[var(--brand-ink)]">
                {showSignInPrompt ? "Sign in" : "Browse providers"}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="brand-page flex h-[calc(100vh-4rem)] items-center justify-center text-[var(--brand-muted)]">Loading messages...</div>}>
      <MessagesPageContent />
    </Suspense>
  );
}
