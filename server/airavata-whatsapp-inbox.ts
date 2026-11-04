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
  const phoneNumberId = String(process.env.AIRAVATA_PHONE_NUMBER_ID || "").trim();
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
