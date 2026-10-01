import assert from "node:assert/strict";
import test from "node:test";
import {
  createInvoiceJobCardMatcher,
  type FollowUpInvoice,
  type FollowUpJobCard,
} from "./ppf-follow-up-matcher";

const jobCard: FollowUpJobCard = {
  _id: "local-job-card-id",
  jobNo: "JC-2026-460",
  date: "2026-09-27",
  status: "Completed",
  completedDate: "2026-09-27",
  customerName: "Pratik Nirvane",
  phoneNumber: "9890540487",
  make: "Hero",
  model: "Zoom 160",
  year: "2026",
  licensePlate: "MH05GN1379",
  ppfs: [{ name: "Garware Plus Gloss - TPU 5 Years Warranty" }],
};

function invoice(overrides: Partial<FollowUpInvoice> = {}): FollowUpInvoice {
  return {
    jobCardId: "missing-database-local-id",
    date: "2026-09-27",
    customerName: "Pratik Nirvane",
    phoneNumber: "+91 98905 40487",
    vehicleMake: "Hero",
    vehicleModel: "Zoom 160",
    vehicleYear: "2026",
    licensePlate: "MH-05-GN-1379",
    items: [{
      name: "Garware Plus Gloss - TPU 5 Years Warranty Quantity: 20sqft",
      type: "PPF",
    }],
    ...overrides,
  };
}

test("uses the local job-card ID when it is valid", () => {
  const localJobCard = { ...jobCard, _id: "matching-id" };
  const match = createInvoiceJobCardMatcher([localJobCard]);
  assert.equal(match(invoice({ jobCardId: "matching-id" })), localJobCard);
});

test("safely matches a legacy invoice to a local job card when Mongo IDs differ", () => {
  const match = createInvoiceJobCardMatcher([jobCard]);
  assert.equal(match(invoice()), jobCard);
});

test("matches an exact explicit job-card number", () => {
  const match = createInvoiceJobCardMatcher([jobCard]);
  assert.equal(match(invoice({ jobCardNo: "JC-2026-460" })), jobCard);
});

test("does not guess when multiple local job cards match", () => {
  const second = { ...jobCard, _id: "second-job-card-id" };
  const match = createInvoiceJobCardMatcher([jobCard, second]);
  assert.equal(match(invoice()), undefined);
});

test("does not match records with a different service date or vehicle", () => {
  const match = createInvoiceJobCardMatcher([jobCard]);
  assert.equal(match(invoice({ date: "2026-09-28" })), undefined);
  assert.equal(match(invoice({ licensePlate: "MH-01-AB-1234" })), undefined);
});