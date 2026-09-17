---
name: Nested Mongo identifiers
description: Identifier handling for nested MongoDB subdocuments crossing the client/API boundary
---

Nested MongoDB subdocuments may arrive as `_id`, a mapped `id`, or without the expected client-facing key. Resolve identifiers consistently in the client and normalize them again at the API boundary; when a selected name is available, use the parent master record as a safe fallback before validating or applying inventory changes.

**Why:** PPF job-card creation reached validation with a missing nested roll identifier even though the selected roll was visible in the form. Relying on only one representation allowed the UI and API contracts to drift.

**How to apply:** For nested inventory or catalog records, convert identifiers to strings before form state/payload creation, reject unresolvable selections in the UI, and resolve missing IDs server-side from the authoritative parent record rather than accepting an item that cannot be deducted safely.