---
name: WhatsApp delivery and Live Chat reporting
description: AutoGamma sends through Meta; every accepted outgoing message needs a separate Airavata record.
---

A manual catch-up using the approved `inspection_ppf` template in `en_US` with the recipient's first name delivered successfully. Delivery receipts come from Meta's subscribed `messages` webhook, whose POST signatures must be verified with the app secret.

The separate Airavata WhatsApp Solution runs on the VPS at `https://app.atwassup.com`. AutoGamma remains the sender. After Meta accepts any outgoing message, report its actual rendered content, sender phone-number ID, recipient, accepted timestamp, Meta message ID, and any document/media metadata to `/api/integrations/autogamma/outbound-messages`. Airavata records the message in Live Chat without sending it; retries are idempotent by Meta message ID. Use one dedicated tenant API key as a Bearer token for every sending path. Never move sending to Airavata, backfill old messages, or resend a customer message because reporting failed.

**Why:** The user confirmed delivery after manually sending the catch-up and specified that the VPS-hosted Airavata service only records messages sent by AutoGamma. The Meta API acknowledgement by itself only confirms acceptance, not delivery; webhook configuration and signature verification are required for reliable automated status updates.

**How to apply:** Preserve the working template payload. For Live Chat reporting, use the exact approved Meta template text and retry only the idempotent report request. Keep API acceptance, sent, delivered, read, and failed states distinct. If a prior send is still unconfirmed, warn that resending may create a duplicate.

Every sending path must share the recording connection, not opt in independently by message type. Sharing a WhatsApp sender number does not by itself populate Airavata's stored chat history. A configured connection is not proof that the remote endpoint accepted a record.

**Why:** The earlier PPF-only recording fix left invoice and inquiry templates outside Live Chat. A missing dedicated reporting credential can independently disable recording even when Meta sending works.

**How to apply:** Put future sending paths through the shared post-acceptance reporting boundary; keep credentials server-side and report configuration and recording failures visibly. Do not claim end-to-end success without a remote acknowledgement, and remember that workspace credentials do not automatically configure a separate VPS.