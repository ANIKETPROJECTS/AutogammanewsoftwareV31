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
  vehicleModel?: string;
  licensePlate?: string;
  customerGstNumber?: string;
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
  const labeledLines = (label: string, value: string, valueWidth = width - 1) => {
    const lines = wrapReceiptText(value, Math.max(8, valueWidth - label.length - 1));
    return lines.map((line, index) =>
      index === 0
        ? row(label, line)
        : ` ${line}`,
    );
  };
  const sectionHeading = (heading: string) => `${boldOn}${heading}${boldOff}`;
  const payments = (data.payments || []).filter((payment) => Number(payment.amount) > 0);
  const gstSplit = splitGstAmount(Number(data.gstAmount) || 0);
  const gstModeLabel = data.gstMode === "inclusive" ? "Including GST" : "Excluding GST";
  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const balanceDue = Math.max(0, Number(data.totalAmount || 0) - paidAmount);
  const discount = Math.max(0, Number(data.discount) || 0);
  const laborCharge = Math.max(0, Number(data.laborCharge) || 0);
  const baseAmount = Math.max(0, Number(data.subtotal || 0) - laborCharge);
  const netSubtotal = Math.max(0, Number(data.subtotal || 0) - discount);
  const businessProfile = data.business === "Auto Gamma"
    ? {
        address: "Shop no. 09 & 10, Shreeji Parasio, Prasad Hotel Road, near Panvel Highway, beside Tulsi Aangan Soc, Katrap, Badlapur",
        phone: "+91 77380 16768",
        gst: "GST: 27ACEFA1874A1ZS",
      }
    : {
        address: "",
        phone: "+91 77380 16768",
        gst: "",
      };
  const itemLines = data.items.flatMap((item) => {
    const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
    const nameLines = wrapReceiptText(item.name, width - 2);
    return [
      `${boldOn}${nameLines[0]}${boldOff}`,
      ...nameLines.slice(1),
      item.warranty ? `Warranty: ${item.warranty}` : "",
      row(`${item.quantity ?? 1} x ${receiptMoney(item.price)}`, receiptMoney(itemTotal)),
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
    sectionHeading("SALES RECEIPT"),
    businessProfile.address
      ? wrapReceiptText(businessProfile.address, width).join("\n")
      : "",
    businessProfile.phone,
    businessProfile.gst,
    left,
    doubleDivider,
    sectionHeading("INVOICE DETAILS"),
    row("Invoice No", data.invoiceNo || "Pending"),
    row("Date", receiptDate(data.printedAt)),
    divider,
    sectionHeading("BILL TO"),
    ...labeledLines("Name", data.customerName || "Walk-in customer"),
    ...(data.phone ? labeledLines("Phone", data.phone) : []),
    ...(data.vehicleModel || data.vehicle
      ? labeledLines("Model", data.vehicleModel || data.vehicle)
      : []),
    ...(data.licensePlate ? labeledLines("Plate", data.licensePlate) : []),
    ...(data.customerGstNumber ? labeledLines("GSTIN", data.customerGstNumber) : []),
    divider,
    sectionHeading("ITEMS"),
    row("Description", "Amount"),
    divider,
    itemLines.join("\n"),
    divider,
    sectionHeading("SUMMARY"),
    row("Base amount", receiptMoney(baseAmount)),
    laborCharge ? row("Labor charges", receiptMoney(laborCharge)) : "",
    discount ? row("Discount", `- ${receiptMoney(discount)}`) : "",
    row(
      data.gstPercentage && data.gstMode === "inclusive"
        ? "Subtotal (GST incl.)"
        : "Subtotal",
      receiptMoney(netSubtotal),
    ),
    data.gstPercentage ? row("GST mode", gstModeLabel) : "",
    data.gstPercentage
      ? row(`SGST ${(data.gstPercentage / 2).toFixed(2)}%`, `Rs.${formatGstAmount(gstSplit.sgstAmount)}`)
      : "",
    data.gstPercentage
      ? row(`CGST ${(data.gstPercentage / 2).toFixed(2)}%`, `Rs.${formatGstAmount(gstSplit.cgstAmount)}`)
      : "",
    doubleDivider,
    `${boldOn}${row("GRAND TOTAL", receiptMoney(data.totalAmount))}${boldOff}`,
    doubleDivider,
    sectionHeading("PAYMENT DETAILS"),
    row("Paid", receiptMoney(paidAmount)),
    `${boldOn}${row("Balance due", receiptMoney(balanceDue))}${boldOff}`,
    paymentLines || "Payment pending",
    divider,
    center,
    boldOn,
    "THANK YOU FOR YOUR BUSINESS",
    boldOff,
    data.business,
    "\n\n",
    left,
    cut,
  ].filter((line) => line !== "").join("\n");
}