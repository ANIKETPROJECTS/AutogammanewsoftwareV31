import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInvoicePayments } from "../shared/invoice-payment-normalization";

test("only a fully entered payment marks the invoice paid", () => {
  const result = normalizeInvoicePayments(
    [{ amount: 200, method: "Cash", date: "2026-11-04" }],
    200,
    true,
  );
  assert.equal(result.paidAmount, 200);
  assert.equal(result.isPaid, true);
});

test("checking mark as paid with zero entered does not invent a payment", () => {
  const result = normalizeInvoicePayments(
    [{ amount: 0, method: "Cash", date: "2026-11-04" }],
    200,
    true,
    "2026-11-04",
  );

  assert.deepEqual(result.payments, []);
  assert.equal(result.paidAmount, 0);
  assert.equal(result.isPaid, false);
});

test("zero-total invoice is paid without creating a payment record", () => {
  const result = normalizeInvoicePayments(
    [{ amount: 0, method: "Cash", date: "2026-11-04" }],
    0,
    false,
    "2026-11-04",
  );

  assert.deepEqual(result.payments, []);
  assert.equal(result.paidAmount, 0);
  assert.equal(result.isPaid, true);
});

test("a partial payment stays partial and drops zero-value methods", () => {
  const result = normalizeInvoicePayments(
    [
      { amount: 120, method: "Cash", date: "2026-11-04" },
      { amount: 0, method: "UPI / GPay", date: "2026-11-04" },
    ],
    200,
    true,
    "2026-11-04",
  );

  assert.deepEqual(result.payments, [{ amount: 120, method: "Cash", date: "2026-11-04" }]);
  assert.equal(result.isPaid, false);
});

test("unpaid zero-value payment rows are removed without inventing a payment", () => {
  const result = normalizeInvoicePayments(
    [{ amount: 0, method: "Cash", date: "2026-11-04" }],
    200,
    false,
    "2026-11-04",
  );

  assert.deepEqual(result.payments, []);
  assert.equal(result.paidAmount, 0);
  assert.equal(result.isPaid, false);
});
