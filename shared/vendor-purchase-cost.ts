// Informational amounts only: never use this sum for bills, tax, payments or stock.
export function sumRecordedPurchaseCosts(
  items: ReadonlyArray<{ purchaseCost?: number | null }>,
): number | undefined {
  if (!items.some(item => item.purchaseCost != null)) return undefined;
  return items.reduce((sum, item) => sum + (item.purchaseCost ?? 0), 0);
}

// Ignore informational cost and database IDs when deciding whether Masters need syncing.
export function purchaseItemsNeedMasterSync(before: any[], after: any[]): boolean {
  const project = (items: any[]) => items.map(item => ({
    itemType: item.itemType || "PPF",
    name: String(item.name || "").trim(),
    categoryName: String(item.categoryName || "").trim(),
    rollName: String(item.rollName || "").trim(),
    hsnCode: String(item.hsnCode || "").trim(),
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unitPrice) || 0,
    sellingPrice: Number(item.sellingPrice) || 0,
    ppfPricing: item.ppfPricing || [],
  }));
  return JSON.stringify(project(before)) !== JSON.stringify(project(after));
}
