---
name: WhatsApp inquiry contract
description: Durable stage and sample-data decisions for the WhatsApp Inquiries module.
---

WhatsApp inquiry stages are persisted as stable uppercase codes (`NEW`, `FORM_SUBMITTED`, `FOLLOW_UP_REQUIRED`, `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `COMPLETED`, `LOST`); the UI owns human-readable labels.

**Why:** External systems such as Airavata need stable machine values, while users should not have to see implementation-style enum names.

**How to apply:** Keep future webhook/API contracts on these codes and preserve development-only sample data gating until the external intake and deduplication rules are finalized.