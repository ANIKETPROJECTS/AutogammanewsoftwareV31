---
name: Warranty and PPF follow-up separation
description: Product rule for distinguishing long-term warranty checkups from five-day PPF inspection reminders.
---

Keep long-term warranty checkup statuses and five-day PPF inspection reminders as separate workflows. A five-day reminder can come from a PPF invoice item or directly from a job card's PPF item. If there is no PPF item, the explicit complimentary item "PPF Inspection after 5 Days" is also a reminder trigger. Do not create a duplicate job-card reminder when a linked PPF invoice item already represents the job. Calculate the reminder five calendar days after the job card's completion date. Automatically send only on the due date; keep past-due reminders available for manual catch-up and preserve confirmed send outcomes.

**Why:** The user clarified that the inspection reminder should follow job completion, not the service date, and that completed job cards must still appear when their explicit complimentary PPF inspection item is not on an invoice. A job card can be completed after the service date, so anchoring to service date can make the message arrive too early or become past due before completion.

**How to apply:** Keep warranty counts and filters focused on actual warranty periods; an inspection-only complimentary item is not a long-term warranty. Keep PPF due dates and actual WhatsApp outcomes together in the PPF inspection area. Do not send before completion or before five calendar days have elapsed. Do not label a reminder Sent or Failed until the approved WhatsApp template produces a real send outcome.