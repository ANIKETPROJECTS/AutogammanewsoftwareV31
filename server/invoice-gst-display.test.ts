import assert from "node:assert/strict";
import test from "node:test";
import { createInvoicePdf } from "./invoice-pdf";
import { buildThermalReceipt } from "../client/src/lib/thermal-receipt";

const invoice = {
  invoiceNo: "TEST-SPLIT",
  customerName: "Test customer",
  phoneNumber: "0000000000",
  customerGstNumber: "TEST-CUSTOMER-GSTIN",
  items: [{ name: "Test service", type: "Service", price: 5000, quantity: 1 }],
  subtotal: 5000,
  gstPercentage: 18,
  gstAmount: 900,
  totalAmount: 5000,
  date: "2026-10-02",
};

for (const gstMode of ["inclusive", "exclusive", undefined] as const) {
  for (const gstPercentage of [18, 0]) {
    test(`AGNX PDF hides GST with stored mode ${gstMode} and rate ${gstPercentage}`, () => {
      const pdf = createInvoicePdf({
        ...invoice, business: "AGNX", gstMode, gstPercentage,
      }).toString("latin1");

      assert.doesNotMatch(pdf, /GST/);
      assert.match(pdf, /SubTotal/);
      assert.match(pdf, /INR 5,000/);
    });

    test(`AGNX thermal receipt hides GST with stored mode ${gstMode} and rate ${gstPercentage}`, () => {
      const receipt = buildThermalReceipt({
        ...invoice, business: "AGNX", gstMode, gstPercentage,
      });

      assert.doesNotMatch(receipt, /GST/);
      assert.match(receipt, /Subtotal/);
      assert.match(receipt, /Rs\.5,000/);
    });
  }
}

for (const gstMode of ["inclusive", "exclusive"] as const) {
  test(`Auto Gamma ${gstMode} PDF preserves GST wording and totals`, () => {
    const totalAmount = gstMode === "inclusive" ? 5000 : 5900;
    const pdf = createInvoicePdf({
      ...invoice, business: "Auto Gamma", gstMode, totalAmount,
    }).toString("latin1");

    assert.match(pdf, /SGST: 9\.00%/);
    assert.match(pdf, /CGST: 9\.00%/);
    assert.match(pdf, /INR 450/);
    assert.match(pdf, /TEST-CUSTOMER-GSTIN/);
    assert.match(pdf, gstMode === "inclusive" ? /INR 5,000/ : /INR 5,900/);
    if (gstMode === "inclusive") assert.match(pdf, /GST included/);
    else assert.doesNotMatch(pdf, /GST included/);
  });

  test(`Auto Gamma ${gstMode} thermal receipt preserves GST wording and totals`, () => {
    const totalAmount = gstMode === "inclusive" ? 5000 : 5900;
    const receipt = buildThermalReceipt({
      ...invoice, business: "Auto Gamma", gstMode, totalAmount,
    });

    assert.match(receipt, /SGST 9\.00%/);
    assert.match(receipt, /CGST 9\.00%/);
    assert.match(receipt, /Rs\.450/);
    assert.match(receipt, /TEST-CUSTOMER-GSTIN/);
    assert.match(receipt, gstMode === "inclusive" ? /Rs\.5,000/ : /Rs\.5,900/);
    if (gstMode === "inclusive") assert.match(receipt, /GST incl\./);
    else assert.doesNotMatch(receipt, /GST incl\./);
  });
}