export const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "GPay",
  "Phone Pay",
  "Bhim",
  "Card",
  "Bank Transfer",
] as const;

// Keep this value available when editing invoices created before UPI/GPay were separated.
export const LEGACY_PAYMENT_METHODS = ["UPI / GPay"] as const;
