---
name: Complimentary service catalog
description: Keep complimentary services separate from chargeable items while showing the selected free item on job cards and invoices.
---

Complimentary items are managed in their own Masters tab, separate from the ordinary Service Master list. They have no vehicle-based prices and should be offered through a distinct single-choice job-card selector, not mixed into chargeable service pickers. Persist the selected item and assign it to exactly one business when invoices are split. Show it on billing and invoice documents as free, but keep it out of subtotal, discount, tax, and amount-due calculations. POS remains separate unless its behavior is explicitly requested.

**Why:** The user requested that one selected complimentary service appear on the job and invoice while remaining free. Routing it to one invoice avoids duplication across the two-business billing flow, while a separate selector prevents the item from being mistaken for a chargeable service.

**How to apply:** Keep the complimentary Masters tab and job selector distinct from chargeable services. Preserve the zero-price, one-business invoice rule across job creation, edits, React invoice rendering, and PDF output.