import assert from "node:assert/strict";
import test from "node:test";
import { reportWhatsAppSendToLiveChat, renderWhatsAppTemplate, getLiveChatReportingStatus } from "./whatsapp-live-chat";
import type { AiravataOutboundMessagePayload } from "./airavata-outbound-message";
import type { LiveChatReportStatus } from "./whatsapp-live-chat";

const response = () => new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }));
const sentTemplate = (name: string, document = false) => ({
  method: "POST",
  body: JSON.stringify({
    to: "919876543210", type: "template", template: {
      name, language: { code: "en_US" },
      components: [
        { type: "body", parameters: [{ type: "text", text: "Asha" }] },
        ...(document ? [{ type: "header", parameters: [{ type: "document", document: { id: "uploaded-media", filename: "Invoice_test.pdf" } }] }] : []),
      ],
    },
  }),
});
for (const name of ["inquiry_message", "invoice_message", "inspection_ppf"]) {
  test(`${name} is recorded once after acceptance with its actual template body`, async () => {
    const reports: AiravataOutboundMessagePayload[] = [];
    const metaResponse = response();
    await reportWhatsAppSendToLiveChat("/v23.0/sender-id/messages", sentTemplate(name, name === "invoice_message"), metaResponse, {
      configured: () => true,
      getTemplate: async (requestedName, language) => {
        assert.equal(requestedName, name); assert.equal(language, "en_US");
        return [{ type: "BODY", text: "Hello {{1}}, thank you." }, { type: "FOOTER", text: "AutoGamma" }];
      },
      report: async payload => { reports.push(payload); return { success: true, status: 201 }; },
    });
    assert.equal(reports.length, 1);
    assert.equal(reports[0].body, "Hello Asha, thank you.\n\nAutoGamma");
    assert.equal(reports[0].phoneNumberId, "sender-id");
    assert.equal(reports[0].recipientPhone, "+919876543210");
    assert.equal(reports[0].whatsappMessageId, "wamid.test");
    assert.ok(Date.parse(reports[0].sentAt));
    if (name === "invoice_message") assert.deepEqual(reports[0].media, {
      type: "document", url: undefined, filename: "Invoice_test.pdf",
    });
    assert.equal((await metaResponse.json()).messages[0].id, "wamid.test", "reporting must not consume the sender's response");
  });
}

test("failed Meta sends, uploads, and metadata reads are never reported", async () => {
  const options = {
    configured: () => true,
    getTemplate: async () => { throw new Error("Should not look up templates"); },
    report: async () => { throw new Error("Should not report"); },
  };
  await reportWhatsAppSendToLiveChat("/v23.0/sender/messages", sentTemplate("inquiry_message"), new Response("{}", { status: 400 }), options);
  await reportWhatsAppSendToLiveChat("/v23.0/sender/media", { method: "POST" }, response(), options);
  await reportWhatsAppSendToLiveChat("/v23.0/waba/message_templates", { method: "GET" }, response(), options);
  await reportWhatsAppSendToLiveChat("/v23.0/sender/messages", sentTemplate("inquiry_message"), new Response("{}"), options);
});

test("missing configuration is visible and does not change an accepted send", async () => {
  let issue = "";
  await reportWhatsAppSendToLiveChat("/v23.0/sender/messages", sentTemplate("inquiry_message"), response(), {
    configured: () => false,
    getTemplate: async () => { throw new Error("Must not fetch metadata without credentials"); },
    onIssue: (_id, reason) => { issue = reason; },
  });
  assert.equal(issue, "missing_configuration");
  const status = getLiveChatReportingStatus({ AIRAVATA_API_BASE_URL: "https://app.atwassup.com" });
  assert.equal(status.configured, false);
  assert.equal(status.apiKeyConfigured, false);
  assert.ok(status.missingKeys.includes("AIRAVATA_API_KEY"));
  const configured = getLiveChatReportingStatus({
    AIRAVATA_API_BASE_URL: "https://app.atwassup.com",
    AIRAVATA_API_KEY: "dummy-test-key", WHATSAPP_ACCESS_TOKEN: "dummy-token",
    WHATSAPP_PHONE_NUMBER_ID: "sender-id", WHATSAPP_BUSINESS_ACCOUNT_ID: "waba-id",
  });
  assert.equal(configured.configured, true);
  assert.doesNotMatch(JSON.stringify(configured), /dummy-test-key|dummy-token/);
});

test("reporting failures never resend, and normal text messages also use the shared connection", async () => {
  let calls = 0;
  let issue = "";
  await reportWhatsAppSendToLiveChat("/v23.0/sender/messages", {
    method: "POST", body: JSON.stringify({ type: "text", to: "919876543210", text: { body: "Hello" } }),
  }, response(), {
    configured: () => true, getTemplate: async () => [],
    report: async payload => {
      calls++; assert.equal(payload.body, "Hello");
      return { success: false, status: 401, reason: "http_401" };
    },
    onIssue: (_id, reason) => { issue = reason; },
  });
  assert.equal(calls, 1); assert.equal(issue, "http_401");
});

test("named and repeated template parameters render exactly; missing parameters fail explicitly", () => {
  assert.equal(renderWhatsAppTemplate([{ type: "BODY", text: "Hi {{name}}, {{name}}" }], [
    { type: "body", parameters: [{ type: "text", text: "Asha", parameter_name: "name" }] },
  ]), "Hi Asha, Asha");
  assert.throws(() => renderWhatsAppTemplate([{ type: "BODY", text: "Hi {{1}}" }], []));
});

test("accepted invoice saves its recording result before the send returns", async () => {
  let saved: LiveChatReportStatus | null = null;
  const metaResponse = response();
  await reportWhatsAppSendToLiveChat("/v23.0/sender/messages", sentTemplate("invoice_message", true), metaResponse, {
    configured: () => true,
    getTemplate: async () => [{ type: "BODY", text: "Hello {{1}}" }],
    report: async () => ({ success: true, status: 201 }),
    saveStatus: async status => { saved = status; },
  });
  assert.ok(saved);
  assert.equal(getLiveChatReportingStatus({}, saved).lastReport?.status, "recorded");
  assert.equal((await metaResponse.json()).messages[0].id, "wamid.test");
});

test("recording failures are saved, including missing credentials and payload failures", async () => {
  for (const reason of ["missing_configuration", "payload_unavailable", "http_401"]) {
    const saved: LiveChatReportStatus[] = [];
    await reportWhatsAppSendToLiveChat("/v23.0/sender/messages", sentTemplate("inspection_ppf"), response(), {
      configured: () => reason !== "missing_configuration",
      getTemplate: async () => reason === "payload_unavailable" ? [] : [{ type: "BODY", text: "Hello {{1}}" }],
      report: async () => ({ success: false, status: 401, reason: "http_401" }),
      onIssue: () => {},
      saveStatus: async status => { saved.push(status); },
    });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].status, "failed");
    assert.equal(saved[0].reason, reason);
  }
});

test("a status-storage failure never changes acceptance or retries the message", async () => {
  let reports = 0;
  const metaResponse = response();
  await reportWhatsAppSendToLiveChat("/v23.0/sender/messages", sentTemplate("invoice_message"), metaResponse, {
    configured: () => true,
    getTemplate: async () => [{ type: "BODY", text: "Hello {{1}}" }],
    report: async () => { reports++; return { success: true, status: 200 }; },
    saveStatus: async () => { throw new Error("Database unavailable"); },
  });
  assert.equal(reports, 1);
  assert.equal((await metaResponse.json()).messages[0].id, "wamid.test");
});

test("persisted results take precedence over process memory, without inventing old acknowledgements", () => {
  const persisted: LiveChatReportStatus = { status: "recorded", at: "2026-10-05T01:00:00.000Z" };
  assert.deepEqual(getLiveChatReportingStatus({}, persisted).lastReport, persisted);
  assert.equal(getLiveChatReportingStatus({}, null).lastReport, null);
});
