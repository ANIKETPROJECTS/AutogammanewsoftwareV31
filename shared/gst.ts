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