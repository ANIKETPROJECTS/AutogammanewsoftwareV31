import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, CheckCheck, Clock3, Loader2, MessageCircle, Search, Send, UserRound } from "lucide-react";

type ChatStatus = "OPEN" | "SENT" | "CLOSED";
type ChatConversation = {
  phone: string;
  contactName: string;
  status: ChatStatus;
  lastMessage: string;
  lastMessageAt: string;
  latestInboundAt: string;
  unreadCount: number;
};
type ChatMessage = {
  whatsappMessageId: string;
  phone: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  text: string;
  timestamp: string;
  status: string;
};

const CONVERSATIONS_KEY = ["/api/whatsapp-live-chat/conversations"];
const TABS: { value: ChatStatus; label: string }[] = [
  { value: "SENT", label: "Sent" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
];

async function fetchChatJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const message = (await response.text()).slice(0, 500);
    throw new Error(`${response.status}: ${message || response.statusText}`);
  }
  return response.json();
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function WhatsAppLiveChatPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ChatStatus>("OPEN");
  const [search, setSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState("");
  const [draft, setDraft] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useQuery<ChatConversation[]>({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => fetchChatJson<ChatConversation[]>(CONVERSATIONS_KEY[0]),
    refetchInterval: 5000,
  });
  const conversations = conversationsQuery.data || [];
  const counts = useMemo(() => ({
    SENT: conversations.filter(item => item.status === "SENT").length,
    OPEN: conversations.filter(item => item.status === "OPEN").length,
    CLOSED: conversations.filter(item => item.status === "CLOSED").length,
  }), [conversations]);
  const filtered = useMemo(() => conversations.filter(item => {
    const matchesTab = item.status === activeTab;
    const query = search.trim().toLowerCase();
    return matchesTab && (!query || item.contactName.toLowerCase().includes(query) || item.phone.includes(query));
  }), [conversations, activeTab, search]);

  const selected = conversations.find(item => item.phone === selectedPhone) || null;
  const messagesQuery = useQuery<ChatMessage[]>({
    queryKey: [...CONVERSATIONS_KEY, selectedPhone, "messages"],
    enabled: Boolean(selectedPhone),
    queryFn: () => fetchChatJson<ChatMessage[]>(
      `/api/whatsapp-live-chat/conversations/${encodeURIComponent(selectedPhone)}/messages`,
    ),
    refetchInterval: 3000,
  });
  const messages = messagesQuery.data || [];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
  }, [messages.length, selectedPhone]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedPhone) throw new Error("Select a conversation first.");
      const response = await apiRequest(
        "POST",
        `/api/whatsapp-live-chat/conversations/${encodeURIComponent(selectedPhone)}/messages`,
        { text },
      );
      return response.json();
    },
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: [...CONVERSATIONS_KEY, selectedPhone, "messages"] });
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
    onError: (error: Error) => toast({
      title: "Message not sent",
      description: error.message,
      variant: "destructive",
    }),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: ChatStatus) => {
      if (!selectedPhone) return;
      await apiRequest(
        "PATCH",
        `/api/whatsapp-live-chat/conversations/${encodeURIComponent(selectedPhone)}/status`,
        { status },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      toast({ title: "Conversation updated" });
    },
    onError: (error: Error) => toast({ title: "Unable to update conversation", description: error.message, variant: "destructive" }),
  });

  const windowOpen = Boolean(selected?.latestInboundAt) &&
    Date.now() - Date.parse(selected?.latestInboundAt || "") < 24 * 60 * 60 * 1000;
  const submitMessage = () => {
    const text = draft.trim();
    if (text && windowOpen && !sendMutation.isPending) sendMutation.mutate(text);
  };

  return (
    <Layout fullScreen>
      <div className="flex h-full min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <aside className={`flex min-h-0 w-full flex-col border-r border-slate-200 md:w-[320px] md:shrink-0 ${selectedPhone ? "hidden md:flex" : "flex"}`}>
          <div className="border-b border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              <h1 className="text-lg font-bold text-slate-900">Live Chat</h1>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={event => setSearch(event.target.value)} className="pl-9" placeholder="Search conversations..." />
            </div>
            <div className="mt-3 grid grid-cols-3 border-b">
              {TABS.map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => { setActiveTab(tab.value); setSelectedPhone(""); }}
                  className={`border-b-2 px-2 py-2 text-xs font-semibold ${activeTab === tab.value ? "border-emerald-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                >
                  {tab.label} ({counts[tab.value]})
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Showing {filtered.length} conversation{filtered.length === 1 ? "" : "s"}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversationsQuery.isLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" /></div>
            ) : conversationsQuery.isError ? (
              <p className="p-5 text-sm text-red-600">
                Unable to load conversations. {conversationsQuery.error instanceof Error ? conversationsQuery.error.message : "Refresh to try again."}
              </p>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No {activeTab.toLowerCase()} conversations yet. New WhatsApp messages will appear here.</div>
            ) : filtered.map(item => (
              <button key={item.phone} type="button" onClick={() => setSelectedPhone(item.phone)}
                className={`flex w-full items-start gap-3 border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${selectedPhone === item.phone ? "bg-slate-50" : ""}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><UserRound className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{item.contactName || `+${item.phone}`}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{formatTime(item.lastMessageAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">+{item.phone}</span>
                  <span className="mt-1 block truncate text-xs text-slate-600">{item.lastMessage}</span>
                </span>
                {item.unreadCount > 0 && <Badge className="h-5 min-w-5 justify-center rounded-full bg-emerald-600 px-1">{item.unreadCount}</Badge>}
              </button>
            ))}
          </div>
        </aside>

        <section className={`min-w-0 flex-1 flex-col ${selectedPhone ? "flex" : "hidden md:flex"}`}>
          {selected ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedPhone("")}><ArrowLeft className="h-4 w-4" /></Button>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><UserRound className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-slate-900">{selected.contactName || `+${selected.phone}`}</h2>
                    <p className="truncate text-xs text-slate-500">+{selected.phone} · <span className={windowOpen ? "text-emerald-700" : "text-amber-700"}>{windowOpen ? "24h Window Open" : "24h Window Closed"}</span></p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowProfile(value => !value)}><UserRound className="mr-1 h-4 w-4" />Profile</Button>
                  <Button variant="outline" size="sm" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate(selected.status === "CLOSED" ? "OPEN" : "CLOSED")}>
                    {selected.status === "CLOSED" ? "Reopen" : "Close"}
                  </Button>
                </div>
              </header>
              {showProfile && <div className="border-b bg-slate-50 px-5 py-3 text-sm"><p className="font-semibold">{selected.contactName}</p><p className="text-slate-500">+{selected.phone}</p></div>}
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f2eee6] p-4 sm:p-6">
                {messagesQuery.isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div> :
                  messagesQuery.isError ? <p className="text-center text-sm text-red-600">Unable to load messages. {messagesQuery.error instanceof Error ? messagesQuery.error.message : ""}</p> :
                  messages.map(message => {
                    const outgoing = message.direction === "OUTBOUND";
                    return <div key={message.whatsappMessageId} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[82%] rounded-xl px-3 py-2 shadow-sm ${outgoing ? "rounded-tr-sm bg-[#d9fdd3]" : "rounded-tl-sm bg-white"}`}>
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{message.text}</p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                          {formatTime(message.timestamp)}
                          {outgoing && (message.status === "read" || message.status === "delivered"
                            ? <CheckCheck className={`h-3.5 w-3.5 ${message.status === "read" ? "text-blue-600" : ""}`} />
                            : <Check className="h-3.5 w-3.5" />)}
                        </div>
                      </div>
                    </div>;
                  })}
                <div ref={messagesEndRef} />
              </div>
              <footer className="border-t border-slate-200 bg-white p-3">
                {selected.status === "CLOSED" ? (
                  <p className="py-2 text-center text-sm text-slate-500">Reopen this conversation to reply.</p>
                ) : !windowOpen ? (
                  <p className="py-2 text-center text-sm text-amber-700">The 24-hour reply window is closed. Use an approved template to contact this customer.</p>
                ) : (
                  <div className="flex items-end gap-2">
                    <Textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
                      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitMessage(); }
                    }} placeholder="Type a message..." className="max-h-32 min-h-10 resize-y" />
                    <Button type="button" size="icon" className="shrink-0 bg-emerald-600 hover:bg-emerald-700" disabled={!draft.trim() || sendMutation.isPending} onClick={submitMessage}>
                      {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Clock3 className="h-3 w-3" />Messages refresh automatically.</p>
              </footer>
            </>
          ) : <div className="flex flex-1 flex-col items-center justify-center text-slate-400"><MessageCircle className="mb-3 h-10 w-10" /><p className="text-sm">Select a conversation to start chatting</p></div>}
        </section>
      </div>
    </Layout>
  );
}
