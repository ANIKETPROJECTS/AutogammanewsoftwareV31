import assert from "node:assert/strict";
import test from "node:test";
import {
  postAiravataOutboundMessage,
  renderPpfInspectionTemplateBody,
  reportAfterAcceptedMetaSend,
  type AiravataOutboundMessagePayload,
} from "./airavata-outbound-message";

const payload: AiravataOutboundMessagePayload = {
  phoneNumberId: "1216638684872283",
  whatsappMessageId: "wamid.test-123",
  recipientPhone: "+919876543210",
  body: "Hello Asha, your PPF inspection is due.",
  sentAt: "2026-10-02T06:00:00.000Z",
};

test("renders the first-name parameter in the approved template body", () => {
  assert.equal(
    renderPpfInspectionTemplateBody(
      "Hello {{1}}, your PPF inspection is due.",
      "Asha",
    ),
    "Hello Asha, your PPF inspection is due.",
  );
});

test("does not report unless Meta accepts the send", async () => {
  const calls: string[] = [];
  await assert.rejects(
    reportAfterAcceptedMetaSend(
      async () => {
        calls.push("meta");
        throw new Error("Meta rejected the send");
      },
      async () => {
        calls.push("build");
        return payload;
      },
      async () => {
        calls.push("report");
        return { success: true, status: 201 };
      },
    ),
  );
  assert.deepEqual(calls, ["meta"]);
});

test("reports only after Meta accepts and passes its ID and rendered body", async () => {
  const calls: string[] = [];
  let reported: AiravataOutboundMessagePayload | undefined;

  const accepted = await reportAfterAcceptedMetaSend(
    async () => {
      calls.push("meta");
      return {
        messageId: "wamid.meta-accepted",
        phoneNumberId: payload.phoneNumberId,
        recipientPhone: payload.recipientPhone,
        sentAt: payload.sentAt,
        firstName: "Asha",
      };
    },
    async (result) => {
      calls.push("render");
      return {
        phoneNumberId: result.phoneNumberId,
        whatsappMessageId: result.messageId,
        recipientPhone: result.recipientPhone,
        body: renderPpfInspectionTemplateBody(
          "Hello {{1}}, your PPF inspection is due.",
          result.firstName,
        ),
        sentAt: result.sentAt,
      };
    },
    async (value) => {
      calls.push("report");
      reported = value;
      return { success: true, status: 201 };
    },
  );

  assert.deepEqual(calls, ["meta", "render", "report"]);
  assert.equal(accepted.messageId, "wamid.meta-accepted");
  assert.deepEqual(reported, {
    ...payload,
    whatsappMessageId: "wamid.meta-accepted",
  });
});

test("accepts 200 and 201 responses from the idempotent endpoint", async () => {
  for (const status of [200, 201] as const) {
    const result = await postAiravataOutboundMessage(payload, {
      baseUrl: "https://app.atwassup.com",
      apiKey: "test-airavata-key",
      fetchImpl: async () => new Response(null, { status }),
    });
    assert.deepEqual(result, { success: true, status });
  }
});

test("posts the exact payload to the VPS endpoint with Bearer authentication", async () => {
  let requestUrl = "";
  let requestHeaders: Headers | undefined;
  let requestBody: AiravataOutboundMessagePayload | undefined;

  const result = await postAiravataOutboundMessage(payload, {
    baseUrl: "https://app.atwassup.com/",
    apiKey: "test-airavata-key",
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestHeaders = new Headers(init?.headers);
      requestBody = JSON.parse(String(init?.body));
      return new Response(null, { status: 201 });
    },
  });

  assert.deepEqual(result, { success: true, status: 201 });
  assert.equal(
    requestUrl,
    "https://app.atwassup.com/api/integrations/autogamma/outbound-messages",
  );
  assert.equal(requestHeaders?.get("authorization"), "Bearer test-airavata-key");
  assert.equal(requestHeaders?.get("content-type"), "application/json");
  assert.deepEqual(requestBody, payload);
});

test("retries only the report with the same Meta ID and never re-sends to Meta", async () => {
  let metaSendCount = 0;
  let reportAttemptCount = 0;
  const requestBodies: string[] = [];

  const accepted = await reportAfterAcceptedMetaSend(
    async () => {
      metaSendCount += 1;
      return {
        messageId: payload.whatsappMessageId,
        phoneNumberId: payload.phoneNumberId,
        recipientPhone: payload.recipientPhone,
        sentAt: payload.sentAt,
      };
    },
    async () => payload,
    async (reportPayload) => postAiravataOutboundMessage(reportPayload, {
      baseUrl: "https://app.atwassup.com",
      apiKey: "test-airavata-key",
      wait: async () => {},
      fetchImpl: async (_input, init) => {
        reportAttemptCount += 1;
        requestBodies.push(String(init?.body));
        return new Response(null, {
          status: reportAttemptCount === 1 ? 503 : 200,
        });
      },
    }),
  );

  assert.equal(metaSendCount, 1);
  assert.equal(reportAttemptCount, 2);
  assert.equal(requestBodies[0], requestBodies[1]);
  assert.equal(
    JSON.parse(requestBodies[0]).whatsappMessageId,
    accepted.messageId,
  );
});

test("does not retry client errors from the reporting endpoint", async () => {
  let requestCount = 0;
  const result = await postAiravataOutboundMessage(payload, {
    baseUrl: "https://app.atwassup.com",
    apiKey: "test-airavata-key",
    wait: async () => {},
    fetchImpl: async () => {
      requestCount += 1;
      return new Response(null, { status: 401 });
    },
  });

  assert.deepEqual(result, {
    success: false,
    reason: "http_401",
    status: 401,
  });
  assert.equal(requestCount, 1);
});