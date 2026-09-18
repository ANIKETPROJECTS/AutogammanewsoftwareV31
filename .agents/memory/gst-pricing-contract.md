---
name: GST pricing contract
description: Business rule for GST-inclusive and GST-exclusive job-card and invoice totals.
---

The GST mode must travel with the job card and generated invoice. `exclusive` means GST is added to the discounted subtotal; `inclusive` means the entered subtotal is the final GST-inclusive amount and the tax component is extracted using `total * rate / (100 + rate)`. Records created before GST mode existed default to `exclusive`.

**Why:** Applying the exclusive formula to an inclusive price overcharges the customer and makes payment totals disagree with the job-card estimate.

**How to apply:** Keep the mode-aware calculation consistent in job-card previews, business payment totals, invoice creation/update, and invoice display/export. Inclusive summaries should label the subtotal as GST included.