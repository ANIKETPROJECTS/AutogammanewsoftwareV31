export type GstMode = "exclusive" | "inclusive";

export function calculateGstAmounts(
  subtotal: number,
  gstRate: number,
  gstMode: GstMode | string = "exclusive",
) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safeRate = Math.max(0, Number(gstRate) || 0);
  const gstAmount = safeSubtotal * safeRate / 100;

  return {
    taxableSubtotal: safeSubtotal,
    gstAmount,
    totalAmount: gstMode === "inclusive"
      ? safeSubtotal
      : safeSubtotal + gstAmount,
  };
}

export function splitGstAmount(gstAmount: number) {
  const roundedGstAmount = Math.round(Math.max(0, Number(gstAmount) || 0));
  const halfGstAmount = roundedGstAmount / 2;
  return {
    sgstAmount: halfGstAmount,
    cgstAmount: halfGstAmount,
  };
}

export function formatGstAmount(value: number) {
  return Math.max(0, Number(value) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}