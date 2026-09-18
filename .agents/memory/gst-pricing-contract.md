---
name: GST pricing contract
description: Business rule for GST-inclusive and GST-exclusive job-card and invoice totals.
---

The GST mode must travel with the job card and generated invoice. `exclusive` means GST is added to the discounted subtotal; `inclusive` means the entered subtotal is the final GST-inclusive amount and the tax component is extracted using `total * rate / (100 + rate)`. Records created before GST mode existed default to `exclusive`.

When GST is split into SGST and CGST for display, round the combined GST to the nearest rupee and divide it equally between both components. Preserve `.50` when the rounded amount is odd; never assign the extra rupee to only one component.

**Why:** Applying the exclusive formula to an inclusive price overcharges the customer and makes payment totals disagree with the job-card estimate.

**How to apply:** Keep the mode-aware calculation and equal GST split consistent in job-card previews, POS summaries and receipts, business payment totals, invoice creation/update, and invoice display/export. Inclusive summaries should label the subtotal as GST included.