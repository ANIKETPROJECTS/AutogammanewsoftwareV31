---
name: Invoice mark-as-paid behavior
description: What the Add Job Mark as Paid option means and how to record it.
---

Checking **Mark as Paid** only enables recording payment details. Never infer a payment or fill a remaining balance from the checkbox. For invoices above zero, zero or blank means unpaid; a positive amount below the total means partial; the full entered amount means paid. A zero-total invoice is paid because no balance is due. Never save a zero-value payment row.

**Why:** The user clarified that automatically showing fully paid without entering a paid amount is wrong, except when the invoice total is zero and nothing is owed.

**How to apply:** Derive payment status from actual entered positive payment amounts when the invoice total is above zero; treat a zero-total invoice as paid without payment entries. Preserve multi-method entries and never manufacture payment amounts on the client or server.
