---
name: Complimentary service catalog boundary
description: Keep complimentary service entries separate from ordinary chargeable services until invoice behavior is defined.
---

Complimentary items belong in Service Master under the `Complimentary` category with no vehicle-based prices. Until the complimentary invoice behavior is specified, keep them out of regular Add Job and POS service selection and do not change invoice rendering.

**Why:** The user plans to provide invoice details later. Offering these catalog-only entries as ordinary services could add zero-priced or incorrectly charged lines to jobs or bills.

**How to apply:** When implementing the later invoice flow, add an explicit complimentary display path and define whether those items affect totals; do not simply remove the existing exclusions.