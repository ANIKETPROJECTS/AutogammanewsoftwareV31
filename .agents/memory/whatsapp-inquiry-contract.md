---
name: WhatsApp inquiry contract
description: Durable stage and sample-data decisions for the WhatsApp Inquiries module.
---

WhatsApp inquiry stages are persisted as stable uppercase codes (`NEW`, `FORM_SUBMITTED`, `FOLLOW_UP_REQUIRED`, `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `COMPLETED`, `LOST`); the UI owns human-readable labels.

**Why:** External systems such as Airavata need stable machine values, while users should not have to see implementation-style enum names.

**How to apply:** Keep future webhook/API contracts on these codes and preserve development-only sample data gating until the external intake and deduplication rules are finalized.

The daily WhatsApp Inquiries board is a read-only view of AtWassup Open conversations, filtered by `windowOpen`, grouped by the latest inbound message date in India time, and showing the first inbound message from that same India-local day. Do not create duplicate local stage records for this view.

**Why:** The user wants the daily board to show the start of that day’s conversation, not an older first-ever message from the customer’s history.

**How to apply:** Keep this live board separate from manually tracked WhatsApp inquiry records unless the user explicitly asks to merge them.