---
name: PPF inspection WhatsApp delivery
description: Verified behavior of the approved PPF inspection template during a manual catch-up send.
---

A manual catch-up using the approved `inspection_ppf` template in `en_US` with the recipient's first name delivered successfully. Delivery receipts come from Meta's subscribed `messages` webhook, whose POST signatures must be verified with the app secret.

The separate Airavata WhatsApp Solution runs on the VPS at `https://app.atwassup.com`. AutoGamma remains the sender; after Meta accepts a new PPF message, it may report the rendered template body, sender phone-number ID, recipient, accepted timestamp, and Meta message ID to `/api/integrations/autogamma/outbound-messages`. Airavata records the message in Live Chat without sending it; retries are idempotent by Meta message ID. Use a dedicated tenant API key as a Bearer token. Never move sending to Airavata, backfill old messages, or resend a customer message because reporting failed.

**Why:** The user confirmed delivery after manually sending the catch-up and specified that the VPS-hosted Airavata service only records messages sent by AutoGamma. The Meta API acknowledgement by itself only confirms acceptance, not delivery; webhook configuration and signature verification are required for reliable automated status updates.

**How to apply:** Preserve the working template payload. For Live Chat reporting, use the exact approved Meta template text and retry only the idempotent report request. Keep API acceptance, sent, delivered, read, and failed states distinct. If a prior send is still unconfirmed, warn that resending may create a duplicate.