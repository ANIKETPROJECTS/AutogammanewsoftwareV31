import assert from "node:assert/strict";
import test from "node:test";
import { ppfMasterSchema, purchaseItemSchema, vendorPurchaseSchema } from "./schema";
import { sumRecordedPurchaseCosts, purchaseItemsNeedMasterSync } from "./vendor-purchase-cost";

const item = { itemType: "Accessory" as const, name: "Test item", quantity: 10, unitPrice: 500 };

test("legacy purchase records retain both their old cost values", () => {
  const parsed = purchaseItemSchema.parse({ ...item, purchaseCost: "3500.25" });
  assert.equal(parsed.purchaseCost, 3500.25);
  assert.equal(parsed.sellCost, 0);
  assert.equal(parsed.supplierCostBasis, undefined);
  assert.equal(parsed.unitPrice, 500);
  assert.equal(parsed.quantity, 10);
  assert.equal(parsed.unitPrice * parsed.quantity, 5000);
  assert.equal(purchaseItemSchema.parse(JSON.parse(JSON.stringify(parsed))).purchaseCost, 3500.25);
});

test("new purchase records can explicitly use Purchase Cost as their supplier-cost basis", () => {
  const parsed = purchaseItemSchema.parse({
    ...item,
    purchaseCost: "49",
    supplierCostBasis: "purchaseCost",
  });
  assert.equal(parsed.purchaseCost, 49);
  assert.equal(parsed.supplierCostBasis, "purchaseCost");
});

test("legacy items have no invented purchase cost, while zero is a recorded value", () => {
  assert.equal(purchaseItemSchema.parse(item).purchaseCost, undefined);
  assert.equal(sumRecordedPurchaseCosts([{}, {}]), undefined);
  assert.equal(sumRecordedPurchaseCosts([]), undefined);
  assert.equal(sumRecordedPurchaseCosts([{ purchaseCost: 0 }, {}]), 0);
});

test("summaries add entered amounts once per item, not once per unit", () => {
  assert.equal(sumRecordedPurchaseCosts([
    { purchaseCost: 3500.25 }, { purchaseCost: 1000.5 }, {},
  ]), 4500.75);
});

test("rejects negative, nonnumeric and infinite purchase costs", () => {
  for (const purchaseCost of [-1, "not-a-number", Infinity, NaN]) {
    assert.equal(purchaseItemSchema.safeParse({ ...item, purchaseCost }).success, false);
  }
});

test("Sell Cost accepts zero and rejects negative, nonnumeric, or infinite values", () => {
  assert.equal(purchaseItemSchema.parse({ ...item, sellCost: 0 }).sellCost, 0);
  assert.equal(purchaseItemSchema.parse({ ...item, sellCost: "125.75" }).sellCost, 125.75);
  for (const sellCost of [-1, "not-a-number", Infinity, NaN]) {
    assert.equal(purchaseItemSchema.safeParse({ ...item, sellCost }).success, false);
  }
  assert.equal(ppfMasterSchema.parse({
    name: "Test PPF",
    sellCost: "95",
    pricingByVehicleType: [],
  }).sellCost, 95);
});

test("purchase cost does not replace existing bill totals, tax or payments", () => {
  const parsed = vendorPurchaseSchema.parse({
    vendorId: "test-vendor",
    items: [{ ...item, purchaseCost: 3500 }],
    totalAmount: 5000,
    gstEnabled: true,
    gstType: "external",
    cgstPercent: 9,
    sgstPercent: 9,
    cgstAmount: 450,
    sgstAmount: 450,
    grandTotal: 5900,
    paymentStatus: "paid",
    payments: [{ method: "Cash", amount: 5900 }],
  });
  assert.equal(parsed.items[0].purchaseCost, 3500);
  assert.equal(parsed.totalAmount, 5000);
  assert.equal(parsed.grandTotal, 5900);
  assert.equal(parsed.cgstAmount, 450);
  assert.equal(parsed.sgstAmount, 450);
  assert.equal(parsed.payments[0].amount, 5900);
});

test("changing informational or sales prices must not repeat stock receipts", () => {
  const before = [{ ...item, _id: "test-id" }];
  for (const purchaseCost of [0, 3500, 4000.25, undefined]) {
    assert.equal(purchaseItemsNeedMasterSync(before, [{
      ...item, id: "test-id", purchaseCost, sellingPrice: 0, sellCost: 950, ppfPricing: [],
    }]), false);
  }
  assert.equal(purchaseItemsNeedMasterSync(
    [{ ...item, sellCost: 500 }], [{ ...item, sellCost: 1500 }],
  ), false);
  assert.equal(purchaseItemsNeedMasterSync(
    [{ ...item, purchaseCost: 3500 }], [{ ...item }],
  ), false);
  assert.equal(purchaseItemsNeedMasterSync(
    [{ name: "Test PPF", itemType: "PPF", quantity: 100, unitPrice: 2000 }],
    [{ name: "Test PPF", itemType: "PPF", quantity: 100, unitPrice: 2000, purchaseCost: 1500 }],
  ), false);
});

test("actual item, stock and price changes still request the existing Master synchronization", () => {
  for (const changes of [{ quantity: 11 }, { unitPrice: 600 }, { name: "Another item" }]) {
    assert.equal(purchaseItemsNeedMasterSync([item], [{ ...item, ...changes }]), true);
  }
  assert.equal(purchaseItemsNeedMasterSync(
    [{ ...item, ppfPricing: [{ vehicleType: "SUV", warranty: "3 Years", price: 12000 }] }],
    [{ ...item, ppfPricing: [{ vehicleType: "SUV", warranty: "3 Years", price: 12500 }] }],
  ), false);
});
