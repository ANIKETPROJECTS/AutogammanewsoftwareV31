---
name: PPF roll tracking
description: Product rule for tracking stock and job-card usage for each individual PPF roll.
---

- A roll’s detail view must show its current stock and the job-card usage recorded for that exact roll.
- Prefer the stable roll inventory ID for usage matching. Preserve existing roll IDs when PPF inventory is edited.
- Use a name-only match for legacy usage only when that roll name is unique within its PPF master; do not assign ambiguous history to duplicate-name rolls.
- When the free wear-and-tear toggle is used, the invoice must clearly label the PPF as a free wear-and-tear service.
- Editing a job card must restore its free wear-and-tear toggle, including legacy records whose PPFs are all zero-priced.

**Why:** The user wants to open any individual PPF roll and track where it has been used, including while it remains in stock.

**How to apply:** Keep per-roll history tied to inventory IDs across edits. If a legacy job card lacks an ID and duplicate rolls share a name, leave that usage unattributed rather than guessing.

**Why:** The user requires the invoice to disclose that toggled PPF work is complimentary wear-and-tear service.

**How to apply:** Preserve the free-service flag on invoice items and show an explicit “Free PPF Wear-and-Tear Service” label on both the on-screen invoice and its PDF.

**Why:** The user expects job-card edits to retain the original free-service selection.

**How to apply:** Restore the toggle from saved PPF flags, infer it for legacy all-zero PPF records, and keep it through updates unless the user explicitly turns it off.
