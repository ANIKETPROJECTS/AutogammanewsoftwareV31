---
name: WhatsApp Cloud document sending
description: Direct Meta Graph API calls need the access token plus sender phone number and business account IDs.
---

The server calls Meta's Graph API directly with `WHATSAPP_ACCESS_TOKEN`, so external VPS deployments do not depend on Replit's connectors SDK. The sender `phone_number_id` and business account ID are separate non-secret configuration values.

**Why:** A Replit-only package import made production bundles fail on external VPS hosts even when they already had the Meta token. Meta's Cloud API media and message endpoints also require a sender phone number ID separate from the token.

**How to apply:** Provide `WHATSAPP_ACCESS_TOKEN` through the runtime secret manager and configure `WHATSAPP_PHONE_NUMBER_ID` (and `WHATSAPP_BUSINESS_ACCOUNT_ID` where template lookup is needed) as environment values. Never place the token in source code or chat.