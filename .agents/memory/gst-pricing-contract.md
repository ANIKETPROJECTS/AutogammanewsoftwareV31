---
name: GST pricing contract
description: Business rule for GST-inclusive and GST-exclusive job-card and invoice totals.
---

The GST mode must travel with the job card and generated invoice. In both modes, calculate GST directly as `subtotal * rate / 100`. `exclusive` adds that GST to the subtotal; `inclusive` keeps the entered subtotal as the final total while showing the directly calculated GST as included. Records created before GST mode existed default to `exclusive`.

When GST is split into SGST and CGST for display, round the combined GST to the nearest rupee and divide it equally between both components. Preserve `.50` when the rounded amount is odd; never assign the extra rupee to only one component.

**Why:** The business explicitly treats a ₹100 GST-inclusive subtotal at 18% as containing ₹18 GST while keeping the customer total at ₹100. This is the required accounting convention even though tax-extraction formulas may differ.

**How to apply:** Keep the mode-aware calculation and equal GST split consistent in job-card previews, POS summaries and receipts, business payment totals, invoice creation/update, and invoice display/export. Auto Gamma inclusive invoice summaries should label the subtotal as GST included.

AGNX invoices must not mention GST, including “GST included” or other tax wording, when a bill is split between Auto Gamma and AGNX. Auto Gamma retains its GST behavior; AGNX has no GST.

**Why:** The user explicitly requires the AGNX portion of a split bill to have no GST wording while Auto Gamma displays its GST normally.

**How to apply:** Apply this separation to new and edited split invoices and all invoice outputs. Older AGNX records may inherit an inclusive mode from the parent job; do not use that mode as permission to display GST.