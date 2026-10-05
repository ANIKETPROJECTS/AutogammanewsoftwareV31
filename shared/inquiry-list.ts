import type { Inquiry } from "./schema";
import { indiaDateKey } from "./ticket-list";

export const INQUIRIES_PER_PAGE = 10;

export function filterInquiries(
  inquiries: Inquiry[],
  filters: { search?: string; status?: string; from?: string; to?: string } = {},
) {
  const search = (filters.search || "").trim().toLowerCase();
  return inquiries.filter(inquiry => {
    const status = inquiry.status === "CONVERTED" || inquiry.isConverted ? "CONVERTED" : "FOLLOW_UP";
    if (filters.status && filters.status !== "ALL" && status !== filters.status) return false;
    if (search && ![inquiry.customerName, inquiry.phone, inquiry.notes, inquiry.inquiryId].some(value => (value || "").toLowerCase().includes(search))) return false;
    if (filters.from || filters.to) {
      const date = indiaDateKey(inquiry.createdAt);
      if (!date || (filters.from && date < filters.from) || (filters.to && date > filters.to)) return false;
    }
    return true;
  }).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export function paginateInquiries(inquiries: Inquiry[], requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(inquiries.length / INQUIRIES_PER_PAGE));
  const page = Math.min(totalPages, Math.max(1, requestedPage));
  const start = (page - 1) * INQUIRIES_PER_PAGE;
  return { inquiries: inquiries.slice(start, start + INQUIRIES_PER_PAGE), page, totalPages };
}
