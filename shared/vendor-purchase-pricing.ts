type PricedVendorItem = {
  itemType?: string;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
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
  return items.reduce((total, item) => {
    const unitPrice = nonNegativeNumber(item.unitPrice);
    return total + (item.itemType === "Accessory"
      ? unitPrice * nonNegativeNumber(item.quantity)
      : unitPrice);
  }, 0);
}

export function getVendorProfit(items: ReadonlyArray<PricedVendorItem>): number {
  return getVendorSellingTotal(items) - getVendorPurchaseSubtotal(items);
}

