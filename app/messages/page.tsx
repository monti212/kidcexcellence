"use client";

import {
  useRef,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Conversation, Provider } from "@/lib/mock-data";
import { getProviderById } from "@/lib/platform-service";
import { usePlatformSession } from "@/lib/use-platform-session";
import { Icon } from "@/components/kidcellence/Icon";
import { routes } from "@/lib/kidcellence/routes";
import { initialsOf, providerTint } from "@/lib/kidcellence/provider-display";
import { clsx } from "clsx";

// Height of the sticky site header; the messages view fills the rest of the screen.
const VIEW_HEIGHT = "calc(100dvh - 4.25rem)";

const panel = {
  background: "#ffffff",
  borderRadius: 24,
  boxShadow: "0 6px 20px rgba(63,62,68,.06)",
} as const;

// Messages store ISO timestamps; older records may hold display text such as "now".
function formatMessageTime(value: string) {
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(date.getTime())) return value;
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ConversationAvatar({ image, name, seed, size = 48 }: { image?: string; name: string; seed: string; size?: number }) {
  // Only the participant's own uploaded photo is shown; generated placeholders
  // are replaced by the design's initials circle.
  const photo = image?.startsWith("/api/uploads/") ? image : null;
  return (
    <span
      aria-hidden="true"
      style={{ flex: "0 0 auto", width: size, height: size, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size > 40 ? 16 : 13, color: "#3f3e44", background: providerTint(seed) }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served by our own API route
        <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initialsOf(name)
      )}
    </span>
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
  // The id of a send that has not succeeded yet. Retrying the same text reuses
  // it, so a send whose response was lost cannot be stored twice.
  const pendingSendRef = useRef<{ text: string; id: string } | null>(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [loadedProvider, setLoadedProvider] = useState<Provider | undefined>(() =>
    providerId ? getProviderById(providerId) : undefined
  );
  const provider = providerId ? loadedProvider : undefined;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

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
  const showProviderChatHint =
    mounted && !loading && session?.role === "provider" && Boolean(providerId);
  const canSendMessage = Boolean(session) && !showProviderChatHint;
  const viewerIsProvider = session?.role === "provider";

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [activeConv?.messages.length, activeConversationId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || (!activeConversationId && !provider?.id)) return;
    if (!session) {
      setSendError("Sign in to send messages to providers.");
      return;
    }
    if (showProviderChatHint) {
      setSendError("Use a parent account to start enquiries with providers.");
      return;
    }
    const messageText = newMessage;
    const clientMessageId =
      pendingSendRef.current?.text === messageText
        ? pendingSendRef.current.id
        : crypto.randomUUID();
    pendingSendRef.current = { text: messageText, id: clientMessageId };
    setNewMessage("");
    setSendError("");
    setSending(true);
    const response = await fetch("/api/messages", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: activeConversationId ?? undefined,
        providerId: provider?.id,
        text: messageText,
        clientMessageId,
      }),
    }).catch(() => null);
    setSending(false);
    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setNewMessage(messageText);
      setSendError(payload?.error ?? "Could not send message.");
      return;
    }

    pendingSendRef.current = null;
    const payload = await response.json();
    setConversations((current) => [
      payload.conversation,
      ...current.filter((conversation) => conversation.id !== payload.conversation.id),
    ]);
    setActiveConversationId(payload.conversation.id);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage();
  };

  const listHiddenOnPhone = Boolean(activeConversationId || showSignInPrompt || showProviderChatHint);
  const threadHiddenOnPhone = !activeConversationId && !showSignInPrompt;
  const sendDisabled = !newMessage.trim() || loading || !canSendMessage || sending;

  return (
    <div style={{ background: "#f4fbfc", color: "#3f3e44" }}>
      <div
        className="mx-auto flex max-w-[1280px] gap-5 p-3 sm:p-6"
        style={{ height: VIEW_HEIGHT, minHeight: 480 }}
      >
        {/* Conversations */}
        <section
          aria-label="Conversations"
          className={clsx(
            "w-full shrink-0 flex-col sm:w-80",
            listHiddenOnPhone ? "hidden sm:flex" : "flex"
          )}
          style={{ ...panel, padding: 18, gap: 8, minWidth: 0, overflow: "hidden" }}
        >
          <h1 style={{ margin: "4px 6px 0", fontSize: 24, fontWeight: 800 }}>
            {viewerIsProvider ? "Enquiries" : "Messages"}
          </h1>
          {session && (
            <p style={{ margin: "0 6px 6px", fontSize: 13, color: "#686973" }}>
              {viewerIsProvider ? "Signed in as a provider" : "Signed in as a parent"}
            </p>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 8, background: "#f4fbfc", borderRadius: 14, padding: "10px 14px", marginBottom: 4 }}>
            <Icon name="search" size={18} color="#686973" />
            <input
              type="text"
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search conversations..."
              aria-label="Search conversations"
              style={{ border: 0, outline: 0, background: "transparent", fontSize: 15, flex: 1, minWidth: 0, color: "#3f3e44" }}
            />
          </label>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, minHeight: 0 }}>
            {visibleConversations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 12px", color: "#686973" }}>
                <Icon name="message" size={36} color="#9fb9bd" style={{ margin: "0 auto 8px", display: "block" }} />
                <p style={{ margin: 0, fontSize: 14 }}>
                  {conversationSearch ? "No matching conversations" : "No conversations yet"}
                </p>
              </div>
            ) : (
              visibleConversations.map((conv) => {
                const current = activeConversationId === conv.id;
                const unread = conv.unread > 0;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setActiveConversationId(conv.id)}
                    aria-current={current ? "true" : undefined}
                    style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 16, border: 0, width: "100%", textAlign: "left", color: "#3f3e44", background: current ? "#f4fbfc" : "#ffffff" }}
                  >
                    <ConversationAvatar image={conv.participantImage} name={conv.participant} seed={conv.providerId ?? conv.id} />
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <strong style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conv.participant}</strong>
                        <span style={{ fontSize: 12, color: "#686973", flexShrink: 0 }}>{formatMessageTime(conv.timestamp)}</span>
                      </span>
                      <span style={{ fontSize: 13, color: "#686973", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: unread ? 800 : 500 }}>
                        {conv.lastMessage || "No messages yet"}
                      </span>
                    </span>
                    {unread && (
                      <span
                        aria-label={`${conv.unread} unread`}
                        style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "#c2412a", color: "#ffffff", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
                      >
                        {conv.unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Thread */}
        <section
          aria-label="Conversation"
          className={clsx("min-w-0 flex-1 flex-col", threadHiddenOnPhone ? "hidden sm:flex" : "flex")}
          style={{ ...panel, overflow: "hidden" }}
        >
          {activeConv ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #d7edf0" }}>
                <button
                  type="button"
                  className="flex items-center justify-center sm:hidden"
                  onClick={() => setActiveConversationId(null)}
                  aria-label="Back to conversations"
                  style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid #d7edf0", background: "#ffffff", flexShrink: 0 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3f3e44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                </button>
                <ConversationAvatar image={activeConv.participantImage} name={activeConv.participant} seed={activeConv.providerId ?? activeConv.id} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <strong style={{ fontSize: 17, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeConv.participant}</strong>
                  <span style={{ fontSize: 13, color: "#2a7b86", fontWeight: 700 }}>
                    {viewerIsProvider ? "Parent enquiry" : "Direct conversation"}
                  </span>
                </span>
                {!viewerIsProvider && activeConv.providerId && (
                  <Link
                    href={routes.provider(activeConv.providerId)}
                    className="hidden sm:inline-flex"
                    style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #d7edf0", fontWeight: 700, fontSize: 14, textDecoration: "none", color: "#3f3e44", flexShrink: 0 }}
                  >
                    View profile
                  </Link>
                )}
              </div>

              <div aria-live="polite" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 12, background: "#f4fbfc" }}>
                {activeConv.messages.length === 0 && (
                  <p style={{ alignSelf: "center", margin: "auto 0", fontSize: 14, color: "#686973", textAlign: "center", maxWidth: 320 }}>
                    {viewerIsProvider
                      ? "No messages in this conversation yet."
                      : `Introduce yourself to ${activeConv.participant} and say what care you need.`}
                  </p>
                )}
                {activeConv.messages.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", justifyContent: msg.isOwn ? "flex-end" : "flex-start" }}>
                    <div
                      style={{
                        maxWidth: "min(80%, 520px)",
                        background: msg.isOwn ? "#2a7b86" : "#ffffff",
                        color: msg.isOwn ? "#ffffff" : "#3f3e44",
                        padding: "12px 16px",
                        borderRadius: msg.isOwn ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                        fontSize: 15,
                        lineHeight: 1.5,
                        boxShadow: "0 2px 8px rgba(63,62,68,.06)",
                        overflowWrap: "anywhere",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.text}
                      <div style={{ fontSize: 12, marginTop: 4, textAlign: msg.isOwn ? "right" : "left", color: msg.isOwn ? "rgba(255,255,255,.75)" : "#686973" }}>
                        {formatMessageTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={threadEndRef} />
              </div>

              <form onSubmit={handleSubmit} style={{ padding: "14px 16px", borderTop: "1px solid #d7edf0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <label style={{ flex: 1, minWidth: 0, display: "flex" }}>
                    <span className="kc-sr-only">Message</span>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      placeholder="Type a message..."
                      disabled={!canSendMessage}
                      maxLength={2000}
                      style={{ flex: 1, minWidth: 0, fontSize: 15, padding: "13px 16px", borderRadius: 999, border: "1px solid #d7edf0", background: "#f4fbfc", outline: 0, color: "#3f3e44" }}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={sendDisabled}
                    aria-label="Send message"
                    style={{ fontWeight: 800, fontSize: 15, padding: "0 22px", minHeight: 46, borderRadius: 999, border: 0, background: sendDisabled ? "#9fb9bd" : "#2a7b86", color: "#ffffff", flexShrink: 0 }}
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
                {sendError && (
                  <p role="alert" style={{ margin: "10px 0 0", borderRadius: 12, background: "#fff5d3", padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#c2412a" }}>
                    {sendError}
                  </p>
                )}
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "32px 24px", gap: 10, background: "#f4fbfc" }}>
              <span style={{ width: 80, height: 80, borderRadius: "50%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(63,62,68,.06)", marginBottom: 6 }}>
                <Icon name="message" size={36} color="#2a7b86" />
              </span>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
                {showSignInPrompt
                  ? "Sign in to message providers"
                  : showProviderChatHint
                    ? "Provider enquiries start from parent accounts"
                    : "Your Messages"}
              </h2>
              <p style={{ margin: 0, maxWidth: 340, fontSize: 15, lineHeight: 1.55, color: "#686973" }}>
                {showSignInPrompt
                  ? "Use a parent account to start a private provider enquiry."
                  : showProviderChatHint
                    ? "Providers can reply to enquiries from this inbox once a parent starts a conversation."
                    : "Select a conversation from the sidebar, or browse providers to start messaging."}
              </p>
              <Link
                href={showSignInPrompt ? routes.login : showProviderChatHint ? routes.messages : routes.browse}
                className="kc-btn"
                style={{ marginTop: 12 }}
              >
                {showSignInPrompt ? "Sign in" : showProviderChatHint ? "Open inbox" : "Browse providers"}
              </Link>
            </div>
          )}
        </section>

        {/* Context: static guidance only, shown on wide screens */}
        <aside className="hidden w-[260px] shrink-0 flex-col gap-4 xl:flex" style={{ minWidth: 0 }}>
          {viewerIsProvider ? (
            <div style={{ background: "#fff5d3", borderRadius: 24, padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Reply fast</h2>
              <p style={{ margin: 0, fontSize: 14, color: "#686973", lineHeight: 1.5 }}>
                Parents usually contact several providers. A same-day reply wins more work.
              </p>
            </div>
          ) : (
            <div style={{ background: "#fff5d3", borderRadius: 24, padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Want a deeper check?</h2>
              <p style={{ margin: 0, fontSize: 14, color: "#686973", lineHeight: 1.5 }}>
                Our Vet With Us packages check a nanny or helper before you hire.
              </p>
              <Link href={routes.pricing} style={{ fontWeight: 800, fontSize: 14, color: "#2a7b86" }}>See vetting packages</Link>
            </div>
          )}
          <div style={{ ...panel, padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Stay safe</h2>
            <p style={{ margin: 0, fontSize: 14, color: "#686973", lineHeight: 1.5 }}>
              Meet in person before you hire. Never pay a deposit before you have met.
            </p>
            <Link href={routes.safety} style={{ fontWeight: 800, fontSize: 14, color: "#2a7b86" }}>Safety guidance</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ height: VIEW_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", background: "#f4fbfc", color: "#686973" }}>
          Loading messages...
        </div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}
