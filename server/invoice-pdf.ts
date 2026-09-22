type PdfInvoiceItem = {
  name?: string;
  quantity?: number;
  price?: number;
  type?: string;
  warranty?: string;
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
  items: PdfInvoiceItem[];
  subtotal: number;
  discount?: number;
  laborCharge?: number;
  gstPercentage?: number;
  gstMode?: string;
  gstAmount: number;
  totalAmount: number;
  date: string;
};

const GOOGLE_REVIEW_URL = "https://g.page/r/CTZwMy1Ct5JZEBE/review";
const INSTAGRAM_URL = "https://www.instagram.com/auto_gamma_/?hl=en";

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
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= maxLength) {
      current += ` ${word}`;
    } else {
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

export function createInvoicePdf(invoice: PdfInvoice): Buffer {
  const pages: string[][] = [[]];
  let pageIndex = 0;
  let y = 790;

  const newPage = () => {
    pages.push([]);
    pageIndex += 1;
    y = 790;
  };

  const command = (value: string, x: number, size = 10, gap = 15, bold = false) => {
    if (y < 70) newPage();
    pages[pageIndex].push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`);
    y -= gap;
  };

  const rule = (gap = 10) => {
    if (y < 70) newPage();
    pages[pageIndex].push(`50 ${y} m 545 ${y} l S`);
    y -= gap;
  };

  command(invoice.business, 50, 20, 27, true);
  command("Customer Invoice", 50, 11, 18);
  command(`Invoice No: ${invoice.invoiceNo}`, 50, 10, 15, true);
  command(`Date: ${invoice.date || "-"}`, 50, 10, 15);
  rule(18);

  command(`Customer: ${invoice.customerName}`, 50, 10, 15, true);
  command(`Phone: ${invoice.phoneNumber}`, 50, 10, 15);
  if (invoice.emailAddress) command(`Email: ${invoice.emailAddress}`, 50, 10, 15);

  const vehicle = [
    invoice.vehicleMake,
    invoice.vehicleModel,
    invoice.vehicleYear,
    invoice.vehicleType,
  ].filter(Boolean).join(" ");
  if (vehicle) command(`Vehicle: ${vehicle}`, 50, 10, 15);
  if (invoice.licensePlate) command(`Registration: ${invoice.licensePlate}`, 50, 10, 15);

  rule(18);
  command("DESCRIPTION", 50, 9, 16, true);
  command("QTY        AMOUNT", 430, 9, 16, true);
  rule(8);

  for (const item of invoice.items || []) {
    const itemLines = wrapText(
      `${item.type ? `${item.type}: ` : ""}${item.name || "Item"}${item.warranty ? ` - ${item.warranty}` : ""}`,
      55,
    );
    itemLines.forEach((line, index) => command(line, 50, 9, 13, index === 0));
    command(`${item.quantity ?? 1}        ${money((item.price || 0) * (item.quantity || 1))}`, 430, 9, 15);
  }

  if (invoice.laborCharge) command(`Labor charge: ${money(invoice.laborCharge)}`, 50, 9, 15);
  if (invoice.discount) command(`Discount: -${money(invoice.discount)}`, 50, 9, 15);
  rule(12);
  command(`Subtotal: ${money(invoice.subtotal)}`, 350, 10, 16);
  if (invoice.gstPercentage) {
    command(
      `GST ${invoice.gstPercentage}%${invoice.gstMode === "inclusive" ? " (included)" : ""}: ${money(invoice.gstAmount)}`,
      300,
      10,
      16,
    );
  }
  command(`GRAND TOTAL: ${money(invoice.totalAmount)}`, 300, 13, 24, true);
  command("Thank you for choosing Auto Gamma.", 50, 10, 18);
  command(`Google Review: ${GOOGLE_REVIEW_URL}`, 50, 8, 14);
  command(`Instagram: ${INSTAGRAM_URL}`, 50, 8, 16);

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
    objects[contentObjectId] = `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`;
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
      `/Contents ${contentObjectId} 0 R >>`;
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

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