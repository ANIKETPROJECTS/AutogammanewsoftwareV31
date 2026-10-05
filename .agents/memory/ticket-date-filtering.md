---
name: Ticket and inquiry date filtering
description: Date filter semantics for ticket and inquiry browsing.
---

Ticket and inquiry date ranges refer to creation dates, with inclusive full-day boundaries in Asia/Kolkata. Admin and kiosk inquiry filters use the same date semantics.

**Why:** Creation is the date already shown on these cards. India-time boundaries prevent late-evening UTC timestamps from appearing under the wrong local date, and keep matching Admin and kiosk date ranges consistent.

**How to apply:** Use the same creation-date semantics for future ticket/inquiry date filters or exports; resolving a ticket or converting an inquiry does not change which date range contains it.

Kiosk Saved Inquiries uses one range calendar to choose both From and To, rather than two separate date controls.

**Why:** The user explicitly asked to select both dates in one calendar.

**How to apply:** Preserve the single-calendar interaction when changing kiosk inquiry filters; this request does not extend to other pages.
