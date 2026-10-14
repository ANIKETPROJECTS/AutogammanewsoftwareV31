import assert from "node:assert/strict";
import test from "node:test";
import { jobCardSchema, paintingDentingJobItemSchema } from "./schema";

const panel = {
  id: "painting-denting-front-bumper",
  panel: "Front Bumper",
  workType: "Painting & Denting",
  price: 3500,
};

test("standard painting and denting panels are fixed at ₹3,500", () => {
  assert.equal(paintingDentingJobItemSchema.parse(panel).price, 3500);
  assert.equal(paintingDentingJobItemSchema.safeParse({ ...panel, price: 3000 }).success, false);
});

test("touch-up allows an entered custom price", () => {
  assert.equal(
    paintingDentingJobItemSchema.parse({ ...panel, workType: "Touch-up", price: 1200 }).price,
    1200,
  );
});

test("custom panel names are accepted", () => {
  assert.equal(
    paintingDentingJobItemSchema.parse({ ...panel, panel: "Door pillar" }).panel,
    "Door pillar",
  );
});

test("a job card cannot save the same panel twice", () => {
  const result = jobCardSchema.safeParse({
    jobNo: "JC-TEST-001",
    customerName: "Test Customer",
    phoneNumber: "9876543210",
    make: "Toyota",
    model: "Corolla",
    licensePlate: "MH 12 AB 1234",
    services: [],
    ppfs: [],
    accessories: [],
    paintingDenting: [panel, { ...panel, id: "duplicate", panel: "front bumper" }],
    estimatedCost: 7000,
  });
  assert.equal(result.success, false);
});
