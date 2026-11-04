import { useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock3, Loader2, MessageCircle, Search, Send, UserRound } from "lucide-react";

type ChatStatus = "SENT" | "OPEN" | "CLOSED";
type ConversationCounts = Record<ChatStatus, number>;
type Conversation = {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageDirection: "INBOUND" | "OUTBOUND";
  lastMessageAt: string;
  lastInboundAt: string | null;
  unread: number;
  status: string;
  windowOpen: boolean;
};
type Message = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  type: string;
  mediaType: string | null;
  mediaId: string | null;
  mediaUrl: string | null;
  mediaFilename: string | null;
  status: string;
  failureReason: string | null;
  whatsappMessageId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
};
type ConversationPage = { conversations: Conversation[]; nextBefore: string | null };
type MessagePage = {
  contact: { id: string; name: string; phone: string };
  messages: Message[];
  nextBefore: string | null;
};

const tabs: { value: ChatStatus; label: string }[] = [
  { value: "SENT", label: "Sent" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
];

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message || `${response.status}: ${response.statusText}`);
  }
  return result as T;
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function WhatsAppLiveChatPage() {
  const [activeTab, setActiveTab] = useState<ChatStatus>("OPEN");
  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [draft, setDraft] = useState("");
  const [clientMessageId, setClientMessageId] = useState(() => crypto.randomUUID());
  const queryClient = useQueryClient();

  const countsQuery = useQuery({
    queryKey: ["whatsapp-live-chat", "atwassup-counts"],
    queryFn: () => fetchJson<ConversationCounts>("/api/whatsapp-live-chat/atwassup/conversation-counts"),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
  const conversationsQuery = useInfiniteQuery({
    queryKey: ["whatsapp-live-chat", "atwassup", activeTab, search.trim()],
    initialPageParam: "",
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ status: activeTab, limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (pageParam) params.set("before", pageParam);
      return fetchJson<ConversationPage>(
        `/api/whatsapp-live-chat/atwassup/conversations?${params.toString()}`,
      );
    },
    getNextPageParam: page => page.nextBefore || undefined,
    refetchInterval: 10000,
  });
  const loadedConversations = conversationsQuery.data?.pages.flatMap(page => page.conversations) || [];
  const conversations = activeTab === "OPEN"
    ? loadedConversations.filter(item => item.windowOpen)
    : loadedConversations;
  const expectedCount = countsQuery.data?.[activeTab];
  const selected = conversations.find(item => item.contactId === selectedContactId) || null;

  const messagesQuery = useInfiniteQuery({
    queryKey: ["whatsapp-live-chat", "atwassup-messages", selectedContactId],
    enabled: Boolean(selectedContactId),
    initialPageParam: "",
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (pageParam) params.set("before", pageParam);
      return fetchJson<MessagePage>(
        `/api/whatsapp-live-chat/atwassup/conversations/${encodeURIComponent(selectedContactId)}/messages?${params.toString()}`,
      );
    },
    getNextPageParam: page => page.nextBefore || undefined,
    refetchInterval: 5000,
  });
  const messages = [...(messagesQuery.data?.pages || [])]
    .reverse()
    .flatMap(page => page.messages);
  const messagesPaneRef = useRef<HTMLDivElement>(null);
  const preserveScrollRef = useRef<{ height: number; top: number } | null>(null);
  const forceScrollToBottomRef = useRef(true);
  const isNearBottomRef = useRef(true);

  useLayoutEffect(() => {
    const pane = messagesPaneRef.current;
    if (!pane || !selectedContactId || messagesQuery.isLoading) return;

    const previousPosition = preserveScrollRef.current;
    if (previousPosition) {
      pane.scrollTop = previousPosition.top + (pane.scrollHeight - previousPosition.height);
      preserveScrollRef.current = null;
    } else if (forceScrollToBottomRef.current || isNearBottomRef.current) {
      pane.scrollTop = pane.scrollHeight;
    }
    forceScrollToBottomRef.current = false;
    isNearBottomRef.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 120;
  }, [selectedContactId, messages.length, messagesQuery.dataUpdatedAt, messagesQuery.isLoading]);

  const sendMutation = useMutation({
    mutationFn: async (send: { contactId: string; to: string; text: string; clientMessageId: string }) => {
      const response = await fetch("/api/whatsapp-live-chat/atwassup/messages/text", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          to: send.to,
          text: send.text,
          clientMessageId: send.clientMessageId,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) {
        throw new Error(result.message || `Unable to send reply (HTTP ${response.status}).`);
      }
      return { ...result, contactId: send.contactId };
    },
    onSuccess: async (_result, send) => {
      setDraft("");
      setClientMessageId(crypto.randomUUID());
      forceScrollToBottomRef.current = true;
      isNearBottomRef.current = true;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["whatsapp-live-chat", "atwassup"] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp-live-chat", "atwassup-messages", send.contactId] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp-live-chat", "atwassup-counts"] }),
      ]);
    },
  });

  function submitMessage() {
    const text = draft.trim();
    if (!selected || !text || !selected.windowOpen || sendMutation.isPending) return;
    sendMutation.mutate({
      contactId: selected.contactId,
      to: selected.contactPhone,
      text,
      clientMessageId,
    });
  }

  function selectConversation(contactId: string) {
    setSelectedContactId(contactId);
    preserveScrollRef.current = null;
    forceScrollToBottomRef.current = Boolean(contactId);
    isNearBottomRef.current = true;
    setDraft("");
    setClientMessageId(crypto.randomUUID());
    sendMutation.reset();
  }

  async function loadOlderMessages() {
    const pane = messagesPaneRef.current;
    if (pane) preserveScrollRef.current = { height: pane.scrollHeight, top: pane.scrollTop };
    const result = await messagesQuery.fetchNextPage();
    if (result.isError) preserveScrollRef.current = null;
  }

  return (
    <Layout fullScreen>
      <div className="flex h-full min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <aside className={`flex min-h-0 w-full flex-col border-r border-slate-200 md:w-[320px] md:shrink-0 ${selectedContactId ? "hidden md:flex" : "flex"}`}>
          <div className="border-b border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              <h1 className="text-lg font-bold text-slate-900">Live Chat</h1>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={event => {
                setSearch(event.target.value);
                setSelectedContactId("");
                setDraft("");
                sendMutation.reset();
              }}
                className="pl-9" placeholder="Search conversations..." />
            </div>
            <div className="mt-3 grid grid-cols-3 border-b">
              {tabs.map(tab => (
                <button key={tab.value} type="button"
                  onClick={() => {
                    setActiveTab(tab.value);
                    setSelectedContactId("");
                    setDraft("");
                    sendMutation.reset();
                  }}
                  className={`border-b-2 px-2 py-2 text-xs font-semibold ${activeTab === tab.value ? "border-emerald-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                  {tab.label} ({countsQuery.isError ? "—" : countsQuery.data?.[tab.value] ?? "…"})
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Showing {conversations.length} loaded conversation{conversations.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversationsQuery.isLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" /></div>
            ) : conversationsQuery.isError ? (
              <p className="p-5 text-sm text-red-600">
                Unable to load AtWassup conversations. {conversationsQuery.error.message}
              </p>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No AtWassup conversations found for this status.</div>
            ) : conversations.map((item, index) => (
              <button key={`${item.contactId}-${index}`} type="button" onClick={() => selectConversation(item.contactId)}
                className={`flex w-full items-start gap-3 border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${selectedContactId === item.contactId ? "bg-slate-50" : ""}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <UserRound className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{item.contactName || item.contactPhone}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{formatTime(item.lastMessageAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{item.contactPhone}</span>
                  <span className="mt-1 block truncate text-xs text-slate-600">{item.lastMessage}</span>
                </span>
                {item.unread > 0 && <Badge className="h-5 min-w-5 justify-center rounded-full bg-emerald-600 px-1">{item.unread}</Badge>}
              </button>
            ))}
            {conversationsQuery.hasNextPage &&
              (expectedCount === undefined || conversations.length < expectedCount) && (
              <div className="p-3">
                <Button variant="outline" size="sm" className="w-full"
                  disabled={conversationsQuery.isFetchingNextPage}
                  onClick={() => void conversationsQuery.fetchNextPage()}>
                  {conversationsQuery.isFetchingNextPage ? "Loading…" : "Load more conversations"}
                </Button>
              </div>
            )}
          </div>
        </aside>

        <section className={`min-w-0 flex-1 flex-col ${selectedContactId ? "flex" : "hidden md:flex"}`}>
          {selected ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => selectConversation("")}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-slate-900">{selected.contactName || selected.contactPhone}</h2>
                    <p className="truncate text-xs text-slate-500">{selected.contactPhone} ·
                      <span className={selected.windowOpen ? "text-emerald-700" : "text-amber-700"}>
                        {selected.windowOpen ? " 24h Window Open" : " 24h Window Closed"}
                      </span>
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowProfile(value => !value)}>
                  <UserRound className="mr-1 h-4 w-4" />Profile
                </Button>
              </header>
              {showProfile && (
                <div className="border-b bg-slate-50 px-5 py-3 text-sm">
                  <p className="font-semibold">{selected.contactName}</p>
                  <p className="text-slate-500">{selected.contactPhone}</p>
                  <p className="mt-1 text-xs text-slate-500">AtWassup contact ID: {selected.contactId}</p>
                </div>
              )}
              <div ref={messagesPaneRef}
                onScroll={event => {
                  const pane = event.currentTarget;
                  isNearBottomRef.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 120;
                }}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f2eee6] p-4 sm:p-6">
                {messagesQuery.hasNextPage && (
                  <div className="text-center">
                    <Button variant="outline" size="sm" disabled={messagesQuery.isFetchingNextPage}
                      onClick={() => void loadOlderMessages()}>
                      {messagesQuery.isFetchingNextPage ? "Loading…" : "Load older messages"}
                    </Button>
                  </div>
                )}
                {messagesQuery.isLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : messagesQuery.isError ? (
                  <p className="text-center text-sm text-red-600">
                    Unable to load message history. {messagesQuery.error.message}
                  </p>
                ) : messages.map(message => {
                  const outgoing = message.direction === "OUTBOUND";
                  const mediaUrl = /^https?:\/\//i.test(message.mediaUrl || "") ? message.mediaUrl : null;
                  return (
                    <div key={message.id} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[82%] rounded-xl px-3 py-2 shadow-sm ${outgoing ? "rounded-tr-sm bg-[#d9fdd3]" : "rounded-tl-sm bg-white"}`}>
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-800">
                          {message.body || (message.mediaFilename ? `[${message.mediaFilename}]` : message.mediaType ? `[${message.mediaType}]` : `[${message.type}]`)}
                        </p>
                        {mediaUrl && <a href={mediaUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-blue-700 underline">Open media</a>}
                        {message.failureReason && <p className="mt-1 text-xs text-red-700">{message.failureReason}</p>}
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                          {formatTime(message.sentAt || message.createdAt)}
                          {outgoing && <span className="uppercase">{message.status}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <footer className="border-t border-slate-200 bg-white p-3">
                {selected.windowOpen ? (
                  <>
                    {sendMutation.isError && <p role="alert" className="mb-2 text-sm text-red-600">{sendMutation.error.message}</p>}
                    {sendMutation.isSuccess && <p role="status" className="mb-2 text-sm text-emerald-700">
                      {sendMutation.data.duplicate ? "This reply was already accepted by AtWassup." : "Reply sent through AtWassup."}
                    </p>}
                    <div className="flex items-end gap-2">
                      <Textarea value={draft} maxLength={4096}
                        disabled={sendMutation.isPending}
                        onChange={event => {
                          const next = event.target.value;
                          if (sendMutation.isError && next.trim() !== draft.trim()) setClientMessageId(crypto.randomUUID());
                          setDraft(next);
                        }}
                        onKeyDown={event => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            submitMessage();
                          }
                        }}
                        placeholder="Type a message..." className="max-h-32 min-h-10 resize-y" />
                      <Button type="button" size="icon" className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                        disabled={!draft.trim() || sendMutation.isPending} onClick={submitMessage}>
                        {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-slate-400">
                      <Clock3 className="h-3 w-3" />Replies are sent only through AtWassup.
                    </p>
                  </>
                ) : (
                  <p className="py-2 text-center text-sm text-amber-700">
                    The customer must have messaged within the last 24 hours to reply.
                  </p>
                )}
              </footer>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
              <MessageCircle className="mb-3 h-10 w-10" />
              <p className="text-sm">Select an AtWassup conversation</p>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
