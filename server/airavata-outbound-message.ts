export interface AiravataOutboundMessagePayload {
  phoneNumberId: string;
  whatsappMessageId: string;
  recipientPhone: string;
  body: string;
  sentAt: string;
  media?: {
    type: string;
    url?: string;
    filename?: string;
  };
}

export type AiravataReportResult =
  | { success: true; status: 200 | 201 }
  | { success: false; reason: string; status?: number };

type AcceptedMetaMessage = { messageId: string };

export function isAiravataOutboundMessageConfigured(): boolean {
  return Boolean(
    process.env.AIRAVATA_API_BASE_URL?.trim() &&
    process.env.AIRAVATA_API_KEY?.trim(),
  );
}

export function renderPpfInspectionTemplateBody(
  templateBody: string,
  firstName: string,
): string {
  if (!String(templateBody || "").trim()) {
    throw new Error("The approved PPF inspection template body is unavailable.");
  }

  const placeholders = Array.from(
    String(templateBody).matchAll(/\{\{([^{}]+)\}\}/g),
    (match) => match[1].trim(),
  );
  if (new Set(placeholders).size > 1) {
    throw new Error("The PPF inspection template has unexpected body parameters.");
  }

  const name = String(firstName || "").trim() || "Customer";
  const rendered = String(templateBody).replace(/\{\{[^{}]+\}\}/g, () => name);
  if (/\{\{[^{}]+\}\}/.test(rendered)) {
    throw new Error("The PPF inspection template body could not be rendered.");
  }
  return rendered;
}

export interface AiravataReportOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
}

export async function postAiravataOutboundMessage(
  payload: AiravataOutboundMessagePayload,
  options: AiravataReportOptions = {},
): Promise<AiravataReportResult> {
  const baseUrl = String(
    options.baseUrl ?? process.env.AIRAVATA_API_BASE_URL ?? "",
  ).trim();
  const apiKey = String(options.apiKey ?? process.env.AIRAVATA_API_KEY ?? "").trim();
  if (!baseUrl || !apiKey) {
    return { success: false, reason: "missing_configuration" };
  }
  if (/[\r\n]/.test(apiKey)) {
    return { success: false, reason: "invalid_configuration" };
  }

  let origin: string;
  try {
    const parsed = new URL(baseUrl);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return { success: false, reason: "invalid_base_url" };
    }
    origin = parsed.origin;
  } catch {
    return { success: false, reason: "invalid_base_url" };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const wait = options.wait || ((milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const maxAttempts = Math.max(1, Math.min(3, Math.floor(options.maxAttempts ?? 3)));
  const endpoint = `${origin}/api/integrations/autogamma/outbound-messages`;
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetchImpl(endpoint, { ...requestInit, signal: AbortSignal.timeout(8000) });
    } catch {
      if (attempt < maxAttempts) {
        await wait(200 * attempt);
        continue;
      }
      return { success: false, reason: "network_error" };
    }

    if (response.status === 200 || response.status === 201) {
      return { success: true, status: response.status };
    }
    if (response.status >= 500 && response.status <= 599 && attempt < maxAttempts) {
      await wait(200 * attempt);
      continue;
    }
    return {
      success: false,
      reason: `http_${response.status}`,
      status: response.status,
    };
  }

  return { success: false, reason: "report_attempts_exhausted" };
}

export async function reportAfterAcceptedMetaSend<
  T extends AcceptedMetaMessage,
>(
  sendMetaMessage: () => Promise<T>,
  buildPayload: (accepted: T) => Promise<AiravataOutboundMessagePayload>,
  report: (
    payload: AiravataOutboundMessagePayload,
  ) => Promise<AiravataReportResult>,
  shouldReport: () => boolean = () => true,
  onReportIssue?: (messageId: string, reason: string) => void,
): Promise<T> {
  const accepted = await sendMetaMessage();

  const reportIssue = (reason: string) => {
    try {
      onReportIssue?.(accepted.messageId, reason);
    } catch {
      // Reporting must not change the result of a successful Meta send.
    }
  };

  if (!shouldReport()) {
    reportIssue("missing_configuration");
    return accepted;
  }

  let payload: AiravataOutboundMessagePayload;
  try {
    payload = await buildPayload(accepted);
  } catch {
    reportIssue("payload_unavailable");
    return accepted;
  }

  try {
    const result = await report(payload);
    if (!result.success) reportIssue(result.reason);
  } catch {
    reportIssue("report_request_failed");
  }

  return accepted;
}