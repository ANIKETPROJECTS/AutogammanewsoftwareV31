---
name: PPF roll tracking
description: Product rule for tracking stock and job-card usage for each individual PPF roll.
---

- A roll’s detail view must show its current stock and the job-card usage recorded for that exact roll.
- Prefer the stable roll inventory ID for usage matching. Preserve existing roll IDs when PPF inventory is edited.
- Use a name-only match for legacy usage only when that roll name is unique within its PPF master; do not assign ambiguous history to duplicate-name rolls.

**Why:** The user wants to open any individual PPF roll and track where it has been used, including while it remains in stock.

**How to apply:** Keep per-roll history tied to inventory IDs across edits. If a legacy job card lacks an ID and duplicate rolls share a name, leave that usage unattributed rather than guessing.
