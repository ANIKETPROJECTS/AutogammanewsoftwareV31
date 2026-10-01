---
name: Warranty and PPF follow-up display
description: Product rules for showing PPF in warranty and inspection lists while keeping their schedules and message statuses accurate.
---

Show only items with a recorded warranty period in Warranty Checkups, including PPF and other warranty-bearing items; keep complimentary inspection-only items out of that list. Show all PPF job-card items and complimentary PPF items in 5-Day PPF Inspections. A complimentary inspection-only row must not imply a long-term warranty, get a fabricated warranty period, or offer checkup/top-up actions.

Five-day reminders can come from a PPF invoice item, a job card PPF item, or a complimentary item whose name includes PPF. Do not create a duplicate job-card reminder when a linked PPF invoice item already represents the job. Calculate the due date as five calendar days after the actual job-card completion date and automatically send on that due date. Keep past-due reminders available for manual catch-up, but do not allow manual sends before the due date.

Show the WhatsApp status as accepted by Meta only after the Graph API accepts the template request and returns a message ID. Delivery/read receipts must not change the accepted status or appear in the reminder UI/API response. Keep delivery receipt data internal if needed; do not expose message IDs to this UI.

**Why:** Warranty Checkups should contain only actual warranty items, while the Inspection list must also retain non-warranty PPF and complimentary inspection items. The requested WhatsApp status is Meta's API acceptance, not delivery or read confirmation. Completion date—not service date—is the reliable anchor because a job card can be completed later.

**How to apply:** Show inspection-only rows with completion and five-day due dates, but no warranty expiry or checkup controls. Use actual warranty periods for long-term checkup counts and actions. Preserve accepted-send outcomes against later delivery webhooks, and require the due date for both scheduled and manual sends.