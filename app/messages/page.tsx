"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONVERSATIONS } from "@/lib/mock-data";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";
import { clsx } from "clsx";

export default function MessagesPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [conversations, setConversations] = useState(CONVERSATIONS);

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  const sendMessage = () => {
    if (!newMessage.trim() || !activeConversationId) return;
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeConversationId
          ? {
              ...conv,
              lastMessage: newMessage,
              timestamp: "now",
              unread: 0,
              messages: [
                ...conv.messages,
                {
                  id: `new-${Date.now()}`,
                  senderId: "parent",
                  text: newMessage,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  isOwn: true,
                },
              ],
            }
          : conv
      )
    );
    setNewMessage("");
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-[#FAFAF9] flex overflow-hidden">
      {/* Sidebar */}
      <div
        className={clsx(
          "w-full sm:w-80 shrink-0 bg-white border-r border-gray-100 flex flex-col",
          activeConversationId && "hidden sm:flex"
        )}
      >
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" style={{ color: "#7C3AED" }} />
            <h1 className="text-xl font-bold text-gray-900">Messages</h1>
          </div>
          <Input
            placeholder="Search conversations..."
            className="mt-3 rounded-xl border-gray-200 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={clsx(
                  "w-full flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b border-gray-50",
                  activeConversationId === conv.id && "bg-purple-50"
                )}
              >
                <Image
                  src={conv.participantImage}
                  alt={conv.participant}
                  width={44}
                  height={44}
                  className="rounded-full border border-gray-100 shrink-0 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm truncate">{conv.participant}</span>
                    <span className="text-xs text-gray-400 shrink-0">{conv.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-gray-500 text-xs truncate flex-1">{conv.lastMessage}</p>
                    {conv.unread > 0 && (
                      <span
                        className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center shrink-0 font-semibold"
                        style={{ background: "#7C3AED" }}
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
            <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3 shadow-sm">
              <button
                className="sm:hidden p-1 rounded-lg hover:bg-gray-100"
                onClick={() => setActiveConversationId(null)}
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <Image
                src={activeConv.participantImage}
                alt={activeConv.participant}
                width={40}
                height={40}
                className="rounded-full border border-gray-100 object-cover"
              />
              <div>
                <div className="font-semibold text-gray-900 text-sm">{activeConv.participant}</div>
                <div className="text-xs text-green-500 font-medium">Online</div>
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
                    <Image
                      src={activeConv.participantImage}
                      alt={activeConv.participant}
                      width={32}
                      height={32}
                      className="rounded-full border border-gray-100 object-cover shrink-0 self-end"
                    />
                  )}
                  <div
                    className={clsx(
                      "max-w-xs sm:max-w-sm lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      msg.isOwn
                        ? "text-white rounded-br-sm"
                        : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm"
                    )}
                    style={msg.isOwn ? { background: "#7C3AED" } : {}}
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
            <div className="bg-white border-t border-gray-100 px-5 py-4">
              <div className="flex gap-3 items-center">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  className="rounded-2xl border-gray-200 focus-visible:ring-purple-500"
                />
                <Button
                  onClick={sendMessage}
                  className="rounded-2xl w-11 h-11 p-0 flex items-center justify-center shrink-0 text-white"
                  style={{ background: "#7C3AED" }}
                  disabled={!newMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-center px-6">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 shadow-sm"
              style={{ background: "linear-gradient(135deg, #F3E8FF, #FCE7F3)" }}
            >
              <MessageSquare className="w-10 h-10" style={{ color: "#7C3AED" }} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Your Messages</h2>
            <p className="text-gray-500 text-sm max-w-xs">
              Select a conversation from the sidebar, or browse providers to start messaging.
            </p>
            <Button
              className="mt-6 rounded-xl text-white"
              style={{ background: "#7C3AED" }}
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
