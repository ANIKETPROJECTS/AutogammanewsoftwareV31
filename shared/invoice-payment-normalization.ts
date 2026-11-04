export type InvoicePaymentEntry = {
  amount?: number | string;
  method?: string;
  date?: string;
  [key: string]: unknown;
};

export function normalizeInvoicePayments(
  entries: InvoicePaymentEntry[] | undefined,
  invoiceTotal: number,
  markAsPaid: boolean,
  defaultDate = new Date().toISOString().slice(0, 10),
) {
  const payments = (entries || [])
    .map(entry => ({ ...entry, amount: Math.max(0, Number(entry.amount) || 0) }))
    .filter(entry => entry.amount > 0);
  const total = Math.max(0, Number(invoiceTotal) || 0);
  let paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

  if (markAsPaid && total > paidAmount) {
    const shortfall = total - paidAmount;
    if (payments.length) {
      payments[0].amount += shortfall;
    } else {
      payments.push({ amount: shortfall, method: "Cash", date: defaultDate });
    }
    paidAmount = total;
  }

  return {
    payments,
    paidAmount,
    isPaid: total > 0 && paidAmount >= total,
  };
}
