import { calculateGstAmounts, splitGstAmount, formatGstAmount } from "@shared/gst";

type PdfInvoiceItem = {
  name?: string;
  quantity?: number;
  price?: number;
  type?: string;
  category?: string;
  hsnCode?: string;
  warranty?: string;
  rollUsed?: number;
};

type PdfInvoice = {
  invoiceNo: string;
  business: string;
  customerName: string;
  phoneNumber: string;
  emailAddress?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  licensePlate?: string;
  vehicleType?: string;
  customerGstNumber?: string;
  items: PdfInvoiceItem[];
  subtotal: number;
  discount?: number;
  laborCharge?: number;
  gstPercentage?: number;
  gstMode?: string;
  gstAmount: number;
  totalAmount: number;
  date: string;
  payments?: Array<{ amount?: number; method?: string; date?: string }>;
};

function pdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/[^\x20-\x7e]/g, "-")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(value: unknown, maxLength: number): string[] {
  const text = String(value ?? "").trim() || "-";
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maxLength) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function money(value: number | undefined): string {
  return `INR ${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
}

function formatDate(value: string | Date | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function itemDescriptionLines(item: PdfInvoiceItem): string[] {
  const rawName = String(item.name || "Item").trim();
  const firstLine = rawName.split("\n")[0];
  const displayName = firstLine.replace(/\s*\([^)]*\)\s*$/, "").trim() || firstLine;
  const details = rawName
    .split("\n")
    .slice(1)
    .map((detail) => detail.replace(/^[\s,]+/, "").trim())
    .filter(Boolean);

  if (item.type === "PPF" && item.rollUsed && item.rollUsed > 0) {
    details.push(`Total Sq.ft Roll Used: ${item.rollUsed} sq.ft`);
  }
  if (item.warranty) details.push(`Warranty: ${item.warranty}`);
  if (item.type === "Accessory" && item.category) details.push(`Category: ${item.category}`);

  return [
    ...wrapText(displayName, 31),
    ...details.flatMap((detail) => wrapText(detail, 31)),
  ];
}

export function createInvoicePdf(invoice: PdfInvoice): Buffer {
  const pages: string[][] = [[]];
  let pageIndex = 0;
  let y = 790;

  const newPage = () => {
    pages.push([]);
    pageIndex += 1;
    y = 790;
  };

  const ensureSpace = (height: number) => {
    if (y - height < 55) newPage();
  };

  const textAt = (value: unknown, x: number, top: number, size = 10, bold = false) => {
    pages[pageIndex].push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${top} Td (${pdfText(value)}) Tj ET`,
    );
  };

  const text = (value: unknown, x: number, size = 10, gap = 15, bold = false) => {
    ensureSpace(gap);
    textAt(value, x, y, size, bold);
    y -= gap;
  };

  const lineAt = (top: number, x1 = 50, x2 = 545, width = 1) => {
    pages[pageIndex].push(`${width} w ${x1} ${top} m ${x2} ${top} l S`);
  };

  const line = (gap = 10) => {
    ensureSpace(gap);
    lineAt(y);
    y -= gap;
  };

  const box = (top: number, height: number) => {
    pages[pageIndex].push(
      `0.97 0.98 0.99 rg 50 ${top - height} 495 ${height} re f 0 0 0 rg`,
    );
  };

  const businessAddress =
    "Shop no. 09 & 10, Shreeji Parasio, Prasad Hotel Road, Badlapur, Maharashtra 421503";
  const businessEmail = invoice.business === "AGNX" ? "" : "support@autogamma.in";

  // Header matches the business invoice shown in the software preview.
  text(invoice.business === "AGNX" ? "AGNX" : "Auto Gamma", 50, 22, 29, true);
  text(`ADDRESS: ${businessAddress}`, 50, 8, 11);
  text("CONTACT: +91 77380 16768", 50, 8, 11);
  if (businessEmail) text(`MAIL: ${businessEmail}`, 50, 8, 11);
  if (businessEmail) text("WEBSITE: www.autogamma.in", 50, 8, 11);

  textAt("INVOICE DETAILS", 425, 790, 8, true);
  textAt(`#${invoice.invoiceNo}`, 425, 775, 16, true);
  textAt(formatDate(invoice.date), 425, 758, 9);
  if (invoice.business === "Auto Gamma") textAt("GST: 27ACEFA1874A1ZS", 425, 743, 8, true);
  lineAt(725, 50, 545, 2);
  y = 705;

  const panelTop = y;
  box(panelTop, 90);
  textAt("BILL TO", 65, panelTop - 17, 8, true);
  textAt(invoice.customerName, 65, panelTop - 33, 13, true);
  textAt(invoice.phoneNumber, 65, panelTop - 48, 9);
  if (invoice.emailAddress) textAt(invoice.emailAddress, 65, panelTop - 62, 8);
  if (invoice.customerGstNumber) textAt(`GST: ${invoice.customerGstNumber}`, 65, panelTop - 76, 8);

  textAt("VEHICLE DETAILS", 360, panelTop - 17, 8, true);
  textAt(`Make / Model: ${invoice.vehicleMake || "-"} ${invoice.vehicleModel || ""}`, 360, panelTop - 34, 8);
  textAt(`Year: ${invoice.vehicleYear || "-"}`, 360, panelTop - 48, 8);
  textAt(`License Plate: ${invoice.licensePlate || "-"}`, 360, panelTop - 62, 8);
  if (invoice.vehicleType) textAt(`Type: ${invoice.vehicleType}`, 360, panelTop - 76, 8);
  y = panelTop - 108;

  text("SERVICE ITEMS", 50, 8, 14, true);
  const tableHeaderY = y;
  pages[pageIndex].push(
    `0.12 0.16 0.22 rg 50 ${tableHeaderY - 18} 495 18 re f 1 1 1 rg`,
  );
  textAt("SR", 58, tableHeaderY - 13, 7, true);
  textAt("DESCRIPTION", 82, tableHeaderY - 13, 7, true);
  textAt("TYPE", 285, tableHeaderY - 13, 7, true);
  textAt("HSN", 335, tableHeaderY - 13, 7, true);
  textAt("RATE", 385, tableHeaderY - 13, 7, true);
  textAt("QTY", 450, tableHeaderY - 13, 7, true);
  textAt("AMOUNT", 485, tableHeaderY - 13, 7, true);
  pages[pageIndex].push("0 0 0 rg");
  y = tableHeaderY - 28;

  const serviceItems = (invoice.items || []).filter((item) => item.type !== "Labor");
  serviceItems.forEach((item, index) => {
    const descriptionLines = itemDescriptionLines(item);
    const rowHeight = Math.max(25, descriptionLines.length * 10 + 8);
    ensureSpace(rowHeight + 4);
    const rowTop = y;
    if (index % 2 === 1) {
      pages[pageIndex].push(
        `0.97 0.98 0.99 rg 50 ${rowTop - rowHeight + 4} 495 ${rowHeight} re f 0 0 0 rg`,
      );
    }

    descriptionLines.forEach((description, lineIndex) => {
      textAt(description, 82, rowTop - 11 - lineIndex * 10, lineIndex === 0 ? 8 : 7, lineIndex === 0);
    });
    textAt(String(index + 1), 58, rowTop - 11, 7);
    textAt(item.type || "-", 285, rowTop - 11, 7);
    textAt(item.hsnCode || "-", 335, rowTop - 11, 7);
    textAt(money(item.price), 385, rowTop - 11, 7);
    textAt(String(item.quantity ?? 1), 450, rowTop - 11, 7);
    textAt(money((item.price || 0) * (item.quantity || 1)), 485, rowTop - 11, 7, true);
    lineAt(rowTop - rowHeight + 3, 50, 545, 0.3);
    y = rowTop - rowHeight;
  });

  const laborCharge = Number(invoice.laborCharge) || 0;
  const discount = Number(invoice.discount) || 0;
  const grandTotal = Math.max(0, Number(invoice.subtotal) - discount);
  const gstRate = invoice.business === "AGNX" ? 0 : Number(invoice.gstPercentage) || 0;
  const gstIncluded =
    invoice.gstMode === "inclusive" ||
    (invoice.gstMode !== "exclusive" &&
      gstRate > 0 &&
      Math.abs((Number(invoice.totalAmount) || grandTotal) - grandTotal) < 0.01);
  const gst = calculateGstAmounts(grandTotal, gstRate, gstIncluded ? "inclusive" : "exclusive");
  const displayedSubtotal = gstIncluded ? grandTotal : gst.taxableSubtotal;
  const { sgstAmount, cgstAmount } = splitGstAmount(gst.gstAmount);

  ensureSpace(150);
  y -= 14;
  const summaryX = 325;
  textAt("Base Amount", summaryX, y, 8);
  textAt(money(Math.max(0, Number(invoice.subtotal) - laborCharge)), 465, y, 8, true);
  y -= 15;
  if (laborCharge > 0) {
    textAt("Labor Charges", summaryX, y, 8);
    textAt(money(laborCharge), 465, y, 8, true);
    y -= 15;
  }
  if (discount > 0) {
    textAt("Discount", summaryX, y, 8);
    textAt(`(-) ${money(discount)}`, 465, y, 8, true);
    y -= 15;
  }
  textAt(`SubTotal${gstIncluded ? " (GST included)" : ""}`, summaryX, y, 8);
  textAt(money(displayedSubtotal), 465, y, 8, true);
  y -= 15;
  if (gstRate > 0) {
    textAt(`(+) SGST: ${(gstRate / 2).toFixed(2)}%`, summaryX, y, 8);
    textAt(`INR ${formatGstAmount(sgstAmount)}`, 465, y, 8, true);
    y -= 15;
    textAt(`(+) CGST: ${(gstRate / 2).toFixed(2)}%`, summaryX, y, 8);
    textAt(`INR ${formatGstAmount(cgstAmount)}`, 465, y, 8, true);
    y -= 17;
  }
  pages[pageIndex].push("0.86 0.15 0.15 rg");
  textAt("GRAND TOTAL", summaryX, y, 11, true);
  textAt(`INR ${Math.round(gst.totalAmount).toLocaleString("en-IN")}`, 445, y, 11, true);
  pages[pageIndex].push("0 0 0 rg");
  y -= 22;

  if (invoice.payments?.length) {
    const paid = invoice.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const remaining = Math.max(0, Math.round(gst.totalAmount) - Math.round(paid));
    text("PAYMENT STATUS", 50, 8, 13, true);
    text(`${remaining === 0 ? "PAID" : "PARTIAL"}   Paid: ${money(paid)}`, 50, 8, 13, true);
    for (const payment of invoice.payments) {
      text(`${payment.method || "Payment"} - ${formatDate(payment.date)}: ${money(payment.amount)}`, 65, 8, 12);
    }
    if (remaining > 0) text(`Remaining Balance: ${money(remaining)}`, 65, 8, 14, true);
  }

  ensureSpace(50);
  line(12);
  text("Please Note: The booking amount mentioned in this invoice is non-refundable.", 50, 8, 12);
  text("This amount secures your reservation and cannot be returned in case of cancellation or modification.", 50, 8, 14);
  text("Thank You For Your Business", 205, 11, 18, true);

  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  let nextObjectId = 5;

  for (const page of pages) {
    const pageObjectId = nextObjectId++;
    const contentObjectId = nextObjectId++;
    pageObjectIds.push(pageObjectId);
    contentObjectIds.push(contentObjectId);
    const content = page.join("\n");
    objects[contentObjectId] =
      `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`;
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
      `/Contents ${contentObjectId} 0 R >>`;
  }

  objects[2] =
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] ` +
    `/Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}