import assert from "node:assert/strict";
import test from "node:test";
import type { Ticket } from "./schema";
import { filterTickets, paginateTickets, TICKETS_PER_PAGE } from "./ticket-list";

function ticket(index: number, status: Ticket["status"] = "IN_PROGRESS"): Ticket {
  return {
    id: String(index), customerId: String(index), customerName: `Customer ${index}`,
    phone: `987654${String(index).padStart(4, "0")}`, note: `Issue ${index}`, status,
    createdAt: new Date(Date.UTC(2026, 9, 5, 0, index)).toISOString(),
  };
}

test("both ticket views have exactly ten records per page and retain the final partial page", () => {
  const tickets = Array.from({ length: 23 }, (_, index) => ticket(index));
  assert.equal(TICKETS_PER_PAGE, 10);
  assert.equal(paginateTickets(tickets, 1).tickets.length, 10);
  assert.equal(paginateTickets(tickets, 2).tickets.length, 10);
  assert.equal(paginateTickets(tickets, 3).tickets.length, 3);
  assert.equal(paginateTickets(tickets, 3).totalPages, 3);
  assert.equal(new Set([1, 2, 3].flatMap(page => paginateTickets(tickets, page).tickets.map(t => t.id))).size, 23);
});

test("empty results and shrinking lists clamp the current page", () => {
  assert.deepEqual(paginateTickets([], 4), { tickets: [], page: 1, totalPages: 1, start: 0 });
  assert.equal(paginateTickets([ticket(1)], 4).page, 1);
  assert.equal(paginateTickets([ticket(1)], 0).page, 1);
  assert.equal(paginateTickets(Array.from({ length: 20 }, (_, i) => ticket(i)), 3).page, 2);
});

test("unresolved and resolved filters are exclusive and a status update moves the ticket", () => {
  const tickets = [ticket(1), ticket(2, "RESOLVED")];
  assert.deepEqual(filterTickets(tickets, { status: "IN_PROGRESS" }).map(t => t.id), ["1"]);
  assert.deepEqual(filterTickets(tickets, { status: "RESOLVED" }).map(t => t.id), ["2"]);
  tickets[0].status = "RESOLVED";
  assert.equal(filterTickets(tickets, { status: "IN_PROGRESS" }).length, 0);
  assert.equal(filterTickets(tickets, { status: "ALL" }).length, 2);
});

test("search runs within the selected status before pagination, including phone", () => {
  const tickets = Array.from({ length: 25 }, (_, i) => ticket(i, i % 2 ? "RESOLVED" : "IN_PROGRESS"));
  const filtered = filterTickets(tickets, { status: "IN_PROGRESS", search: " customer " });
  assert.equal(filtered.length, 13);
  assert.equal(paginateTickets(filtered, 2).tickets.length, 3);
  assert.deepEqual(filterTickets(tickets, { search: tickets[5].phone }).map(t => t.id), ["5"]);
  assert.deepEqual(filterTickets(tickets, { search: "ISSUE 24" }).map(t => t.id), ["24"]);
});

test("date filters include full creation days using India time, not UTC dates", () => {
  const tickets = [
    { ...ticket(1), createdAt: "2026-10-04T18:29:59.999Z" },
    { ...ticket(2), createdAt: "2026-10-04T18:30:00.000Z" },
    { ...ticket(3, "RESOLVED"), createdAt: "2026-10-05T18:29:59.999Z" },
    { ...ticket(4), createdAt: "2026-10-05T18:30:00.000Z" },
  ];
  assert.deepEqual(filterTickets(tickets, { from: "2026-10-05", to: "2026-10-05" }).map(t => t.id), ["3", "2"]);
  assert.deepEqual(filterTickets(tickets, { status: "IN_PROGRESS", from: "2026-10-05", to: "2026-10-05" }).map(t => t.id), ["2"]);
  assert.equal(filterTickets(tickets, { from: "2026-10-05" }).length, 3);
  assert.equal(filterTickets(tickets, { to: "2026-10-05" }).length, 3);
});

test("filtering and newest-first sorting do not mutate the original list", () => {
  const tickets = [ticket(1), ticket(2), ticket(3)];
  assert.deepEqual(filterTickets(tickets).map(t => t.id), ["3", "2", "1"]);
  assert.deepEqual(tickets.map(t => t.id), ["1", "2", "3"]);
  assert.deepEqual(filterTickets(tickets, { from: "2026-10-06", to: "2026-10-05" }), []);
});
