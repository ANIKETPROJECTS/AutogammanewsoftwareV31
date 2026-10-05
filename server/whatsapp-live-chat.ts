import {
  isAiravataOutboundMessageConfigured, postAiravataOutboundMessage,
  reportAfterAcceptedMetaSend, type AiravataOutboundMessagePayload,
} from "./airavata-outbound-message";

type TemplateComponent = { type?: string; text?: string; format?: string; parameters?: any[] };
export type LiveChatReportStatus = { status: "recorded" | "failed"; reason?: string; at: string };
type Options = {
  getTemplate: (name: string, language: string) => Promise<TemplateComponent[]>;
  report?: typeof postAiravataOutboundMessage;
  configured?: () => boolean;
  onIssue?: (messageId: string, reason: string) => void;
  saveStatus?: (status: LiveChatReportStatus) => Promise<void>;
};

let lastReport: LiveChatReportStatus | null = null;

export function getLiveChatReportingStatus(
  env: NodeJS.ProcessEnv = process.env,
  storedReport: LiveChatReportStatus | null = lastReport,
) {
  const requiredKeys = [
    "AIRAVATA_API_BASE_URL", "AIRAVATA_API_KEY",
    "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_ACCESS_TOKEN",
  ];
  const missingKeys = requiredKeys.filter(key => !env[key]?.trim());
  let validBaseUrl = false;
  try {
    const url = new URL(env.AIRAVATA_API_BASE_URL || "");
    validBaseUrl = url.protocol === "https:" && !url.username && !url.password &&
      url.pathname === "/" && !url.search && !url.hash;
  } catch { /* Expose only configuration status, never credential values. */ }
  return {
    configured: missingKeys.length === 0 && validBaseUrl,
    baseUrl: validBaseUrl ? new URL(env.AIRAVATA_API_BASE_URL!).origin : null,
    apiKeyConfigured: Boolean(env.AIRAVATA_API_KEY?.trim()),
    validBaseUrl, missingKeys,
    coveredMessages: ["Inquiry templates", "Invoice templates and PDFs", "PPF inspection templates"],
    lastReport: storedReport,
  };
}

export function renderWhatsAppTemplate(components: TemplateComponent[], sentComponents: TemplateComponent[]) {
  const text = components.filter(component =>
    ["HEADER", "BODY", "FOOTER"].includes(String(component.type).toUpperCase()) && component.text,
  ).map(component => {
    const parameters = sentComponents.find(sent =>
      sent.type?.toUpperCase() === component.type?.toUpperCase(),
    )?.parameters || [];
    return String(component.text).replace(/\{\{([^{}]+)\}\}/g, (_match, key: string) => {
      const parameter = /^\d+$/.test(key.trim())
        ? parameters[Number(key.trim()) - 1]
        : parameters.find(p => p.parameter_name === key.trim());
      if (parameter?.type !== "text" || typeof parameter.text !== "string") {
        throw new Error("Template parameter is unavailable for Live Chat.");
      }
      return parameter.text;
    });
  }).join("\n\n");
  if (!text.trim()) throw new Error("Approved template text is unavailable for Live Chat.");
  return text;
}

export async function reportWhatsAppSendToLiveChat(
  path: string, init: RequestInit, response: Response, options: Options,
): Promise<void> {
  const match = path.match(/^\/v[\d.]+\/([^/?]+)\/messages(?:\?|$)/);
  if (!match || init.method?.toUpperCase() !== "POST" || !response.ok) return;
  const result = await response.clone().json().catch(() => ({}));
  const messageId = result.messages?.[0]?.id;
  if (!messageId) return;
  const acceptedAt = new Date().toISOString();
  let completedReport: LiveChatReportStatus | null = null;
  await reportAfterAcceptedMetaSend(
    async () => ({ messageId: String(messageId) }),
    async () => {
      if (typeof init.body !== "string") throw new Error("Message payload is unavailable.");
      const sent = JSON.parse(init.body);
      const payload: AiravataOutboundMessagePayload = {
        phoneNumberId: decodeURIComponent(match[1]), whatsappMessageId: String(messageId),
        recipientPhone: `+${String(sent.to || "").replace(/\D/g, "")}`,
        body: "", sentAt: acceptedAt,
      };
      if (payload.recipientPhone === "+") throw new Error("Message recipient is unavailable.");
      if (sent.type === "template") {
        const components = sent.template?.components || [];
        payload.body = renderWhatsAppTemplate(
          await options.getTemplate(sent.template.name, sent.template.language.code), components,
        );
        const header = components.find((component: TemplateComponent) => component.type?.toUpperCase() === "HEADER");
        const mediaParameter = header?.parameters?.find((parameter: any) =>
          ["document", "image", "video"].includes(parameter.type),
        );
        if (mediaParameter) payload.media = {
          type: mediaParameter.type,
          url: mediaParameter[mediaParameter.type]?.link,
          filename: mediaParameter[mediaParameter.type]?.filename,
        };
      } else if (sent.type === "text") {
        payload.body = String(sent.text?.body || "");
      } else if (["document", "image", "video", "audio", "sticker"].includes(sent.type)) {
        payload.body = String(sent[sent.type]?.caption || "");
        payload.media = { type: sent.type, url: sent[sent.type]?.link, filename: sent[sent.type]?.filename };
      } else {
        throw new Error("Unsupported outgoing message type for Live Chat.");
      }
      return payload;
    },
    async payload => {
      const reported = await (options.report || postAiravataOutboundMessage)(payload);
      lastReport = reported.success
        ? { status: "recorded", at: new Date().toISOString() }
        : { status: "failed", reason: reported.reason, at: new Date().toISOString() };
      completedReport = lastReport;
      return reported;
    },
    options.configured || isAiravataOutboundMessageConfigured,
    (id, reason) => {
      lastReport = { status: "failed", reason, at: new Date().toISOString() };
      completedReport = lastReport;
      if (options.onIssue) options.onIssue(id, reason);
      else console.warn(
        "[WHATSAPP LIVE CHAT] Meta accepted the message, but reporting did not complete.",
        { messageId: id, reason },
      );
    },
  );
  if (completedReport && options.saveStatus) {
    try {
      await options.saveStatus(completedReport);
    } catch {
      // A status-storage failure must not resend or invalidate an accepted customer message.
      console.warn("[WHATSAPP LIVE CHAT] Unable to save recording status to the database.");
    }
  }
}
