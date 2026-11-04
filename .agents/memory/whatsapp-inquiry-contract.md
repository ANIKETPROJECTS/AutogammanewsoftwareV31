---
name: WhatsApp inquiry contract
description: Durable stage and sample-data decisions for the WhatsApp Inquiries module.
---

WhatsApp inquiry stages are persisted as stable uppercase codes (`NEW`, `FORM_SUBMITTED`, `FOLLOW_UP_REQUIRED`, `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `COMPLETED`, `LOST`); the UI owns human-readable labels.

**Why:** External systems such as Airavata need stable machine values, while users should not have to see implementation-style enum names.

**How to apply:** Keep future webhook/API contracts on these codes and preserve development-only sample data gating until the external intake and deduplication rules are finalized.

The daily WhatsApp Inquiries board is a read-only view of AtWassup Open conversations, filtered by `windowOpen`, grouped by the latest inbound message date in India time, and showing the earliest inbound message. Do not create duplicate local stage records for this view.

**Why:** The user asked to display live inquiries from the Live Chat Open section, including the customer number and initial message.

**How to apply:** Keep this live board separate from manually tracked WhatsApp inquiry records unless the user explicitly asks to merge them.