---
name: Ticket date filtering
description: Date filter semantics for ticket browsing in the kiosk.
---

Ticket date ranges refer to creation dates, with inclusive full-day boundaries in Asia/Kolkata.

**Why:** The user requested kiosk ticket date filters; creation is the date already shown on ticket cards. India-time boundaries prevent late-evening UTC timestamps from appearing under the wrong local date.

**How to apply:** Use the same creation-date semantics for future ticket date filters or exports; resolving a ticket does not change which date range contains it.
