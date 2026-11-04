---
name: Invoice mark-as-paid behavior
description: What the Add Job Mark as Paid option means and how to record it.
---

Checking **Mark as Paid** only enables recording payment details. Never infer a payment or fill a remaining balance from the checkbox. Zero or blank means unpaid; a positive amount below the total means partial; the full entered amount means paid. Never save a zero-value payment row.

**Why:** The user clarified that automatically showing fully paid without entering a paid amount is wrong.

**How to apply:** Derive invoice payment status from actual entered positive payment amounts, preserve multi-method entries, and never manufacture payment amounts on the client or server.
