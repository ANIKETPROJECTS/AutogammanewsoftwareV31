---
name: Complimentary service catalog boundary
description: Keep complimentary service entries separate from ordinary chargeable services until invoice behavior is defined.
---

Complimentary items are managed in their own Masters tab, separate from the ordinary Service Master list. They are stored with the `Complimentary` category and have no vehicle-based prices. Until the complimentary invoice behavior is specified, keep them out of regular Add Job and POS service selection and do not change invoice rendering.

**Why:** The user asked for a dedicated Masters tab and plans to provide invoice details later. Mixing these catalog entries into the regular service list could make them look chargeable or add zero-priced lines to jobs.

**How to apply:** Keep the complimentary tab separate from Service Master. When implementing invoice behavior later, add an explicit complimentary display path and define whether those items affect totals; do not simply remove the existing exclusions.