type ConversationStatus = "SENT" | "OPEN" | "CLOSED" | "ALL";

export type AiravataConversation = {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageDirection: "INBOUND" | "OUTBOUND";
  lastMessageAt: string;
  lastInboundAt: string | null;
  unread: number;
  status: string;
  windowOpen: boolean;
};

export type AiravataMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  type: string;
  mediaType: string | null;
  mediaId: string | null;
  mediaUrl: string | null;
  mediaFilename: string | null;
  status: string;
  failureReason: string | null;
  whatsappMessageId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export class AiravataInboxError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AiravataInboxError";
  }
}

function getConfig() {
  const baseUrl = String(process.env.AIRAVATA_API_BASE_URL || "").trim();
  const apiKey = String(process.env.AIRAVATA_API_KEY || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  let origin = "";
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password &&
      parsed.pathname === "/" && !parsed.search && !parsed.hash) origin = parsed.origin;
  } catch { /* Report invalid configuration without exposing its value. */ }
  if (!origin || !apiKey || !phoneNumberId) {
    throw new AiravataInboxError("AtWassup inbox configuration is incomplete.", 503);
  }
  return { origin, apiKey, phoneNumberId };
}

async function getJson(path: string, query: URLSearchParams) {
  const { origin, apiKey, phoneNumberId } = getConfig();
  query.set("phoneNumberId", phoneNumberId);
  const url = new URL(path, origin);
  url.search = query.toString();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new AiravataInboxError("Could not reach the AtWassup inbox API.", 502);
  }
  if (!response.ok) {
    const message = response.status === 404
      ? "AtWassup inbox API route was not found. Confirm the API has been deployed to its VPS."
      : response.status === 401 || response.status === 403
        ? `AtWassup rejected the server-side API credentials or permissions (${response.status}).`
        : `AtWassup inbox API returned HTTP ${response.status}.`;
    throw new AiravataInboxError(message, response.status);
  }
  const contentType = response.headers.get("content-type") || "unknown content type";
  if (!/application\/(?:[\w.+-]+\+)?json\b/i.test(contentType)) {
    throw new AiravataInboxError(
      `AtWassup returned HTTP ${response.status} with ${contentType}; expected JSON.`,
      502,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new AiravataInboxError(
      `AtWassup returned HTTP ${response.status} with invalid JSON.`,
      502,
    );
  }
}

export async function getAiravataConversations(options: {
  status: ConversationStatus;
  limit: number;
  search?: string;
  before?: string;
}) {
  const query = new URLSearchParams({ status: options.status, limit: String(options.limit) });
  if (options.search) query.set("search", options.search);
  if (options.before) query.set("before", options.before);
  const result = await getJson("/api/integrations/v1/whatsapp/conversations", query) as any;
  if (!result || !Array.isArray(result.conversations) ||
      (result.nextBefore != null && typeof result.nextBefore !== "string")) {
    throw new AiravataInboxError("AtWassup returned an unexpected conversations response.", 502);
  }
  return result as { conversations: AiravataConversation[]; nextBefore: string | null };
}

export async function getAiravataConversationMessages(options: {
  contactId: string;
  limit: number;
  before?: string;
}) {
  const query = new URLSearchParams({ limit: String(options.limit) });
  if (options.before) query.set("before", options.before);
  const result = await getJson(
    `/api/integrations/v1/whatsapp/conversations/${encodeURIComponent(options.contactId)}/messages`,
    query,
  ) as any;
  if (!result || !Array.isArray(result.messages) ||
      (result.nextBefore != null && typeof result.nextBefore !== "string")) {
    throw new AiravataInboxError("AtWassup returned an unexpected message-history response.", 502);
  }
  return result as {
    contact: { id: string; name: string; phone: string };
    messages: AiravataMessage[];
    nextBefore: string | null;
  };
}

export async function getAiravataConversationCounts() {
  const statuses = ["SENT", "OPEN", "CLOSED"] as const;
  const counts = await Promise.all(statuses.map(async status => {
    const contacts = new Set<string>();
    const seenCursors = new Set<string>();
    let before: string | undefined;

    while (true) {
      const page = await getAiravataConversations({ status, limit: 100, before });
      for (const conversation of page.conversations) {
        if (status === "OPEN" && !conversation.windowOpen) continue;
        contacts.add(conversation.contactId || conversation.id);
      }

      const nextBefore = page.nextBefore || undefined;
      if (!nextBefore) break;
      if (seenCursors.has(nextBefore) || nextBefore === before) {
        throw new AiravataInboxError(
          `AtWassup ${status.toLowerCase()} conversation pagination did not advance.`,
          502,
        );
      }
      seenCursors.add(nextBefore);
      before = nextBefore;
    }

    return [status, contacts.size] as const;
  }));

  return Object.fromEntries(counts) as Record<(typeof statuses)[number], number>;
}

async function getInitialInboundMessage(contactId: string) {
  const seenCursors = new Set<string>();
  let before: string | undefined;
  let firstInbound: AiravataMessage | null = null;

  while (true) {
    const page = await getAiravataConversationMessages({ contactId, limit: 100, before });
    for (const message of page.messages) {
      if (message.direction !== "INBOUND") continue;
      const messageTime = Date.parse(message.createdAt);
      const firstTime = firstInbound ? Date.parse(firstInbound.createdAt) : Number.POSITIVE_INFINITY;
      if (!firstInbound || (Number.isFinite(messageTime) && messageTime < firstTime)) {
        firstInbound = message;
      }
    }

    const nextBefore = page.nextBefore || undefined;
    if (!nextBefore) break;
    if (seenCursors.has(nextBefore) || nextBefore === before) {
      throw new AiravataInboxError("AtWassup message-history pagination did not advance.", 502);
    }
    seenCursors.add(nextBefore);
    before = nextBefore;
  }

  return firstInbound;
}

export async function getAiravataOpenInquiries() {
  const openContacts = new Map<string, AiravataConversation>();
  const seenCursors = new Set<string>();
  let before: string | undefined;

  while (true) {
    const page = await getAiravataConversations({ status: "OPEN", limit: 100, before });
    for (const conversation of page.conversations) {
      if (conversation.windowOpen) {
        openContacts.set(conversation.contactId || conversation.id, conversation);
      }
    }

    const nextBefore = page.nextBefore || undefined;
    if (!nextBefore) break;
    if (seenCursors.has(nextBefore) || nextBefore === before) {
      throw new AiravataInboxError("AtWassup Open conversation pagination did not advance.", 502);
    }
    seenCursors.add(nextBefore);
    before = nextBefore;
  }

  const inquiries = await Promise.all([...openContacts.values()].map(async conversation => {
    try {
      const firstMessage = await getInitialInboundMessage(conversation.contactId || conversation.id);
      return {
        ...conversation,
        initialMessage: firstMessage?.body || null,
        initialMessageAt: firstMessage?.createdAt || null,
        historyError: null,
      };
    } catch (error) {
      return {
        ...conversation,
        initialMessage: null,
        initialMessageAt: null,
        historyError: error instanceof AiravataInboxError
          ? error.message
          : "Unable to load the original customer message.",
      };
    }
  }));

  return inquiries.sort((left, right) =>
    Date.parse(right.lastInboundAt || right.lastMessageAt) -
    Date.parse(left.lastInboundAt || left.lastMessageAt),
  );
}

export async function sendAiravataTextMessage(options: {
  to: string;
  text: string;
  clientMessageId: string;
}) {
  const { origin, apiKey, phoneNumberId } = getConfig();
  let response: Response;
  try {
    response = await fetch(new URL("/api/integrations/v1/whatsapp/messages/text", origin), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumberId,
        to: options.to,
        text: options.text,
        clientMessageId: options.clientMessageId,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new AiravataInboxError("Could not reach the AtWassup text-send API.", 502);
  }

  if (response.status === 404) {
    throw new AiravataInboxError(
      "AtWassup text-send endpoint returned HTTP 404. Confirm that this exact endpoint is deployed to its VPS.",
      404,
    );
  }
  if (response.status === 422) {
    throw new AiravataInboxError(
      "AtWassup rejected this reply (HTTP 422). The recipient must have messaged within the last 24 hours.",
      422,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new AiravataInboxError(
      `AtWassup rejected the server-side API credentials or permissions (${response.status}).`,
      response.status,
    );
  }
  if (!response.ok) {
    throw new AiravataInboxError(`AtWassup text-send API returned HTTP ${response.status}.`, response.status);
  }

  const contentType = response.headers.get("content-type") || "unknown content type";
  if (!/application\/(?:[\w.+-]+\+)?json\b/i.test(contentType)) {
    throw new AiravataInboxError(
      `AtWassup text-send API returned HTTP ${response.status} with ${contentType}; expected JSON.`,
      502,
    );
  }
  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new AiravataInboxError(
      `AtWassup text-send API returned HTTP ${response.status} with invalid JSON.`,
      502,
    );
  }
  if (!result || result.ok !== true || typeof result.duplicate !== "boolean" ||
      typeof result.messageId !== "string" || typeof result.contactId !== "string" ||
      typeof result.whatsappMessageId !== "string" || typeof result.status !== "string") {
    throw new AiravataInboxError("AtWassup returned an unexpected text-send response.", 502);
  }
  return { httpStatus: response.status, result: result as {
    ok: true;
    duplicate: boolean;
    messageId: string;
    contactId: string;
    whatsappMessageId: string;
    status: string;
  } };
}
