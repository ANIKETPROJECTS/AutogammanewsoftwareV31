import assert from "node:assert/strict";
import test from "node:test";
import { complimentaryInvoiceNote, invoiceServiceItems, escapeInvoiceHtml } from "../shared/invoice-display";
import { createInvoicePdf } from "./invoice-pdf";
import { buildThermalReceipt } from "../client/src/lib/thermal-receipt";

const items = [
  { name: "Tar Remover", type: "Service", price: 200, quantity: 1 },
  { name: "NanoGlass", type: "Complimentary", price: 7319, quantity: 73 },
  { name: "Wheel coating", type: "Complimentary", price: 0, quantity: 1 },
  { name: "Interior PPF kit", type: "Complimentary", price: 0, quantity: 1 },
];
const invoice = {
  invoiceNo: "COMPLIMENTARY-TEST", customerName: "Test customer", phoneNumber: "0000000000",
  items, subtotal: 200, gstPercentage: 0, gstAmount: 0, totalAmount: 200,
  date: "2026-10-05",
};

test("complimentary names appear in one note, not service rows, without changing persisted items", () => {
  const original = structuredClone(items);
  assert.deepEqual(invoiceServiceItems(items).map(item => item.name), ["Tar Remover"]);
  assert.equal(complimentaryInvoiceNote(items), "Complimentary: NanoGlass; Wheel coating; Interior PPF kit.");
  assert.deepEqual(items, original);
  assert.equal(complimentaryInvoiceNote([items[0]]), "");
  assert.equal(complimentaryInvoiceNote([]), "");
});

test("names in email note are HTML-escaped", () => {
  assert.equal(escapeInvoiceHtml(complimentaryInvoiceNote([
    { type: "Complimentary", name: '<Coating> & "PPF"' },
  ])), "Complimentary: &lt;Coating&gt; &amp; &quot;PPF&quot;.");
});

for (const business of ["Auto Gamma", "AGNX"]) {
  test(`${business} PDF has a names-only complimentary note and unchanged totals`, () => {
    const pdf = createInvoicePdf({ ...invoice, business }).toString("latin1");
    assert.match(pdf, /Complimentary: NanoGlass; Wheel coating; Interior PPF kit/);
    for (const name of ["NanoGlass", "Wheel coating", "Interior PPF kit"]) {
      assert.equal(pdf.split(name).length - 1, 1);
    }
    assert.doesNotMatch(pdf, /FREE|no charge|INR 7,319/);
    assert.match(pdf, /INR 200/);
  });

  test(`${business} thermal invoice has names without complimentary price or quantity`, () => {
    const receipt = buildThermalReceipt({ ...invoice, business });
    assert.match(receipt, /Complimentary: NanoGlass/);
    assert.match(receipt, /Wheel coating/);
    assert.match(receipt, /Interior PPF kit/);
    assert.doesNotMatch(receipt, /FREE|no charge|73 x|7,319/);
    assert.match(receipt, /Rs\.200/);
  });
}
