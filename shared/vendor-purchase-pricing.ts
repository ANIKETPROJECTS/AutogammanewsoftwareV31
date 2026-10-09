type PricedVendorItem = {
  itemType?: string;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  purchaseCost?: number | string | null;
  supplierCostBasis?: "purchaseCost" | "unitPrice" | null;
  sellCost?: number | string | null;
  sellingPrice?: number | string | null;
};

function nonNegativeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function getItemSellCost(item: PricedVendorItem): number {
  return nonNegativeNumber(item.sellCost ?? item.sellingPrice);
}

export function getItemSellTotal(item: PricedVendorItem): number {
  return getItemSellCost(item) * nonNegativeNumber(item.quantity);
}

export function getVendorSellingTotal(items: ReadonlyArray<PricedVendorItem>): number {
  return items.reduce((total, item) => total + getItemSellTotal(item), 0);
}

export function getVendorPurchaseSubtotal(items: ReadonlyArray<PricedVendorItem>): number {
  return items.reduce((total, item) => total + getVendorItemPurchaseTotal(item), 0);
}

export function getVendorItemPurchaseCost(item: PricedVendorItem): number {
  return item.supplierCostBasis === "purchaseCost"
    ? nonNegativeNumber(item.purchaseCost)
    : nonNegativeNumber(item.unitPrice);
}

export function getVendorItemPurchaseTotal(item: PricedVendorItem): number {
  const cost = getVendorItemPurchaseCost(item);
  const quantity = nonNegativeNumber(item.quantity);

  if (item.supplierCostBasis === "purchaseCost") return cost * quantity;

  // Legacy PPF Unit Cost was stored per roll; legacy accessory Unit Cost was per unit.
  return item.itemType === "Accessory" ? cost * quantity : cost;
}

export function getVendorProfit(items: ReadonlyArray<PricedVendorItem>): number {
  return getVendorSellingTotal(items) - getVendorPurchaseSubtotal(items);
}

