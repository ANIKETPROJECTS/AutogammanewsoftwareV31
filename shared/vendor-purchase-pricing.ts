type PricedVendorItem = {
  itemType?: string;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  purchaseCost?: number | string | null;
  supplierCostBasis?: "purchaseCost" | "unitPrice" | null;
  sellCost?: number | string | null;
  sellingPrice?: number | string | null;
};

type VendorPurchaseTotalsRecord = {
  items?: ReadonlyArray<PricedVendorItem> | null;
  totalAmount?: number | string | null;
  grandTotal?: number | string | null;
  gstType?: string | null;
  gstEnabled?: boolean;
  cgstAmount?: number | string | null;
  sgstAmount?: number | string | null;
  cgstPercent?: number | string | null;
  sgstPercent?: number | string | null;
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

function finiteStoredAmount(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getVendorPurchaseRecordSubtotal(record: VendorPurchaseTotalsRecord): number {
  const savedSubtotal = finiteStoredAmount(record.totalAmount);
  const calculatedSubtotal = getVendorPurchaseSubtotal(record.items || []);

  // Some older records have Mongo's default 0 even though their items have costs.
  if (savedSubtotal != null && savedSubtotal > 0) return savedSubtotal;
  if (calculatedSubtotal > 0) return calculatedSubtotal;
  return Math.max(0, savedSubtotal ?? 0);
}

export function getVendorPurchaseRecordGrandTotal(record: VendorPurchaseTotalsRecord): number {
  const savedGrandTotal = finiteStoredAmount(record.grandTotal);
  if (savedGrandTotal != null && savedGrandTotal > 0) return savedGrandTotal;

  const subtotal = getVendorPurchaseRecordSubtotal(record);
  if (subtotal <= 0) return 0;

  const gstType = record.gstType || (record.gstEnabled ? "external" : "none");
  if (gstType !== "external") return subtotal;

  const savedTax = nonNegativeNumber(record.cgstAmount) + nonNegativeNumber(record.sgstAmount);
  if (savedTax > 0) return subtotal + savedTax;

  const gstRate = nonNegativeNumber(record.cgstPercent) + nonNegativeNumber(record.sgstPercent);
  return gstRate > 0 ? subtotal * (1 + gstRate / 100) : subtotal;
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

