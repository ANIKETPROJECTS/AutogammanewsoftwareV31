import assert from "node:assert/strict";
import test from "node:test";
import { inquirySchema } from "./schema";
import { filterInquiries, paginateInquiries, INQUIRIES_PER_PAGE } from "./inquiry-list";
import { TICKETS_PER_PAGE } from "./ticket-list";

function inquiry(index: number) {
  return inquirySchema.parse({
    id: String(index), customerName: `Customer ${index}`, phone: "9876543210",
    notes: `Note ${index}`, status: index % 2 ? "CONVERTED" : "FOLLOW_UP",
    isConverted: index % 2 === 1,
    createdAt: new Date(Date.UTC(2026, 9, 5, 0, index)).toISOString(),
  });
}

test("admin and kiosk paginate ten inquiries at a time with a final partial page", () => {
  const inquiries = Array.from({ length: 23 }, (_, index) => inquiry(index));
  assert.equal(INQUIRIES_PER_PAGE, 10);
  assert.equal(INQUIRIES_PER_PAGE, TICKETS_PER_PAGE);
  assert.deepEqual([1, 2, 3].map(page => paginateInquiries(inquiries, page).inquiries.length), [10, 10, 3]);
  assert.equal(new Set([1, 2, 3].flatMap(page => paginateInquiries(inquiries, page).inquiries.map(i => i.id))).size, 23);
});

test("search and existing status filters run before pagination", () => {
  const inquiries = Array.from({ length: 25 }, (_, index) => inquiry(index));
  const results = filterInquiries(inquiries, { status: "FOLLOW_UP", search: " customer " });
  assert.equal(results.length, 13);
  assert.equal(paginateInquiries(results, 2).inquiries.length, 3);
  assert.deepEqual(filterInquiries(inquiries, { search: "NOTE 24" }).map(i => i.id), ["24"]);
  assert.equal(filterInquiries(inquiries, { search: "9876543210" }).length, 25);
});

test("admin and kiosk date ranges include full creation days in India time", () => {
  const inquiries = [
    { ...inquiry(1), createdAt: "2026-10-04T18:29:59.999Z" },
    { ...inquiry(2), createdAt: "2026-10-04T18:30:00.000Z" },
    { ...inquiry(3), createdAt: "2026-10-05T18:29:59.999Z" },
    { ...inquiry(4), createdAt: "2026-10-05T18:30:00.000Z" },
  ];
  assert.deepEqual(filterInquiries(inquiries, { from: "2026-10-05", to: "2026-10-05" }).map(i => i.id), ["3", "2"]);
  assert.deepEqual(filterInquiries(inquiries, { status: "FOLLOW_UP", from: "2026-10-05", to: "2026-10-05" }).map(i => i.id), ["2"]);
  assert.equal(filterInquiries(inquiries, { from: "2026-10-05" }).length, 3);
  assert.equal(filterInquiries(inquiries, { to: "2026-10-05" }).length, 3);
});

test("legacy conversion flags and current status changes remain compatible", () => {
  const converted = { ...inquiry(2), isConverted: true };
  assert.equal(filterInquiries([converted], { status: "CONVERTED" }).length, 1);
  assert.equal(filterInquiries([converted], { status: "FOLLOW_UP" }).length, 0);
  const followUp = { ...converted, isConverted: false, status: "FOLLOW_UP" as const };
  assert.equal(filterInquiries([followUp], { status: "FOLLOW_UP" }).length, 1);
});

test("deleted or filtered results clamp pagination and handle empty lists", () => {
  assert.deepEqual(paginateInquiries([], 3), { inquiries: [], page: 1, totalPages: 1 });
  assert.equal(paginateInquiries([inquiry(1)], 3).page, 1);
  assert.equal(paginateInquiries([inquiry(1)], 0).page, 1);
  assert.equal(filterInquiries([inquiry(1)], { from: "2026-10-06" }).length, 0);
});

test("newest-first filtering does not mutate saved inquiry data", () => {
  const inquiries = [inquiry(1), inquiry(2), inquiry(3)];
  assert.deepEqual(filterInquiries(inquiries).map(i => i.id), ["3", "2", "1"]);
  assert.deepEqual(inquiries.map(i => i.id), ["1", "2", "3"]);
});
