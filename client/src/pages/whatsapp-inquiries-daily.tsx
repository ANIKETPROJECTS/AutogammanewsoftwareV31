import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Loader2, MessageCircle, Phone, Search, UserRound } from "lucide-react";

type DailyInquiry = {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  lastInboundAt: string | null;
  windowOpen: boolean;
  initialMessage: string | null;
  initialMessageAt: string | null;
  historyError: string | null;
};

function getIndiaDateKey(value: string | Date | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatReceivedDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelForDay(key: string) {
  if (key === "unknown") return "Date unavailable";
  const today = getIndiaDateKey(new Date());
  const yesterday = getIndiaDateKey(Date.now() - 24 * 60 * 60 * 1000);
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const date = new Date(`${key}T00:00:00+05:30`);
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function fetchOpenInquiries(): Promise<DailyInquiry[]> {
  const response = await fetch("/api/whatsapp-live-chat/atwassup/inquiries", {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message || `Unable to load WhatsApp inquiries (HTTP ${response.status}).`);
  }
  return result as DailyInquiry[];
}

export default function WhatsAppDailyInquiriesPage() {
  const [search, setSearch] = useState("");
  const inquiriesQuery = useQuery({
    queryKey: ["whatsapp-live-chat", "atwassup-open-inquiries"],
    queryFn: fetchOpenInquiries,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });
  const inquiries = inquiriesQuery.data || [];
  const todayKey = getIndiaDateKey(new Date());
  const todayCount = inquiries.filter(item =>
    getIndiaDateKey(item.lastInboundAt || item.lastMessageAt) === todayKey,
  ).length;

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const byDay = new Map<string, DailyInquiry[]>();
    for (const inquiry of inquiries) {
      if (query && ![
        inquiry.contactName,
        inquiry.contactPhone,
        inquiry.initialMessage || "",
      ].some(value => value.toLowerCase().includes(query))) continue;

      const key = getIndiaDateKey(inquiry.lastInboundAt || inquiry.lastMessageAt);
      byDay.set(key, [...(byDay.get(key) || []), inquiry]);
    }
    return Array.from(byDay.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([day, items]) => ({ day, items }));
  }, [inquiries, search]);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-3">
              <MessageCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">WhatsApp Inquiries</h1>
              <p className="text-sm text-slate-500">Daily customer inquiries from AtWassup Live Chat</p>
            </div>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search name, number, or first message"
              className="pl-9"
            />
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Open inquiries</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {inquiriesQuery.isLoading ? "—" : inquiries.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">Matching the Open list in Live Chat</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Received today</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {inquiriesQuery.isLoading ? "—" : todayCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">Based on the latest customer message, India time</p>
          </div>
        </section>

        {inquiriesQuery.isError ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            Unable to load WhatsApp inquiries. {inquiriesQuery.error.message}
          </div>
        ) : inquiriesQuery.isLoading ? (
          <div className="flex justify-center rounded-xl border bg-white p-16">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center">
            <MessageCircle className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            <p className="font-semibold text-slate-700">
              {search ? "No inquiries match your search" : "No open WhatsApp inquiries"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {search ? "Try a different name, phone number, or message." : "New open conversations will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            {groups.map(group => (
              <section key={group.day} aria-label={`${labelForDay(group.day)} inquiries`}>
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  <h2 className="font-semibold text-slate-800">{labelForDay(group.day)}</h2>
                  <Badge variant="secondary">{group.items.length}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {group.items.map(inquiry => (
                    <article key={inquiry.contactId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                          <UserRound className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate font-semibold text-slate-900">
                                {inquiry.contactName || "Unknown customer"}
                              </h3>
                              <a href={`tel:${inquiry.contactPhone}`} className="mt-1 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
                                <Phone className="h-3.5 w-3.5" />
                                {inquiry.contactPhone}
                              </a>
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Open</Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            Latest inquiry: {formatReceivedDate(inquiry.lastInboundAt)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-slate-50 p-3">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          First customer message
                        </p>
                        {inquiry.historyError ? (
                          <p className="text-sm text-amber-700">Could not load the original message: {inquiry.historyError}</p>
                        ) : inquiry.initialMessage ? (
                          <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
                            {inquiry.initialMessage}
                          </p>
                        ) : (
                          <p className="text-sm italic text-slate-500">No incoming text message was found in this conversation.</p>
                        )}
                        <p className="mt-2 text-[11px] text-slate-400">
                          First received: {formatReceivedDate(inquiry.initialMessageAt)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
