---
name: Accessory purchase vs sale pricing
description: Preserve the distinction between vendor unit cost and the accessory's sale price in Masters.
---

Accessory Master `price` is the customer sale price used by job and invoice flows. New vendor purchase entries use `sellCost` for that price; `unitPrice` remains the supplier cost.

**Why:** The user confirmed that Unit Cost must continue driving supplier totals, GST, and payments, while the new Sell Cost drives customer pricing.

**How to apply:** Price-only edits update the Master sale price without receiving stock again. Keep accessory bills sourced from Sell Cost, and keep supplier costs out of customer invoices. A bill-level discount edits that bill's saved line price, not the Master sale price.

PPF keeps its existing vehicle-and-warranty package prices authoritative when a positive option price is configured. The item's per-sqft Sell Cost is the fallback for the area used when no positive package price is set.

**Why:** A PPF job bills a vehicle-specific package while Sell Cost is entered per sqft; replacing configured package prices with the stock rate would change existing customer pricing.

**How to apply:** Preserve configured PPF warranty prices, apply Sell Cost times area only as a fallback, then calculate customer GST from the resulting sale amount.

New accessory purchases use the per-selected-unit Purchase Cost multiplied by quantity for supplier totals, GST, and payments. PPF keeps the prior behavior: Purchase Cost is informational, while Unit Cost drives its supplier total. Sell Cost remains customer pricing, and a cost-basis marker preserves historical calculations.

**Why:** The user confirmed the new Purchase Cost behavior for Accessories, then requested that PPF retain its prior Purchase Cost reference and Unit Cost billing flow.

**How to apply:** Mark new Accessories as Purchase-Cost-based and new PPF items as Unit-Cost-based. Items without a marker keep their prior Unit-Cost calculation; preserve stored values and never expose supplier cost on customer invoices.

For legacy purchase items without `sellCost`, preserve their previous sale-price behavior during backfill: use their prior `sellingPrice` when positive, otherwise the old Unit Cost fallback.

**Why:** Existing Master creation used that fallback, so replacing it with zero would unexpectedly erase sale prices for historical items.

**How to apply:** Keep legacy normalization in the Mongo migration; new items should default to zero and must never fall back to supplier cost.