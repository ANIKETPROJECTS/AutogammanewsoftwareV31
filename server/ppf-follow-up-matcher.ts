type FollowUpItem = {
  name?: unknown;
  type?: unknown;
  warranty?: unknown;
  warrantyPeriod?: unknown;
};

export type FollowUpJobCard = {
  _id?: unknown;
  id?: unknown;
  jobNo?: unknown;
  date?: unknown;
  completedDate?: unknown;
  status?: unknown;
  customerName?: unknown;
  phoneNumber?: unknown;
  make?: unknown;
  model?: unknown;
  year?: unknown;
  licensePlate?: unknown;
  ppfs?: FollowUpItem[];
  services?: FollowUpItem[];
};

export type FollowUpInvoice = {
  jobCardId?: unknown;
  jobNo?: unknown;
  jobCardNo?: unknown;
  jobCardNumber?: unknown;
  date?: unknown;
  customerName?: unknown;
  phoneNumber?: unknown;
  vehicleMake?: unknown;
  vehicleModel?: unknown;
  vehicleYear?: unknown;
  licensePlate?: unknown;
  items?: FollowUpItem[];
};

function normalizeName(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s*\(from\s+[^)]*\)\s*$/i, "")
    .replace(/\s*(?:quantity|qty)\s*:\s*.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value: unknown): string {
  const raw = String(value || "").trim();
  const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];

  const dayFirstDate = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dayFirstDate) {
    const [, day, month, year] = dayFirstDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizePhone(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function normalizePlate(value: unknown): string {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeReference(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeVehiclePart(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function itemNames(items: FollowUpItem[] | undefined, includeUntyped = false): Set<string> {
  const names = new Set<string>();
  for (const item of items || []) {
    const type = String(item.type || "");
    const hasWarranty = Boolean(item.warranty || item.warrantyPeriod);
    if (
      !includeUntyped &&
      type !== "PPF" &&
      type !== "Service" &&
      !(type === "" && hasWarranty)
    ) {
      continue;
    }
    const name = normalizeName(item.name);
    if (name) names.add(name);
  }
  return names;
}

function intersectNames(left: Set<string>, right: Set<string>): string[] {
  return Array.from(left).filter(name => right.has(name));
}

function addCandidateKey(
  index: Map<string, Set<FollowUpJobCard>>,
  key: string,
  jobCard: FollowUpJobCard,
): void {
  const entries = index.get(key) || new Set<FollowUpJobCard>();
  entries.add(jobCard);
  index.set(key, entries);
}

function identityKeys(
  date: string,
  phone: string,
  plate: string,
  customer: string,
  makeModel: string,
  itemName: string,
): string[] {
  if (!date || !itemName) return [];
  const keys: string[] = [];
  const suffix = `${date}|${itemName}`;
  if (phone && plate) keys.push(`phone-plate|${phone}|${plate}|${suffix}`);
  if (phone && customer && makeModel) {
    keys.push(`phone-customer-vehicle|${phone}|${customer}|${makeModel}|${suffix}`);
  }
  if (plate && customer && makeModel) {
    keys.push(`plate-customer-vehicle|${plate}|${customer}|${makeModel}|${suffix}`);
  }
  return keys;
}

function hasCompatibleYears(invoice: FollowUpInvoice, jobCard: FollowUpJobCard): boolean {
  const invoiceYear = normalizeVehiclePart(invoice.vehicleYear);
  const jobCardYear = normalizeVehiclePart(jobCard.year);
  return !invoiceYear || !jobCardYear || invoiceYear === jobCardYear;
}

function hasNoConflictingIdentifiers(
  invoice: FollowUpInvoice,
  jobCard: FollowUpJobCard,
): boolean {
  const invoicePhone = normalizePhone(invoice.phoneNumber);
  const jobCardPhone = normalizePhone(jobCard.phoneNumber);
  const invoicePlate = normalizePlate(invoice.licensePlate);
  const jobCardPlate = normalizePlate(jobCard.licensePlate);
  return (
    (!invoicePhone || !jobCardPhone || invoicePhone === jobCardPhone) &&
    (!invoicePlate || !jobCardPlate || invoicePlate === jobCardPlate) &&
    hasCompatibleYears(invoice, jobCard)
  );
}

/**
 * Matches legacy invoice/job-card records within one MongoDB. It never copies
 * records between databases and only uses a fallback when the identifying
 * fields and PPF/service item match uniquely.
 */
export function createInvoiceJobCardMatcher(
  jobCards: FollowUpJobCard[],
): (invoice: FollowUpInvoice) => FollowUpJobCard | undefined {
  const byId = new Map<string, FollowUpJobCard>();
  const byJobNo = new Map<string, FollowUpJobCard[]>();
  const candidateIndex = new Map<string, Set<FollowUpJobCard>>();

  for (const jobCard of jobCards) {
    const id = String(jobCard._id || jobCard.id || "").trim();
    if (id) byId.set(id, jobCard);

    const jobNo = normalizeReference(jobCard.jobNo);
    if (jobNo) {
      const matches = byJobNo.get(jobNo) || [];
      matches.push(jobCard);
      byJobNo.set(jobNo, matches);
    }

    const date = normalizeDate(jobCard.date);
    const phone = normalizePhone(jobCard.phoneNumber);
    const plate = normalizePlate(jobCard.licensePlate);
    const customer = normalizeName(jobCard.customerName);
    const makeModel = [
      normalizeVehiclePart(jobCard.make),
      normalizeVehiclePart(jobCard.model),
    ].filter(Boolean).join("|");
    const names = itemNames([...(jobCard.ppfs || []), ...(jobCard.services || [])], true);

    for (const name of Array.from(names)) {
      for (const key of identityKeys(date, phone, plate, customer, makeModel, name)) {
        addCandidateKey(candidateIndex, key, jobCard);
      }
    }
  }

  return (invoice: FollowUpInvoice): FollowUpJobCard | undefined => {
    const invoiceJobCardId = String(invoice.jobCardId || "").trim();
    if (invoiceJobCardId && byId.has(invoiceJobCardId)) {
      return byId.get(invoiceJobCardId);
    }

    const explicitReferences = [
      invoice.jobNo,
      invoice.jobCardNo,
      invoice.jobCardNumber,
    ].map(normalizeReference).filter(Boolean);
    for (const reference of explicitReferences) {
      const matches = byJobNo.get(reference);
      if (matches?.length === 1) return matches[0];
    }

    const date = normalizeDate(invoice.date);
    const phone = normalizePhone(invoice.phoneNumber);
    const plate = normalizePlate(invoice.licensePlate);
    const customer = normalizeName(invoice.customerName);
    const makeModel = [
      normalizeVehiclePart(invoice.vehicleMake),
      normalizeVehiclePart(invoice.vehicleModel),
    ].filter(Boolean).join("|");
    const names = itemNames(invoice.items);
    const candidates = new Set<FollowUpJobCard>();

    for (const name of Array.from(names)) {
      for (const key of identityKeys(date, phone, plate, customer, makeModel, name)) {
        for (const candidate of Array.from(candidateIndex.get(key) || [])) {
          if (hasNoConflictingIdentifiers(invoice, candidate)) candidates.add(candidate);
        }
      }
    }

    return candidates.size === 1 ? candidates.values().next().value : undefined;
  };
}