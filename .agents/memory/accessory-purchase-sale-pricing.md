---
name: Accessory purchase vs sale pricing
description: Preserve the distinction between vendor unit cost and the accessory's sale price in Masters.
---

Accessory Master `price` is the selling price used by job and invoice flows. A vendor purchase line's `unitPrice` is the supplier's unit cost. Keep these values separate; vendor receipts update the latest purchase-cost field and stock, not the configured sale price.

**Why:** Treating purchase cost as sale price can overwrite a valid selling price or mislead users about margins.

**How to apply:** When changing vendor purchase synchronization, preserve Master sale price and update purchase-cost metadata from the latest remaining purchase. Recheck cost metadata when purchases are edited or deleted.

The separately entered vendor item “Purchase Cost” is informational only. Keep existing Unit Cost and all bill totals, GST, payment, stock and Master-price calculations unchanged.

**Why:** The user explicitly chose “Separate amount; keep totals unchanged” when requesting the additional Purchase Cost field and columns.

**How to apply:** Show the entered amounts separately in vendor and purchase views; aggregated Purchase Cost sums item entries without multiplying by quantity. Missing historical entries are unrecorded, not a derived Unit Cost or bill total.

Display Purchase Cost before Unit Cost wherever both appear in Vendors.

**Why:** The user corrected the field order: “purchase cost before unit cost”.

**How to apply:** Keep this order consistent in Add/Edit Purchase, Purchase Details and purchase item cards.