// Legacy-only helper for inspecting the pre-existing Purchase Cost reference values.
// New supplier totals use the explicitly selected cost basis and quantity.
export function sumRecordedPurchaseCosts(
  items: ReadonlyArray<{ purchaseCost?: number | null }>,
): number | undefined {
  if (!items.some(item => item.purchaseCost != null)) return undefined;
  return items.reduce((sum, item) => sum + (item.purchaseCost ?? 0), 0);
}

// Only inventory-changing fields should trigger a stock receipt. Price-only edits
// are synchronized separately so they cannot accidentally receive the stock twice.
export function purchaseItemsNeedMasterSync(before: any[], after: any[]): boolean {
  const project = (items: any[]) => items.map(item => ({
    itemType: item.itemType || "PPF",
    name: String(item.name || "").trim(),
    categoryName: String(item.categoryName || "").trim(),
    rollName: String(item.rollName || "").trim(),
    hsnCode: String(item.hsnCode || "").trim(),
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unitPrice) || 0,
  }));
  return JSON.stringify(project(before)) !== JSON.stringify(project(after));
}
