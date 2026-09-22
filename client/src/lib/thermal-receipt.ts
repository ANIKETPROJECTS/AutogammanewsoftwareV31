import { formatGstAmount, splitGstAmount } from "@shared/gst";

export type ThermalReceiptItem = {
  name: string;
  quantity?: number;
  price: number;
  warranty?: string;
};

export type ThermalReceiptPayment = {
  amount: number;
  method: string;
};

export type ThermalReceiptData = {
  business: string;
  invoiceNo: string;
  printedAt?: Date;
  customerName: string;
  phone?: string;
  vehicle?: string;
  items: ThermalReceiptItem[];
  subtotal: number;
  discount?: number;
  laborCharge?: number;
  gstPercentage?: number;
  gstMode?: "inclusive" | "exclusive";
  gstAmount: number;
  totalAmount: number;
  payments?: ThermalReceiptPayment[];
};

function receiptMoney(value: number | undefined): string {
  return `Rs.${Math.max(0, Math.round(Number(value) || 0)).toLocaleString("en-IN")}`;
}

function wrapReceiptText(value: string, maxLength: number): string[] {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word.slice(0, maxLength);
    } else if (`${current} ${word}`.length <= maxLength) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word.slice(0, maxLength);
    }
  }
  if (current) lines.push(current);
  return lines;
}

function receiptDate(value?: Date): string {
  return (value || new Date()).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function buildThermalReceipt(data: ThermalReceiptData): string {
  const width = 48;
  const ESC = "\x1b";
  const center = `${ESC}a\x01`;
  const left = `${ESC}a\x00`;
  const boldOn = `${ESC}E\x01`;
  const boldOff = `${ESC}E\x00`;
  const largeOn = `${ESC}\x21\x11`;
  const largeOff = `${ESC}\x21\x00`;
  const cut = "\x1dV\x00";
  const divider = "-".repeat(width);
  const doubleDivider = "=".repeat(width);
  const row = (label: string, value: string) => {
    const available = Math.max(1, width - value.length - 1);
    return `${label.slice(0, available).padEnd(available)} ${value}`;
  };
  const payments = (data.payments || []).filter((payment) => Number(payment.amount) > 0);
  const gstSplit = splitGstAmount(Number(data.gstAmount) || 0);
  const gstModeLabel = data.gstMode === "inclusive" ? "Including GST" : "Excluding GST";
  const itemLines = data.items.flatMap((item) => {
    const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
    const nameLines = wrapReceiptText(item.name, width);
    return [
      `${boldOn}${nameLines[0]}${boldOff}`,
      ...nameLines.slice(1),
      item.warranty ? `Warranty: ${item.warranty}` : "",
      `${item.quantity ?? 1} x ${receiptMoney(item.price)}`,
      row("Item total", receiptMoney(itemTotal)),
    ].filter(Boolean);
  });
  const paymentLines = payments
    .map((payment) => row(payment.method, receiptMoney(payment.amount)))
    .join("\n");

  return [
    center,
    largeOn,
    boldOn,
    data.business === "Auto Gamma" ? "AUTO GAMMA" : data.business,
    boldOff,
    largeOff,
    "SALES RECEIPT",
    receiptDate(data.printedAt),
    left,
    divider,
    `${boldOn}${row("Invoice No", data.invoiceNo || "Pending")}${boldOff}`,
    `${boldOn}${row("Customer", data.customerName || "Walk-in customer")}${boldOff}`,
    data.phone ? row("Phone", data.phone) : "",
    data.vehicle ? row("Vehicle", data.vehicle) : "",
    divider,
    itemLines.join("\n"),
    data.laborCharge ? row("Labor", receiptMoney(data.laborCharge)) : "",
    data.discount ? row("Discount", `- ${receiptMoney(data.discount)}`) : "",
    divider,
    row("Subtotal", receiptMoney(data.subtotal)),
    data.gstPercentage
      ? row("GST mode", gstModeLabel)
      : "",
    data.gstPercentage
      ? row(`SGST ${(data.gstPercentage / 2).toFixed(2)}%`, `Rs.${formatGstAmount(gstSplit.sgstAmount)}`)
      : "",
    data.gstPercentage
      ? row(`CGST ${(data.gstPercentage / 2).toFixed(2)}%`, `Rs.${formatGstAmount(gstSplit.cgstAmount)}`)
      : "",
    doubleDivider,
    `${boldOn}${row("TOTAL", receiptMoney(data.totalAmount))}${boldOff}`,
    doubleDivider,
    row("Paid", receiptMoney(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))),
    `${boldOn}${row("Balance due", receiptMoney(Math.max(0, data.totalAmount - payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))))}${boldOff}`,
    divider,
    `${boldOn}PAYMENTS${boldOff}`,
    paymentLines || "Payment pending",
    "",
    center,
    boldOn,
    `Thank you for choosing ${data.business}`,
    boldOff,
    "\n\n",
    left,
    cut,
  ].filter((line) => line !== "").join("\n");
}