---
name: PPF inspection WhatsApp delivery
description: Verified behavior of the approved PPF inspection template during a manual catch-up send.
---

A manual catch-up using the approved `inspection_ppf` template in `en_US` with the recipient's first name delivered successfully.

**Why:** The user confirmed delivery after manually sending the catch-up. The Meta API acknowledgement by itself only confirms acceptance, not delivery.

**How to apply:** Preserve the working template payload. Keep “Accepted by WhatsApp” distinct from actual delivery in the UI unless a delivery status callback or verified manual update is available.