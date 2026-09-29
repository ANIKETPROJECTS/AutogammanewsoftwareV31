---
name: Accessory purchase vs sale pricing
description: Preserve the distinction between vendor unit cost and the accessory's sale price in Masters.
---

Accessory Master `price` is the selling price used by job and invoice flows. A vendor purchase line's `unitPrice` is the supplier's unit cost. Keep these values separate; vendor receipts update the latest purchase-cost field and stock, not the configured sale price.

**Why:** Treating purchase cost as sale price can overwrite a valid selling price or mislead users about margins.

**How to apply:** When changing vendor purchase synchronization, preserve Master sale price and update purchase-cost metadata from the latest remaining purchase. Recheck cost metadata when purchases are edited or deleted.