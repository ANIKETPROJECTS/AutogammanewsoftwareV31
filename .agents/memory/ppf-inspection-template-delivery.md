---
name: PPF inspection WhatsApp delivery
description: Verified behavior of the approved PPF inspection template during a manual catch-up send.
---

A manual catch-up using the approved `inspection_ppf` template in `en_US` with the recipient's first name delivered successfully. Delivery receipts come from Meta's subscribed `messages` webhook, whose POST signatures must be verified with the app secret.

**Why:** The user confirmed delivery after manually sending the catch-up. The Meta API acknowledgement by itself only confirms acceptance, not delivery; webhook configuration and signature verification are required for reliable automated status updates.

**How to apply:** Preserve the working template payload. Keep API acceptance, sent, delivered, read, and failed states distinct. If a prior send is still unconfirmed, warn that resending may create a duplicate.