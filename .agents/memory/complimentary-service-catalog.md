---
name: Complimentary service catalog
description: Keep complimentary services separate from chargeable items while showing the selected free item on job cards and invoices.
---

Complimentary items are managed in their own Masters tab, separate from the ordinary Service Master list. They have no vehicle-based prices and should be offered through a distinct multi-select job-card selector, not mixed into chargeable service pickers. Persist every selected item and assign each to exactly one business when invoices are split. On invoices, show a short complimentary note listing names only, not table rows, quantities, prices, or repeated “no charge” descriptions. Keep them out of subtotal, discount, tax, and amount-due calculations. POS remains separate unless its behavior is explicitly requested.

**Why:** The user requested multiple complimentary services on a job and invoice while keeping them free. Routing each one to a single invoice avoids duplication across the two-business billing flow, while a separate selector prevents them from being mistaken for chargeable services.

**How to apply:** Keep the complimentary Masters tab and job selector distinct from chargeable services, prevent duplicate selection of the same master item, and preserve the zero-price, one-business invoice rule across job creation, edits, React invoice rendering, and PDF output.

**Why names-only invoices:** The user requested “just a note with the list of complimentary,” without quantity or price. Keep this concise presentation across invoice previews, PDF/email output, and invoice receipt printing.