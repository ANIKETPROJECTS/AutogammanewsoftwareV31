type DisplayItem = { type?: string; name?: string };

export function complimentaryInvoiceNote(items: DisplayItem[]) {
  const names = items.filter(item => item.type === "Complimentary")
    .map(item => (item.name || "").trim()).filter(Boolean);
  return names.length ? `Complimentary: ${names.join("; ")}.` : "";
}

export function invoiceServiceItems<T extends DisplayItem>(items: T[]) {
  return items.filter(item => item.type !== "Labor" && item.type !== "Complimentary");
}

export function escapeInvoiceHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}
