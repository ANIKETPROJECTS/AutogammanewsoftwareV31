---
name: Warranty and PPF follow-up separation
description: Product rule for distinguishing long-term warranty checkups from five-day PPF inspection reminders.
---

Keep long-term warranty checkup statuses and five-day PPF inspection reminders as separate workflows. Calculate the PPF reminder from the recorded service date (job-card date, with invoice date as fallback), five calendar days later; job-card completion status is not a gate. Preserve existing send outcomes.

**Why:** The service date is the event the reminder follows. A job card can remain open after the service, so completion status must not delay the five-day reminder.

**How to apply:** Keep warranty counts and filters focused on warranty checkup timing and completion. Keep PPF due dates and actual WhatsApp outcomes together in the PPF inspection area. Do not label a reminder Sent or Failed until the approved WhatsApp template produces a real send outcome.