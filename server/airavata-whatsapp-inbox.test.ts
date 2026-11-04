import assert from "node:assert/strict";
import test from "node:test";
import {
  AiravataInboxError,
  getAiravataConversations,
  getAiravataConversationMessages,
  sendAiravataTextMessage,
} from "./airavata-whatsapp-inbox";

test("AtWassup conversation proxy contract includes filters, pagination, and server auth", async () => {
  const oldFetch = globalThis.fetch;
  const oldEnv = {
    base: process.env.AIRAVATA_API_BASE_URL,
    key: process.env.AIRAVATA_API_KEY,
    phone: process.env.WHATSAPP_PHONE_NUMBER_ID,
  };
  let requestUrl = "";
  let authorization = "";
  try {
    process.env.AIRAVATA_API_BASE_URL = "https://atwassup.example";
    process.env.AIRAVATA_API_KEY = "test-only-key";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "sender-test-id";
    globalThis.fetch = async (input, init) => {
      requestUrl = String(input);
      authorization = new Headers(init?.headers).get("authorization") || "";
      return new Response(JSON.stringify({
        conversations: [{
          id: "contact-1", contactId: "contact-1", contactName: "Test",
          contactPhone: "+10000000000", lastMessage: "Hello",
          lastMessageDirection: "INBOUND", lastMessageAt: "2026-11-04T10:00:00Z",
          lastInboundAt: "2026-11-04T10:00:00Z", unread: 1,
          status: "Open", windowOpen: true,
        }],
        nextBefore: "2026-11-04T10:00:00Z",
      }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const result = await getAiravataConversations({
      status: "OPEN", limit: 2, search: "test", before: "2026-11-04T10:01:00Z",
    });
    const url = new URL(requestUrl);
    assert.equal(url.pathname, "/api/integrations/v1/whatsapp/conversations");
    assert.equal(url.searchParams.get("phoneNumberId"), "sender-test-id");
    assert.equal(url.searchParams.get("status"), "OPEN");
    assert.equal(url.searchParams.get("limit"), "2");
    assert.equal(url.searchParams.get("search"), "test");
    assert.equal(url.searchParams.get("before"), "2026-11-04T10:01:00Z");
    assert.equal(authorization, "Bearer test-only-key");
    assert.equal(result.conversations[0].contactId, "contact-1");
    assert.equal(result.nextBefore, "2026-11-04T10:00:00Z");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldEnv.base === undefined) delete process.env.AIRAVATA_API_BASE_URL;
    else process.env.AIRAVATA_API_BASE_URL = oldEnv.base;
    if (oldEnv.key === undefined) delete process.env.AIRAVATA_API_KEY;
    else process.env.AIRAVATA_API_KEY = oldEnv.key;
    if (oldEnv.phone === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = oldEnv.phone;
  }
});

test("AtWassup history uses contactId, page cursor, and preserves message status/media fields", async () => {
  const oldFetch = globalThis.fetch;
  const oldBase = process.env.AIRAVATA_API_BASE_URL;
  const oldKey = process.env.AIRAVATA_API_KEY;
  const oldPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  let requestUrl = "";
  try {
    process.env.AIRAVATA_API_BASE_URL = "https://atwassup.example";
    process.env.AIRAVATA_API_KEY = "test-only-key";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "sender-test-id";
    globalThis.fetch = async input => {
      requestUrl = String(input);
      return new Response(JSON.stringify({
        contact: { id: "contact/1", name: "Test", phone: "+10000000000" },
        messages: [{
          id: "msg-1", direction: "OUTBOUND", body: "Sent",
          type: "document", mediaType: "document", mediaId: "media-1",
          mediaUrl: "https://files.example/doc.pdf", mediaFilename: "doc.pdf",
          status: "DELIVERED", failureReason: null, whatsappMessageId: "wamid-1",
          sentAt: "2026-11-04T10:00:00Z", deliveredAt: "2026-11-04T10:01:00Z",
          readAt: null, createdAt: "2026-11-04T10:00:00Z",
        }],
        nextBefore: null,
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const result = await getAiravataConversationMessages({
      contactId: "contact/1", limit: 50, before: "2026-11-04T10:00:00Z",
    });
    const url = new URL(requestUrl);
    assert.equal(url.pathname, "/api/integrations/v1/whatsapp/conversations/contact%2F1/messages");
    assert.equal(url.searchParams.get("phoneNumberId"), "sender-test-id");
    assert.equal(url.searchParams.get("before"), "2026-11-04T10:00:00Z");
    assert.equal(result.messages[0].status, "DELIVERED");
    assert.equal(result.messages[0].mediaFilename, "doc.pdf");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldBase === undefined) delete process.env.AIRAVATA_API_BASE_URL;
    else process.env.AIRAVATA_API_BASE_URL = oldBase;
    if (oldKey === undefined) delete process.env.AIRAVATA_API_KEY;
    else process.env.AIRAVATA_API_KEY = oldKey;
    if (oldPhone === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = oldPhone;
  }
});

test("AtWassup 404 is explained without exposing the API key", async () => {
  const oldFetch = globalThis.fetch;
  const oldBase = process.env.AIRAVATA_API_BASE_URL;
  const oldKey = process.env.AIRAVATA_API_KEY;
  const oldPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  try {
    process.env.AIRAVATA_API_BASE_URL = "https://atwassup.example";
    process.env.AIRAVATA_API_KEY = "do-not-leak-this-key";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "sender-test-id";
    globalThis.fetch = async () => new Response("Not Found", { status: 404 });
    await assert.rejects(
      () => getAiravataConversations({ status: "OPEN", limit: 50 }),
      (error: unknown) => {
        assert.ok(error instanceof AiravataInboxError);
        assert.equal(error.status, 404);
        assert.match(error.message, /deploy.*VPS/i);
        assert.doesNotMatch(error.message, /do-not-leak-this-key/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldBase === undefined) delete process.env.AIRAVATA_API_BASE_URL;
    else process.env.AIRAVATA_API_BASE_URL = oldBase;
    if (oldKey === undefined) delete process.env.AIRAVATA_API_KEY;
    else process.env.AIRAVATA_API_KEY = oldKey;
    if (oldPhone === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = oldPhone;
  }
});

test("AtWassup HTML response is reported as a content-type mismatch", async () => {
  const oldFetch = globalThis.fetch;
  const oldBase = process.env.AIRAVATA_API_BASE_URL;
  const oldKey = process.env.AIRAVATA_API_KEY;
  const oldPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  try {
    process.env.AIRAVATA_API_BASE_URL = "https://atwassup.example";
    process.env.AIRAVATA_API_KEY = "test-only-key";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "sender-test-id";
    globalThis.fetch = async () => new Response("<!DOCTYPE html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    await assert.rejects(
      () => getAiravataConversations({ status: "OPEN", limit: 50 }),
      (error: unknown) => {
        assert.ok(error instanceof AiravataInboxError);
        assert.equal(error.status, 502);
        assert.match(error.message, /HTTP 200 with text\/html; expected JSON/i);
        return true;
      },
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldBase === undefined) delete process.env.AIRAVATA_API_BASE_URL;
    else process.env.AIRAVATA_API_BASE_URL = oldBase;
    if (oldKey === undefined) delete process.env.AIRAVATA_API_KEY;
    else process.env.AIRAVATA_API_KEY = oldKey;
    if (oldPhone === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = oldPhone;
  }
});

test("AtWassup text send uses its exact route, server auth, configured sender, and idempotency key", async () => {
  const oldFetch = globalThis.fetch;
  const oldBase = process.env.AIRAVATA_API_BASE_URL;
  const oldKey = process.env.AIRAVATA_API_KEY;
  const oldPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const oldAiravataPhone = process.env.AIRAVATA_PHONE_NUMBER_ID;
  let callCount = 0;
  let requestUrl = "";
  let requestAuthorization = "";
  let requestBody: any;
  try {
    process.env.AIRAVATA_API_BASE_URL = "https://atwassup.example";
    process.env.AIRAVATA_API_KEY = "server-only-test-key";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "configured-sender-id";
    process.env.AIRAVATA_PHONE_NUMBER_ID = "unused-alternate-id";
    globalThis.fetch = async (input, init) => {
      callCount++;
      requestUrl = String(input);
      requestAuthorization = new Headers(init?.headers).get("authorization") || "";
      requestBody = JSON.parse(String(init?.body));
      const duplicate = callCount > 1;
      return new Response(JSON.stringify({
        ok: true,
        duplicate,
        messageId: "atw-message-1",
        contactId: "contact-1",
        whatsappMessageId: "wamid-1",
        status: "SENT",
      }), {
        status: duplicate ? 200 : 201,
        headers: { "content-type": "application/json" },
      });
    };

    const options = {
      to: "+10000000001",
      text: "Thanks for contacting us.",
      clientMessageId: "send-once-123",
    };
    const first = await sendAiravataTextMessage(options);
    const retry = await sendAiravataTextMessage(options);

    assert.equal(new URL(requestUrl).pathname, "/api/integrations/v1/whatsapp/messages/text");
    assert.equal(requestAuthorization, "Bearer server-only-test-key");
    assert.deepEqual(requestBody, {
      phoneNumberId: "configured-sender-id",
      to: options.to,
      text: options.text,
      clientMessageId: options.clientMessageId,
    });
    assert.equal(first.httpStatus, 201);
    assert.equal(first.result.duplicate, false);
    assert.equal(retry.httpStatus, 200);
    assert.equal(retry.result.duplicate, true);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldBase === undefined) delete process.env.AIRAVATA_API_BASE_URL;
    else process.env.AIRAVATA_API_BASE_URL = oldBase;
    if (oldKey === undefined) delete process.env.AIRAVATA_API_KEY;
    else process.env.AIRAVATA_API_KEY = oldKey;
    if (oldPhone === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = oldPhone;
    if (oldAiravataPhone === undefined) delete process.env.AIRAVATA_PHONE_NUMBER_ID;
    else process.env.AIRAVATA_PHONE_NUMBER_ID = oldAiravataPhone;
  }
});

test("AtWassup 422 blocks text send outside the 24-hour window", async () => {
  const oldFetch = globalThis.fetch;
  const oldBase = process.env.AIRAVATA_API_BASE_URL;
  const oldKey = process.env.AIRAVATA_API_KEY;
  const oldPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  try {
    process.env.AIRAVATA_API_BASE_URL = "https://atwassup.example";
    process.env.AIRAVATA_API_KEY = "server-only-test-key";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "configured-sender-id";
    globalThis.fetch = async () => new Response("{}", { status: 422 });
    await assert.rejects(
      () => sendAiravataTextMessage({
        to: "+10000000001", text: "Hello", clientMessageId: "send-once-123",
      }),
      (error: unknown) => {
        assert.ok(error instanceof AiravataInboxError);
        assert.equal(error.status, 422);
        assert.match(error.message, /within the last 24 hours/i);
        return true;
      },
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldBase === undefined) delete process.env.AIRAVATA_API_BASE_URL;
    else process.env.AIRAVATA_API_BASE_URL = oldBase;
    if (oldKey === undefined) delete process.env.AIRAVATA_API_KEY;
    else process.env.AIRAVATA_API_KEY = oldKey;
    if (oldPhone === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = oldPhone;
  }
});

test("AtWassup text-send 404 is surfaced without trying another endpoint", async () => {
  const oldFetch = globalThis.fetch;
  const oldBase = process.env.AIRAVATA_API_BASE_URL;
  const oldKey = process.env.AIRAVATA_API_KEY;
  const oldPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  let requestUrl = "";
  try {
    process.env.AIRAVATA_API_BASE_URL = "https://atwassup.example";
    process.env.AIRAVATA_API_KEY = "server-only-test-key";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "configured-sender-id";
    globalThis.fetch = async input => {
      requestUrl = String(input);
      return new Response("Not Found", { status: 404 });
    };
    await assert.rejects(
      () => sendAiravataTextMessage({
        to: "+10000000001", text: "Hello", clientMessageId: "send-once-123",
      }),
      (error: unknown) => {
        assert.ok(error instanceof AiravataInboxError);
        assert.equal(error.status, 404);
        assert.match(error.message, /exact endpoint is deployed/i);
        assert.doesNotMatch(error.message, /server-only-test-key/);
        return true;
      },
    );
    assert.equal(new URL(requestUrl).pathname, "/api/integrations/v1/whatsapp/messages/text");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldBase === undefined) delete process.env.AIRAVATA_API_BASE_URL;
    else process.env.AIRAVATA_API_BASE_URL = oldBase;
    if (oldKey === undefined) delete process.env.AIRAVATA_API_KEY;
    else process.env.AIRAVATA_API_KEY = oldKey;
    if (oldPhone === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = oldPhone;
  }
});
