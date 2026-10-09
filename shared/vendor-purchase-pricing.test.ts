import assert from "node:assert/strict";
import test from "node:test";
import {
  getItemSellCost, getItemSellTotal, getVendorItemPurchaseTotal, getVendorProfit,
  getVendorPurchaseSubtotal, getVendorSellingTotal,
} from "./vendor-purchase-pricing";

test("sell total is sell cost per unit times quantity for accessories and PPF stock", () => {
  assert.equal(getItemSellTotal({ itemType: "Accessory", sellCost: 125.5, quantity: 4 }), 502);
  assert.equal(getItemSellTotal({ itemType: "PPF", sellCost: 175, quantity: 20 }), 3500);
  assert.equal(getVendorSellingTotal([
    { itemType: "Accessory", sellCost: 125, quantity: 2 },
    { itemType: "PPF", sellCost: 175, quantity: 10 },
  ]), 2000);
});

test("new sellCost takes precedence over the legacy sale-price field", () => {
  assert.equal(getItemSellCost({ sellCost: 0, sellingPrice: 750 }), 0);
  assert.equal(getItemSellCost({ sellingPrice: 750 }), 750);
});

test("profit uses sell totals minus supplier purchase subtotals, not the reference-only purchaseCost", () => {
  assert.equal(getVendorProfit([
    { itemType: "Accessory", unitPrice: 60, quantity: 4, sellCost: 100 },
    { itemType: "PPF", unitPrice: 2200, quantity: 25, sellCost: 150 },
  ]), 1710);
});

test("new purchase costs multiply the selected-unit cost by quantity", () => {
  const item = {
    itemType: "Accessory",
    quantity: 4,
    unitPrice: 0,
    purchaseCost: 49,
    supplierCostBasis: "purchaseCost" as const,
    sellCost: 150,
  };
  assert.equal(getVendorItemPurchaseTotal(item), 196);
  assert.equal(getVendorPurchaseSubtotal([item]), 196);
  assert.equal(getVendorSellingTotal([item]), 600);
  assert.equal(getVendorProfit([item]), 404);
});

test("legacy purchases retain Unit Cost totals when Purchase Cost differs", () => {
  const oldAccessory = {
    itemType: "Accessory",
    quantity: 4,
    unitPrice: 49,
    purchaseCost: 20,
  };
  const oldPPF = {
    itemType: "PPF",
    quantity: 4,
    unitPrice: 49,
    purchaseCost: 20,
  };
  assert.equal(getVendorItemPurchaseTotal(oldAccessory), 196);
  assert.equal(getVendorItemPurchaseTotal(oldPPF), 49);
});

test("invalid legacy sell values cannot leak through to customer pricing", () => {
  assert.equal(getItemSellCost({ sellCost: Number.POSITIVE_INFINITY, sellingPrice: -10 }), 0);
});
