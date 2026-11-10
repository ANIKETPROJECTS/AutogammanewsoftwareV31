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
  // The checkbox is not evidence of an amount received. Only entered payments count.
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    payments,
    paidAmount,
    // Zero-total invoices are settled because there is no balance due.
    isPaid: total === 0 || paidAmount >= total,
  };
}
