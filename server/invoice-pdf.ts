import { calculateGstAmounts, splitGstAmount, formatGstAmount } from "@shared/gst";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

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

type PdfImage = {
  width: number;
  height: number;
  rgb: Buffer;
  alpha: Buffer;
};

let autoGammaLogo: PdfImage | null | undefined;

function paethPredictor(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function loadAutoGammaLogo(): PdfImage | null {
  if (autoGammaLogo !== undefined) return autoGammaLogo;

  const candidates = [
    resolve(process.cwd(), "client/src/assets/autogamma-logo.png"),
    resolve(process.cwd(), "attached_assets/image_1769446487293.png"),
  ];
  const filePath = candidates.find((candidate) => existsSync(candidate));
  if (!filePath) {
    autoGammaLogo = null;
    return autoGammaLogo;
  }

  try {
    const png = readFileSync(filePath);
    if (png.readUInt32BE(0) !== 0x89504e47 || png.readUInt32BE(12) !== 0x49484452) {
      autoGammaLogo = null;
      return autoGammaLogo;
    }

    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const bitDepth = png[24];
    const colorType = png[25];
    if (bitDepth !== 8 || colorType !== 6) {
      autoGammaLogo = null;
      return autoGammaLogo;
    }

    const idat: Buffer[] = [];
    let offset = 8;
    while (offset + 8 <= png.length) {
      const length = png.readUInt32BE(offset);
      const type = png.subarray(offset + 4, offset + 8).toString("ascii");
      const data = png.subarray(offset + 8, offset + 8 + length);
      if (type === "IDAT") idat.push(data);
      offset += 12 + length;
      if (type === "IEND") break;
    }

    const inflated = inflateSync(Buffer.concat(idat));
    const bytesPerPixel = 4;
    const rowLength = width * bytesPerPixel;
    const raw = Buffer.alloc(height * rowLength);
    let sourceOffset = 0;
    for (let row = 0; row < height; row += 1) {
      const filter = inflated[sourceOffset++];
      const rowOffset = row * rowLength;
      const previousRowOffset = (row - 1) * rowLength;
      for (let column = 0; column < rowLength; column += 1) {
        const rawByte = inflated[sourceOffset++];
        const left = column >= bytesPerPixel ? raw[rowOffset + column - bytesPerPixel] : 0;
        const above = row > 0 ? raw[previousRowOffset + column] : 0;
        const upperLeft =
          row > 0 && column >= bytesPerPixel
            ? raw[previousRowOffset + column - bytesPerPixel]
            : 0;
        let value = rawByte;
        if (filter === 1) value = rawByte + left;
        else if (filter === 2) value = rawByte + above;
        else if (filter === 3) value = rawByte + Math.floor((left + above) / 2);
        else if (filter === 4) value = rawByte + paethPredictor(left, above, upperLeft);
        raw[rowOffset + column] = value & 0xff;
      }
    }

    const rgb = Buffer.alloc(width * height * 3);
    const alpha = Buffer.alloc(width * height);
    for (let index = 0; index < width * height; index += 1) {
      rgb[index * 3] = raw[index * 4];
      rgb[index * 3 + 1] = raw[index * 4 + 1];
      rgb[index * 3 + 2] = raw[index * 4 + 2];
      alpha[index] = raw[index * 4 + 3];
    }
    autoGammaLogo = { width, height, rgb, alpha };
    return autoGammaLogo;
  } catch (error) {
    console.warn("[invoice-pdf] Unable to load the Auto Gamma logo:", error);
    autoGammaLogo = null;
    return autoGammaLogo;
  }
}

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
  const logo = invoice.business === "Auto Gamma" ? loadAutoGammaLogo() : null;

  // This follows the same sections and business-specific rules as PrintableInvoice.
  if (logo) {
    pages[pageIndex].push(
      `q 170 0 0 ${Math.round(170 * logo.height / logo.width)} 50 748 cm /Logo Do Q`,
    );
  } else {
    pages[pageIndex].push("1 0 0 rg");
    textAt("AGNX", 50, 780, 24, true);
    pages[pageIndex].push("0 0 0 rg");
  }
  let headerY = logo ? 730 : 742;
  if (invoice.business !== "AGNX") {
    for (const addressLine of wrapText(businessAddress, 52)) {
      textAt(`ADDRESS: ${addressLine}`, 50, headerY, 8, false);
      headerY -= 11;
    }
  }
  textAt("CONTACT: +91 77380 16768", 50, headerY, 8);
  headerY -= 11;
  if (businessEmail) {
    textAt(`MAIL: ${businessEmail}`, 50, headerY, 8);
    headerY -= 11;
    textAt("WEBSITE: www.autogamma.in", 50, headerY, 8);
  }

  textAt("INVOICE DETAILS", 425, 790, 8, true);
  textAt(`#${invoice.invoiceNo}`, 425, 775, 16, true);
  textAt(formatDate(invoice.date), 425, 758, 9);
  if (invoice.business === "Auto Gamma") textAt("GST: 27ACEFA1874A1ZS", 425, 743, 8, true);
  pages[pageIndex].push("0.86 0.15 0.15 rg");
  lineAt(710, 50, 545, 2);
  pages[pageIndex].push("0 0 0 rg");
  y = 686;

  const panelTop = y;
  const paymentHeight = invoice.payments?.length ? 158 : 90;
  box(panelTop, paymentHeight);
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
  if (invoice.payments?.length) {
    const paid = invoice.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const remaining = Math.max(0, Math.round(Number(invoice.totalAmount) || 0) - Math.round(paid));
    pages[pageIndex].push("0.13 0.60 0.32 rg");
    textAt("PAYMENT STATUS", 65, panelTop - 95, 8, true);
    pages[pageIndex].push("0 0 0 rg");
    textAt(`${remaining === 0 ? "PAID" : "PARTIAL"}   ${money(paid)}`, 65, panelTop - 113, 9, true);
    let paymentY = panelTop - 133;
    for (const payment of invoice.payments) {
      textAt(`${payment.method || "Payment"} - ${formatDate(payment.date)}`, 65, paymentY, 8);
      textAt(money(payment.amount), 250, paymentY, 8, true);
      paymentY -= 12;
    }
  }
  y = panelTop - paymentHeight - 24;

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
  const summaryRows = 2 + (laborCharge > 0 ? 1 : 0) + (discount > 0 ? 1 : 0) + (gstRate > 0 ? 2 : 0);
  const summaryHeight = summaryRows * 15 + 28;
  pages[pageIndex].push(
    `0.97 0.98 0.99 rg 315 ${y - summaryHeight + 9} 230 ${summaryHeight} re f 0 0 0 rg`,
  );
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

  ensureSpace(50);
  pages[pageIndex].push("0.86 0.15 0.15 rg");
  lineAt(y, 50, 545, 0.8);
  pages[pageIndex].push("0 0 0 rg");
  y -= 18;
  textAt(
    "Please Note: Please be advised that the booking amount mentioned in this invoice is non-refundable. This amount",
    50,
    y,
    8,
  );
  y -= 12;
  textAt("secures your reservation and cannot be returned in case of cancellation or modification.", 50, y, 8);
  y -= 30;
  textAt("Thank You For Your Business", 205, y, 11, true);

  const objects: Array<string | Buffer | undefined> = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  let nextObjectId = 5;
  let logoObjectId: number | undefined;
  let logoMaskObjectId: number | undefined;

  if (logo) {
    logoObjectId = nextObjectId++;
    logoMaskObjectId = nextObjectId++;
    objects[logoObjectId] = Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
          `/SMask ${logoMaskObjectId} 0 R /Length ${deflateSync(logo.rgb).length} >>\nstream\n`,
        "ascii",
      ),
      deflateSync(logo.rgb),
      Buffer.from("\nendstream", "ascii"),
    ]);
    objects[logoMaskObjectId] = Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} ` +
          `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode ` +
          `/Length ${deflateSync(logo.alpha).length} >>\nstream\n`,
        "ascii",
      ),
      deflateSync(logo.alpha),
      Buffer.from("\nendstream", "ascii"),
    ]);
  }

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
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> ` +
      `${logoObjectId ? `/XObject << /Logo ${logoObjectId} 0 R >> ` : ""}>> ` +
      `/Contents ${contentObjectId} 0 R >>`;
  }

  objects[2] =
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] ` +
    `/Count ${pageObjectIds.length} >>`;

  const pdfParts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xff\xff\xff\xff\n", "binary")];
  const offsets: number[] = [0];
  let pdfLength = pdfParts[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    const object = objects[id];
    if (object === undefined) continue;
    offsets[id] = pdfLength;
    const body = Buffer.isBuffer(object) ? object : Buffer.from(object, "ascii");
    const objectParts = [
      Buffer.from(`${id} 0 obj\n`, "ascii"),
      body,
      Buffer.from("\nendobj\n", "ascii"),
    ];
    pdfParts.push(...objectParts);
    pdfLength += objectParts.reduce((sum, part) => sum + part.length, 0);
  }

  const xrefOffset = pdfLength;
  const xrefParts = [`xref\n0 ${objects.length}\n0000000000 65535 f \n`];
  for (let id = 1; id < objects.length; id += 1) {
    xrefParts.push(
      offsets[id] === undefined
        ? "0000000000 00000 f \n"
        : `${String(offsets[id]).padStart(10, "0")} 00000 n \n`,
    );
  }
  xrefParts.push(
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );
  pdfParts.push(Buffer.from(xrefParts.join(""), "ascii"));

  return Buffer.concat(pdfParts);
}