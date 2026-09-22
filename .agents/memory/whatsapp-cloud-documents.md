---
name: WhatsApp Cloud document sending
description: The WhatsApp Business connector supplies authenticated Graph API access, but document sends still need the sender phone number ID separately.
---

The WhatsApp Business connector stores the access token and handles authenticated Graph API requests. The sender `phone_number_id` is separate connection metadata, not part of the token, so the application must receive it as a non-secret configuration value before uploading and sending invoice PDFs.

**Why:** Meta’s Cloud API media and message endpoints are scoped to a specific sender phone number ID; a connected token alone is not enough to select the business number.

**How to apply:** Keep the token inside the managed connector for Replit deployments, or provide it as `WHATSAPP_ACCESS_TOKEN` in the VPS secret manager for direct Meta Graph API calls. Configure the sender phone number ID separately and use it for both `/media` and `/messages` requests. Never place either credential in source code or chat.