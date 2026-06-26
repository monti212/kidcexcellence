"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Conversation } from "@/lib/mock-data";
import {
  buildProviderConversation,
  getCategoryIcon,
  getConversations,
  getProviderById,
  getProviderByName,
} from "@/lib/platform-service";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
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

function MessagesPageContent() {
  const searchParams = useSearchParams();
  const { session, loading } = usePlatformSession();
  const providerId = searchParams.get("provider");
  const [newMessage, setNewMessage] = useState("");
  const [sendError, setSendError] = useState("");
  const provider = providerId ? getProviderById(providerId) : undefined;
  const initialConversationId = provider ? `provider-${provider.id}` : null;
  const initialConversations = useMemo(() => {
    return getConversations(provider?.id);
  }, [provider]);
  const [conversations, setConversations] = useLocalStorageState<Conversation[]>(
    "kidcexcellence.conversations",
    initialConversations,
    (value): value is Conversation[] => Array.isArray(value)
  );
  const effectiveConversations = useMemo(() => {
    const providerConversation = provider
      ? conversations.find((conversation) => conversation.participant === provider.name) ?? buildProviderConversation(provider)
      : undefined;

    return providerConversation && !conversations.some((conversation) => conversation.id === providerConversation.id)
      ? [providerConversation, ...conversations]
      : conversations;
  }, [conversations, provider]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    if (!provider) return null;
    const existing = effectiveConversations.find((conversation) => conversation.participant === provider.name);
    return existing?.id ?? initialConversationId;
  });

  const activeConv = useMemo(
    () => effectiveConversations.find((c) => c.id === activeConversationId),
    [activeConversationId, effectiveConversations]
  );

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
    const message = payload.message;

    setConversations((prev) =>
      (prev.some((conversation) => conversation.id === activeConversationId)
        ? prev
        : activeConv
          ? [activeConv, ...prev]
          : prev
      ).map((conv) =>
        conv.id === activeConversationId
          ? {
              ...conv,
              lastMessage: messageText,
              timestamp: "now",
              unread: 0,
              messages: [...conv.messages, message],
            }
          : conv
      )
    );
  };

  return (
    <div className="brand-page flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div
        className={clsx(
          "w-full sm:w-80 shrink-0 bg-white border-r border-[var(--brand-line)] flex flex-col",
          activeConversationId && "hidden sm:flex"
        )}
      >
        <div className="border-b border-[var(--brand-line)] p-5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[var(--brand-leaf)]" />
            <h1 className="text-xl font-black text-[var(--brand-ink)]">Messages</h1>
          </div>
          <Input
            placeholder="Search conversations..."
            className="mt-3 rounded-lg border-[var(--brand-line)] bg-[var(--brand-ivory)] text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {effectiveConversations.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            effectiveConversations.map((conv) => (
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
          !activeConversationId && "hidden sm:flex"
        )}
      >
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b border-[var(--brand-line)] bg-white px-5 py-4 shadow-sm">
              <button
                className="sm:hidden p-1 rounded-lg hover:bg-gray-100"
                onClick={() => setActiveConversationId(null)}
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <ConversationAvatar name={activeConv.participant} />
              <div>
                <div className="text-sm font-black text-[var(--brand-ink)]">{activeConv.participant}</div>
                <div className="text-xs font-black text-[var(--brand-leaf)]">Online</div>
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
            <h2 className="mb-2 text-xl font-black text-[var(--brand-ink)]">Your Messages</h2>
            <p className="max-w-xs text-sm text-[var(--brand-muted)]">
              Select a conversation from the sidebar, or browse providers to start messaging.
            </p>
            <Button
              className="mt-6 rounded-lg bg-[var(--brand-leaf)] text-white hover:bg-[var(--brand-ink)]"
              onClick={() => setActiveConversationId("conv1")}
            >
              Open a Conversation
            </Button>
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
