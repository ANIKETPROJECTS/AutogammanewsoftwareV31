import assert from "node:assert/strict";
import test from "node:test";
import { isFreePpfWearAndTearService } from "./ppf-wear-and-tear";

test("detects the explicit free wear-and-tear flag", () => {
  assert.equal(isFreePpfWearAndTearService([{ price: 0, wearAndTearFree: true }]), true);
});

test("recognizes legacy job cards with all PPF items priced at zero", () => {
  assert.equal(isFreePpfWearAndTearService([{ price: 0 }, { price: "0" }]), true);
});

test("does not mark normally priced PPF as a free wear-and-tear service", () => {
  assert.equal(isFreePpfWearAndTearService([{ price: 5000 }]), false);
});
