---
name: Invoice mark-as-paid behavior
description: What the Add Job Mark as Paid option means and how to record it.
---

Checking **Mark as Paid** means the customer has paid the invoice in full. If no payment amount is entered, record the remaining invoice balance using the selected payment method (Cash by default). Never save a zero-value payment row.

**Why:** The user said marking an invoice paid must not leave it Partial or show Cash ₹0.

**How to apply:** Keep the payment total equal to the invoice total when Mark as Paid is selected; preserve legitimate multi-method payments, and only store positive payment entries. Do not infer a payment when Mark as Paid is unchecked.
