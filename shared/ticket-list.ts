import type { Ticket } from "./schema";

export const TICKETS_PER_PAGE = 10;
export type TicketStatusFilter = "ALL" | "IN_PROGRESS" | "RESOLVED";

export function ticketWorkflowStatus(ticket: Pick<Ticket, "status">) {
  return ticket.status === "RESOLVED" ? "RESOLVED" : "IN_PROGRESS";
}

function indiaDateKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function filterTickets(
  tickets: Ticket[],
  filters: { status?: TicketStatusFilter; search?: string; from?: string; to?: string } = {},
): Ticket[] {
  const search = (filters.search || "").trim().toLowerCase();
  return tickets.filter(ticket => {
    if (filters.status && filters.status !== "ALL" && ticketWorkflowStatus(ticket) !== filters.status) return false;
    if (search && ![ticket.customerName, ticket.phone, ticket.note].some(value => (value || "").toLowerCase().includes(search))) return false;
    if (filters.from || filters.to) {
      const date = indiaDateKey(ticket.createdAt);
      if (!date || (filters.from && date < filters.from) || (filters.to && date > filters.to)) return false;
    }
    return true;
  }).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export function paginateTickets(tickets: Ticket[], requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(tickets.length / TICKETS_PER_PAGE));
  const page = Math.min(totalPages, Math.max(1, requestedPage));
  const start = (page - 1) * TICKETS_PER_PAGE;
  return { tickets: tickets.slice(start, start + TICKETS_PER_PAGE), page, totalPages, start };
}
