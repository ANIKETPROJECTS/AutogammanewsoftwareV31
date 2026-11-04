---
name: AtWassup conversation counts
description: How to derive full Sent, Open, and Closed totals from the conversation API.
---

The AtWassup conversation-list response provides records and a `nextBefore` cursor, but no total-count field. Counts for Sent, Open, and Closed must therefore traverse every cursor page; do not use the current page length or unread count as a tab total. The API's `status=OPEN` includes conversations whose 24-hour window is closed, so count Open using `windowOpen`.

**Why:** Paginated lists otherwise undercount conversations, especially in larger Closed histories; counting every `status=OPEN` record overstates the AtWassup Open tab.

**How to apply:** Make the paginated requests server-side, use the documented maximum page size, count unique contact IDs, filter Open records by `windowOpen`, detect a cursor that stops advancing, and refresh totals periodically and after local chat changes.
